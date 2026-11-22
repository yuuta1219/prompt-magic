/**
 * ゲームエンジン本体。固定タイムステップでシミュレーションを進める。
 *
 * - 実時間とは切り離されている（step() を呼んだ分だけ時間が進む）
 * - 詠唱はキューで管理: interpreting → waiting_mana → casting → done
 * - 解釈結果は applyInterpretation() で「その時点のゲーム状態」に適用される
 *   古い/キャンセル済み/別バトルのレスポンスは捨てる
 */
import { DAMAGE, SPELL_LIMITS, TICK_MS } from './constants';
import { ELEMENTS } from './elements';
import type { Loadout } from './skills';
import type { Action, Spell } from '../interpreter/schema';
import { GridSystem } from './GridSystem';
import { BattleState } from './BattleState';
import { EnemyAI } from './EnemyAI';
import { MagicEngine } from './MagicEngine';
import { HarnessEngine } from './HarnessEngine';
import { computeSpellCost, spellCastTimeMs } from './ManaSystem';
import { validateSpell } from '../interpreter/schema';
import { interpretSpell } from '../interpreter/SpellInterpreter';
import type { PendingAttack, SpellEntry } from './types';

export type InterpretationResult = { ok: true; spell: unknown } | { ok: false; error: string };
export type CastResult = { ok: true; entryId: number } | { ok: false; error: string };

const FX_LIFETIME_MS = 600;

export class GameEngine {
  s: BattleState;
  enemyAI: EnemyAI;
  magic: MagicEngine;
  harness: HarnessEngine;
  /** UI再描画用のバージョン */
  version = 0;
  private battleCounter = 0;
  private readonly seed?: number;
  private opts: { loadout?: Loadout; stage?: number };

  constructor(seed?: number, opts: { loadout?: Loadout; stage?: number } = {}) {
    this.seed = seed;
    this.opts = opts;
    this.s = new BattleState(seed, ++this.battleCounter, opts);
    this.enemyAI = new EnemyAI(this.s);
    this.magic = new MagicEngine(this.s, this.enemyAI);
    this.harness = new HarnessEngine(this.s, this.magic);
    this.magic.harness = this.harness;
    this.intro();
  }

  /** 次の戦闘（reset）から使うスキルとステージを設定する */
  configure(opts: { loadout?: Loadout; stage?: number }): void {
    this.opts = { ...this.opts, ...opts };
  }

  /** 戦闘中にスキルを覚えたとき、今の戦闘にもすぐ反映する（魔力の上限・回復も） */
  applyLoadoutNow(loadout: Loadout): void {
    this.opts = { ...this.opts, loadout };
    this.s.loadout = loadout;
    this.s.mana.max = loadout.manaMax;
    this.s.mana.regenPerSec = loadout.manaRegen;
    this.version++;
  }

  reset(): void {
    const seed = this.seed !== undefined ? this.seed + this.battleCounter : undefined;
    this.s = new BattleState(seed, ++this.battleCounter, this.opts);
    this.enemyAI = new EnemyAI(this.s);
    this.magic = new MagicEngine(this.s, this.enemyAI);
    this.harness = new HarnessEngine(this.s, this.magic);
    this.magic.harness = this.harness;
    this.intro();
    this.version++;
  }

  private intro(): void {
    this.s.log('system', `— ステージ${this.s.stage} 戦闘開始 — 呪文を唱えて魔法を行使せよ。`);
  }

  get battleId(): number {
    return this.s.battleId;
  }

  /** ms 分だけシミュレーションを進める（TICK_MS 単位） */
  advance(ms: number): void {
    const n = Math.floor(ms / TICK_MS);
    for (let i = 0; i < n; i++) this.step();
  }

  step(): void {
    const s = this.s;
    if (s.phase !== 'battle') return;
    s.time += TICK_MS;
    s.events = [];

    s.mana.regen(TICK_MS);
    s.enemyMana.regen(TICK_MS);
    if (s.loadout.hpRegen > 0 && s.player.hp > 0) {
      s.hpRegenAcc += (s.loadout.hpRegen * TICK_MS) / 1000;
      if (s.hpRegenAcc >= 1) {
        const n = Math.floor(s.hpRegenAcc);
        s.hpRegenAcc -= n;
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + n);
      }
    }
    if (s.player.shield && s.time >= s.player.shield.until) {
      s.player.shield = null;
      s.log('magic', '防御障壁が消えた');
    }
    if (s.enemy.shield && s.time >= s.enemy.shield.until) s.enemy.shield = null;
    if (s.enemy.frozenUntil && s.time >= s.enemy.frozenUntil) {
      s.enemy.frozenUntil = 0;
      s.log('enemy', '敵の凍結が解けた');
    }
    if (s.wet.length) s.wet = s.wet.filter((w) => w.until > s.time);
    if (s.reactiveWard && s.time >= s.reactiveWard.expiresAt) {
      s.reactiveWard = null;
      s.log('magic', '反応障壁の待機が切れた');
    }

    this.enemyAI.update();
    this.processSpellQueue();
    this.checkReactiveWard();
    this.resolveAttacks();

    this.harness.onEvents(s.events);
    this.harness.tick();

    s.fx = s.fx.filter((f) => s.time - f.at < FX_LIFETIME_MS);
    this.checkEnd();
    this.version++;
  }

  // ------------------------------------------------------------ 詠唱キュー

  /** 詠唱の受付。解釈結果を待つ状態になる */
  submitSpell(text: string): SpellEntry | { error: string } {
    const s = this.s;
    const trimmed = text.trim();
    if (s.phase !== 'battle') return { error: '戦闘は終了している' };
    if (!trimmed) return { error: '詠唱が空' };
    if (trimmed.length > SPELL_LIMITS.MAX_INPUT_CHARS) return { error: `詠唱が長すぎる（${SPELL_LIMITS.MAX_INPUT_CHARS}文字まで）` };
    const entry: SpellEntry = {
      id: s.nextId(),
      text: trimmed,
      status: 'interpreting',
      submittedAt: s.time,
      reasoning: [],
    };
    s.spells.push(entry);
    if (s.spells.length > 30) s.spells.splice(0, s.spells.length - 30);
    s.log('player', `詠唱「${trimmed}」`);
    this.version++;
    return entry;
  }

  /**
   * 解釈結果を適用する。
   * - battleId が違う（リセット後に届いた）→ 破棄
   * - すでにキャンセル/処理済み → 破棄
   * - スキーマ不正 → 不発（理由を表示）
   */
  applyInterpretation(entryId: number, battleId: number, result: InterpretationResult): boolean {
    const s = this.s;
    if (battleId !== s.battleId) return false;
    const entry = s.spells.find((e) => e.id === entryId);
    if (!entry || entry.status !== 'interpreting') return false;

    if (!result.ok) {
      entry.status = 'failed';
      entry.error = result.error;
      s.log('error', `詠唱失敗: ${result.error}`);
      this.version++;
      return true;
    }
    const v = validateSpell(result.spell);
    if (!v.ok) {
      entry.status = 'failed';
      entry.error = v.error;
      s.log('error', `術式を拒否: ${v.error}`);
      this.version++;
      return true;
    }
    const spell = v.spell;
    const locked = lockedParts(spell, s.loadout);
    if (locked.length > 0) {
      entry.status = 'failed';
      entry.error = `まだ覚えていない: ${locked.join('、')}（スキルツリーで解放）`;
      s.log('error', entry.error);
      this.version++;
      return true;
    }
    const spent = spell.actions.find((a) => a.type === 'ATTACK' && ELEMENTS[a.element].oncePerBattle && s.usedOnce.has(a.element));
    if (spent && spent.type === 'ATTACK') {
      entry.status = 'failed';
      entry.error = `${ELEMENTS[spent.element].name}は1回の戦闘で1度しか使えない`;
      s.log('error', entry.error);
      this.version++;
      return true;
    }
    entry.spell = spell;
    entry.reasoning = spell.reasoning;
    for (const r of spell.reasoning) s.log('ai', `解釈: ${r}`);
    const cost = computeSpellCost(entry.text, spell, s.loadout);
    entry.cost = cost;

    const allNoop = spell.actions.every((a) => a.type === 'NOOP');
    if (allNoop) {
      s.mana.spend(Math.min(cost.total, s.mana.current));
      entry.status = 'failed';
      const reasons = spell.actions.map((a) => (a.type === 'NOOP' ? a.reason : '')).join(' / ');
      entry.error = reasons;
      s.log('error', `魔法は発動しなかった: ${reasons}（魔力-${cost.total}）`);
      this.version++;
      return true;
    }
    if (cost.total > s.mana.max) {
      entry.status = 'failed';
      entry.error = `必要魔力 ${cost.total} が最大魔力 ${s.mana.max} を超えている。術式を簡潔にせよ`;
      s.log('error', entry.error);
      this.version++;
      return true;
    }
    entry.status = 'waiting_mana';
    if (!s.mana.canAfford(cost.total)) {
      s.log('mana', `魔力不足（必要${cost.total} / 現在${Math.floor(s.mana.current)}）。回復を待って詠唱する…`);
    }
    this.processSpellQueue();
    this.version++;
    return true;
  }

  /** 詠唱: 受付 → 解釈（ブラウザ内で即時）→ 魔力待ち・詠唱へ */
  cast(text: string): CastResult {
    const entry = this.submitSpell(text);
    if (!('id' in entry)) return { ok: false, error: entry.error };
    let result: InterpretationResult;
    try {
      result = { ok: true, spell: interpretSpell(entry.text) };
    } catch (e) {
      result = { ok: false, error: `解釈エラー: ${(e as Error).message}` };
    }
    this.applyInterpretation(entry.id, this.battleId, result);
    return { ok: true, entryId: entry.id };
  }

  cancelSpell(entryId: number): boolean {
    const s = this.s;
    const entry = s.spells.find((e) => e.id === entryId);
    if (!entry) return false;
    if (entry.status === 'interpreting' || entry.status === 'waiting_mana') {
      entry.status = 'cancelled';
      s.log('system', `詠唱「${entry.text}」をキャンセル`);
    } else if (entry.status === 'casting') {
      entry.status = 'cancelled';
      s.log('system', `詠唱「${entry.text}」を中断（消費した魔力は戻らない）`);
    } else return false;
    this.version++;
    return true;
  }

  get casting(): SpellEntry | undefined {
    return this.s.spells.find((e) => e.status === 'casting');
  }

  private processSpellQueue(): void {
    const s = this.s;
    const current = this.casting;
    if (current && current.castEndAt !== undefined && s.time >= current.castEndAt) {
      current.status = 'done';
      s.log('magic', `詠唱完了「${current.text}」`);
      let chain = 0;
      const actions = current.resolvedActions ?? current.spell!.actions;
      actions.forEach((a, i) =>
        this.magic.execute(a, 'spell', current.text, a.type === 'ATTACK' ? chain++ : 0, current.rolledIndexes?.includes(i) ?? false),
      );
    }
    if (this.casting) return;
    // 先頭の待機中の詠唱から順番に
    const next = s.spells.find((e) => e.status === 'waiting_mana');
    if (!next || !next.cost) return;
    if (!s.mana.spend(next.cost.total)) return;
    next.status = 'casting';
    this.resolveMoves(next);
    next.castStartAt = s.time;
    next.castEndAt = s.time + next.cost.castTimeMs;
    s.log('mana', `魔力-${next.cost.total} 詠唱開始（${(next.cost.castTimeMs / 1000).toFixed(2)}秒）`);
    if (next.cost.castTimeMs === 0) this.processSpellQueue();
  }

  /**
   * 詠唱開始時に移動の距離を確定させ、そのマス数で詠唱時間を決め直す。
   * - 距離の指定なし → その方向に実際に動けるマス数（1〜端まで）からランダム
   *   （予兆回避つきなら、今の時点で予兆の無いマスの中から）
   * - 指定が盤面より大きい → 詠唱時間は動ける分だけで計算（実行時に制限のログが出る）
   */
  private resolveMoves(entry: SpellEntry): void {
    const s = this.s;
    const rolled: number[] = [];
    const resolved = entry.spell!.actions.map((a, i) => {
      if (a.type !== 'MOVE' || a.direction === 'auto' || a.distance !== null) return a;
      const maxS = GridSystem.maxSteps(s.player.pos, a.direction);
      if (maxS === 0) return a;
      const all = Array.from({ length: maxS }, (_, k) => k + 1);
      const danger = a.avoidDanger ? s.dangerCells('player') : [];
      const safe = all.filter((n) => !GridSystem.contains(danger, GridSystem.step(s.player.pos, a.direction as Exclude<typeof a.direction, 'auto'>, n)));
      const d = s.rng.pick(safe.length > 0 ? safe : all);
      rolled.push(i);
      if (a.avoidDanger) {
        s.log('ai', safe.length > 0
          ? `推論: 距離指定なし → 予兆の無いマス（${safe.join('・')}マス先）の中から${d}マスを選択`
          : `推論: 動ける範囲に予兆の無いマスが無い。ランダムに${d}マス（被弾の危険）`);
      }
      return { ...a, distance: d };
    });
    // 時間は「実際に動けるマス数」で計算する
    const forTime = resolved.map((a) =>
      a.type === 'MOVE' && a.direction !== 'auto' && a.distance !== null
        ? { ...a, distance: Math.max(1, Math.min(a.distance, GridSystem.maxSteps(s.player.pos, a.direction))) }
        : a,
    );
    entry.resolvedActions = resolved;
    entry.rolledIndexes = rolled;
    const ms = spellCastTimeMs(forTime, rolled, s.loadout);
    if (entry.cost) entry.cost = { ...entry.cost, castTimeMs: ms };
    for (const i of rolled) {
      const a = resolved[i];
      if (a.type === 'MOVE') s.log('magic', `距離が曖昧 → ランダムで${a.distance}マスに決定（詠唱${(ms / 1000).toFixed(1)}秒）`);
    }
  }

  // ------------------------------------------------------------ 戦闘解決

  private checkReactiveWard(): void {
    const s = this.s;
    const w = s.reactiveWard;
    if (!w) return;
    const incoming = s.attacks.find(
      (a) =>
        a.field === 'player' &&
        a.resolveAt - s.time <= SPELL_LIMITS.REACTIVE_WARD_LEAD_MS &&
        GridSystem.contains(a.cells, s.player.pos),
    );
    if (!incoming) return;
    s.player.shield = { reduction: w.reduction, until: s.time + SPELL_LIMITS.REACTIVE_WARD_DURATION_MS };
    s.reactiveWard = null;
    s.log('magic', `着弾直前！反応障壁が展開（${Math.round(w.reduction * 100)}%軽減）`);
  }

  private resolveAttacks(): void {
    const s = this.s;
    const due = s.attacks.filter((a) => a.resolveAt <= s.time);
    if (due.length === 0) return;
    s.attacks = s.attacks.filter((a) => a.resolveAt > s.time);
    due.sort((a, b) => a.resolveAt - b.resolveAt || a.id - b.id);
    for (const a of due) this.resolveAttack(a);
  }

  private resolveAttack(a: PendingAttack): void {
    const s = this.s;
    const target = s.combatant(a.field);
    const hit = GridSystem.contains(a.cells, target.pos);
    s.fx.push({ id: s.nextId(), field: a.field, cells: a.cells, element: a.element, at: s.time, hit });
    const fx = a.owner === 'player' && a.element !== 'dark' ? (ELEMENTS[a.element].effects ?? {}) : {};

    // 濡らす魔法: 当たり外れに関係なく着弾マスを濡らす
    if (fx.wet) {
      const until = s.time + s.loadout.wetMs;
      for (const c of a.cells) {
        const w = s.wet.find((x) => x.x === c.x && x.y === c.y);
        if (w) w.until = until;
        else s.wet.push({ x: c.x, y: c.y, until });
      }
    }

    // 大魔法は当たり外れに関係なく、着弾の瞬間に全画面演出
    if (a.owner === 'player' && a.element !== 'dark' && ELEMENTS[a.element].ultimate) s.cinematic(a.element);

    if (!hit) {
      s.log(a.owner === 'player' ? 'magic' : 'enemy', a.owner === 'player' ? `${a.label}は外れた` : `敵の「${a.label}」を回避した`);
      return;
    }

    let mult = 1;
    const bonus: string[] = [];
    const lo = s.loadout;
    if (a.owner === 'player') {
      if (fx.shock && s.isWet(target.pos)) {
        mult *= lo.thunderWetMult;
        bonus.push(`感電×${lo.thunderWetMult}`);
      }
      if (fx.melt && s.isFrozen('enemy')) {
        mult *= lo.meltMult;
        bonus.push(`融解×${lo.meltMult}`);
        s.enemy.frozenUntil = 0;
      }
      if (fx.execute && s.enemy.hp <= s.enemy.maxHp * fx.execute.below) {
        mult *= fx.execute.mult;
        bonus.push(`死の宣告×${fx.execute.mult}`);
      }
      if (lo.finisherMult > 1 && s.enemy.hp <= s.enemy.maxHp * 0.25) {
        mult *= lo.finisherMult;
        bonus.push(`処刑×${lo.finisherMult}`);
      }
    }
    let reduction = target.shield ? target.shield.reduction : 0;
    if (a.owner === 'enemy' && a.element === 'thunder') reduction *= 1 - DAMAGE.THUNDER_PIERCE;
    if (fx.pierce && reduction > 0) {
      reduction = 0;
      bonus.push('結界貫通');
    }
    const dmg = fx.halve ? Math.ceil(target.hp / 2) : Math.max(1, Math.round(a.damage * mult * (1 - reduction)));
    if (fx.halve) bonus.splice(0, bonus.length, 'HP半減');
    target.hp = Math.max(0, target.hp - dmg);
    const shieldNote = reduction > 0 ? `（障壁で${Math.round(reduction * 100)}%軽減）` : '';
    if (a.owner === 'player') {
      const b = bonus.length ? `【${bonus.join('・')}】` : '';
      s.log('magic', `💥 ${a.label}が命中！${b} 敵に${dmg}ダメージ${shieldNote}`);
      if (fx.freeze) {
        const ms = typeof fx.freeze === 'number' ? fx.freeze : lo.freezeMs;
        s.enemy.frozenUntil = Math.max(s.enemy.frozenUntil, s.time + ms);
        this.enemyAI.onFrozen();
        s.log('magic', `凍結！ 敵は${ms / 1000}秒間動けない`);
      }
      if (fx.drain) {
        const heal = Math.max(1, Math.round(dmg * fx.drain));
        const before = s.player.hp;
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + heal);
        if (s.player.hp > before) s.log('magic', `吸収: HP ${before} → ${s.player.hp}`);
      }
      if (fx.manaBreak) {
        s.enemyMana.current = Math.max(0, s.enemyMana.current - fx.manaBreak);
        s.log('magic', fx.manaBreak >= s.enemyMana.max ? '魔力破壊: 敵の魔力をすべて消し去った' : `魔力破壊: 敵の魔力-${fx.manaBreak}`);
      }
      if (lo.manaLeech > 0) s.mana.current = Math.min(s.mana.max, s.mana.current + lo.manaLeech);
    } else {
      s.log('enemy', `敵の「${a.label}」が命中… ${dmg}ダメージ${shieldNote}`);
      s.emit({ type: 'PLAYER_HIT', attack: a });
    }
  }

  private checkEnd(): void {
    const s = this.s;
    if (s.enemy.hp <= 0) {
      s.phase = 'victory';
      s.attacks = [];
      s.log('system', '★ 勝利！ 敵の術式核は崩壊した。');
    } else if (s.player.hp <= 0) {
      s.phase = 'defeat';
      s.attacks = [];
      s.log('system', '✖ 敗北… 詠唱は途絶えた。');
    }
    if (s.phase !== 'battle') {
      for (const e of s.spells) if (['interpreting', 'waiting_mana', 'casting'].includes(e.status)) e.status = 'cancelled';
    }
  }
}

/** スキルで解放されていない部分（魔法名・コマンド名）を返す */
export function lockedParts(spell: Spell, lo: Loadout): string[] {
  const out = new Set<string>();
  const check = (a: Action) => {
    switch (a.type) {
      case 'ATTACK':
        if (!lo.spells.has(a.element)) out.add(ELEMENTS[a.element].name);
        if (a.target === 'ENEMY_PREDICTED' && !lo.commands.has('predict')) out.add('プレディクト');
        if (a.delayMs < 900 && !lo.commands.has('quick')) out.add('クイック');
        if (a.boost && !lo.commands.has('boost')) out.add('パワー');
        break;
      case 'DEFEND':
        if (a.timing === 'BEFORE_IMPACT' ? !lo.commands.has('counter') : !lo.commands.has('guard')) out.add(a.timing === 'BEFORE_IMPACT' ? 'カウンターガード' : 'ガード');
        break;
      case 'HEAL':
        if (!lo.commands.has('heal')) out.add('ヒール');
        break;
      case 'REGISTER_AUTOMATION':
        if (!lo.commands.has('auto')) out.add('自律術式');
        a.harness.actions.forEach(check);
        break;
    }
  };
  spell.actions.forEach(check);
  return [...out];
}
