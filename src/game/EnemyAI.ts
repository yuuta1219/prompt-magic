/**
 * 敵AI（ルールベース）。LLMは使わない。
 *
 * - 一定間隔で「移動 / 攻撃詠唱 / 防御」を行う
 * - 次の行動と次の移動先は「一手先」まで事前に決めておく
 *   → プレイヤーが「敵の次の移動先を予測して」と詠唱すると、エンジンはこの計画を読める
 * - プレイヤーの魔法の予兆を見て、確率で回避する
 */
import { COST, ENEMY, GRID_SIZE } from './constants';
import { actionManaCost } from './ManaSystem';
import { GridSystem } from './GridSystem';
import type { BattleState } from './BattleState';
import type { AttackElement, PendingAttack, Vec } from './types';
import type { Shape } from '../interpreter/schema';

type EnemyAction = 'move' | 'attack' | 'guard';

/** ボスのギミック。ふつうの攻撃にまぜて、ボスだけの大技を使ってくる */
export type BossKind = 'cerberus' | 'tower' | 'moderator' | 'chimera' | 'stationmaster' | 'ghost' | 'aegis' | 'oracle' | 'oracle-final';

/** ボスの大技の名前（ログと画面に出る） */
export const BOSS_MOVE_NAMES: Record<BossKind, string[]> = {
  cerberus: ['三つ首の咆哮'],
  tower: ['電波塔の影'],
  moderator: ['静粛に'],
  chimera: ['継ぎはぎの大技'],
  stationmaster: ['発車ベル'],
  ghost: ['炎上'],
  aegis: ['魔法陣の十字', '魔法陣の斜め'],
  oracle: ['全術式同時詠唱'],
  'oracle-final': ['三つ首の咆哮', '電波塔の影', '炎上', '発車ベル'],
};

/** ラスボスのフィアト・ノクス: 詠唱の長さ・ダメージ・最低限残す HP */
export const NOX_CAST_MS = 5000;
export const NOX_DAMAGE = 50;
export const NOX_LEAVE_HP = 30;
/** フィアト・ノクスのあと、ラスボスが何もしない時間 */
export const NOX_REST_MS = 10_000;

/** 負けイベントのオラクルが、最後の術式（必ず負ける）を唱える時刻 */
export const ORACLE_FINAL_AT = 50_000;

interface Pattern {
  label: string;
  shape: Shape;
  damage: number;
  element: AttackElement;
  castScale: number;
  /** 効果コスト（プレイヤーの属性魔法の cost と同じ意味。実際の消費は ATTACK_BASE と複雑度を足した値） */
  cost: number;
}

export const ENEMY_PATTERNS: Pattern[] = [
  { label: '黒炎弾', shape: 'square3', damage: 13, element: 'fire', castScale: 1.0, cost: 34 },
  { label: '雷槍', shape: 'column', damage: 16, element: 'thunder', castScale: 1.1, cost: 32 },
  { label: '薙ぎ払い', shape: 'row', damage: 15, element: 'wind', castScale: 1.1, cost: 32 },
  { label: '十字氷晶', shape: 'cross', damage: 14, element: 'ice', castScale: 0.95, cost: 33 },
  { label: '狙撃魔弾', shape: 'single', damage: 22, element: 'dark', castScale: 0.9, cost: 40 },
];
const PATTERNS = ENEMY_PATTERNS;

/** 敵の行動の魔力（プレイヤーと同じ式。呪文を唱えないので詠唱トークン分だけ無い） */
export function enemyAttackCost(p: Pattern): number {
  return COST.ATTACK_BASE + p.cost + COST.PER_COMPLEXITY * 1;
}
export function enemyMoveCost(cells: number, avoid = false): number {
  return actionManaCost({ type: 'MOVE', direction: 'up', distance: Math.max(1, cells), avoidDanger: avoid });
}
export function enemyGuardCost(): number {
  return actionManaCost({ type: 'DEFEND', reduction: ENEMY.GUARD_REDUCTION, durationMs: ENEMY.GUARD_DURATION_MS, timing: 'NOW' });
}

export class EnemyAI {
  nextThinkAt = 1200;
  /** 負けイベントのオラクル: 何回目の同時詠唱か / 最後の術式を唱えたか */
  private volleys = 0;
  /** ラスボスがフィアト・ノクスを使ったか */
  noxUsed = false;
  private finalCast = false;
  /** ボスが次に大技を使えるようになる時刻 */
  bossReadyAt = 4000;
  nextAction: EnemyAction = 'move';
  plannedMove: Vec;
  /** 予定された回避 */
  private dodgePlan: { at: number; to: Vec } | null = null;

  constructor(private readonly s: BattleState) {
    this.plannedMove = this.planMove(s.enemy.pos);
  }

  get isCasting(): boolean {
    return this.s.attacks.some((a) => a.owner === 'enemy');
  }

  get enraged(): boolean {
    return this.s.enemy.hp <= this.s.enemy.maxHp / 2;
  }

  /** 指定時刻に敵がいるであろう位置（エンジンの予測。完璧ではない） */
  predictPosition(atTime: number): Vec {
    if (this.nextAction === 'move' && this.nextThinkAt <= atTime) return { ...this.plannedMove };
    return { ...this.s.enemy.pos };
  }

  update(): void {
    const s = this.s;
    if (s.isFrozen('enemy')) {
      // 凍結中は何もできない（予定していた回避も失敗）
      if (this.dodgePlan) {
        this.dodgePlan = null;
        s.log('enemy', '敵は凍りついて回避できない');
      }
      return;
    }
    if (this.dodgePlan && s.time >= this.dodgePlan.at) {
      const to = this.dodgePlan.to;
      this.dodgePlan = null;
      if (!s.isDanger('enemy', to)) {
        s.enemy.pos = to;
        s.log('enemy', `敵は予兆を察知して (${to.x},${to.y}) へ回避した`);
        this.plannedMove = this.planMove(to);
      }
    }

    // ラスボス: HP が半分を切ったら、一度だけフィアト・ノクス（やにかわの最終魔法）を撃ち返してくる
    if (s.boss === 'oracle-final' && this.enraged && !this.noxUsed && !this.isCasting) {
      this.noxUsed = true;
      this.castFiatNox();
      // 撃ったあとは10秒、何もしてこない（立て直す時間）
      this.nextThinkAt = Math.max(this.nextThinkAt, s.time + NOX_CAST_MS + NOX_REST_MS);
      this.bossReadyAt = Math.max(this.bossReadyAt, s.time + NOX_CAST_MS + NOX_REST_MS);
      return;
    }

    if (s.time < this.nextThinkAt) return;

    // 敵は魔力を使わない。決めておいた行動をそのまま行う
    const action = this.nextAction;
    if (action === 'attack' && !this.isCasting) this.castAttack();
    else if (action === 'guard') this.guard();
    else this.move();

    // 群れのほかの敵も、ときどき1マス動く（攻撃はリーダーがまとめて行う）
    for (const o of s.others) {
      if (!s.rng.chance(0.5)) continue;
      const to = GridSystem.clamp({ x: o.pos.x + s.rng.int(-1, 1), y: o.pos.y + s.rng.int(-1, 1) });
      if (!s.foes().some((f) => f.pos.x === to.x && f.pos.y === to.y)) o.pos = to;
    }

    // 行動の間隔はステージで決まり、毎回 ±30% ゆらぐ（暴走中は短くなる）
    const base = s.enemyThinkMs;
    const interval = this.enraged ? Math.round(base * (ENEMY.ENRAGED_THINK_INTERVAL_MS / ENEMY.THINK_INTERVAL_MS)) : base;
    this.nextThinkAt = s.time + Math.round(interval * (0.7 + s.rng.next() * 0.6));
    this.nextAction = this.decideNext();
  }

  private decideNext(): EnemyAction {
    const r = this.s.rng.next();
    const lowHp = this.s.enemy.hp < this.s.enemy.maxHp * 0.4;
    if (this.s.boss === 'aegis' && !this.s.enemy.shield && r < 0.3) return 'guard';
    if (lowHp && r < 0.15) return 'guard';
    if (r < (this.enraged ? 0.55 : 0.45)) return 'attack';
    return 'move';
  }

  private planMove(from: Vec): Vec {
    const rng = this.s.rng;
    for (let i = 0; i < 10; i++) {
      const dx = rng.int(-2, 2);
      const dy = rng.int(-2, 2);
      if (dx === 0 && dy === 0) continue;
      const to = GridSystem.clamp({ x: from.x + dx, y: from.y + dy });
      if (to.x !== from.x || to.y !== from.y) return to;
    }
    return GridSystem.clamp({ x: from.x + 1, y: from.y });
  }

  private move(): boolean {
    const s = this.s;
    // 群れの仲間がいるマスには入らない（次の行き先を決め直すだけ）
    if (s.others.some((o) => o.pos.x === this.plannedMove.x && o.pos.y === this.plannedMove.y)) {
      this.plannedMove = this.planMove(s.enemy.pos);
      return false;
    }
    s.enemy.pos = { ...this.plannedMove };
    s.log('enemy', `敵が (${s.enemy.pos.x},${s.enemy.pos.y}) へ移動`);
    this.plannedMove = this.planMove(s.enemy.pos);
    return true;
  }

  private guard(): boolean {
    const s = this.s;
    s.enemy.shield = { reduction: ENEMY.GUARD_REDUCTION, until: s.time + ENEMY.GUARD_DURATION_MS };
    s.log('enemy', `敵が防御結界を展開（${Math.round(ENEMY.GUARD_REDUCTION * 100)}%軽減）`);
    return true;
  }

  /** 攻撃をランダムに選んで唱える */
  private castAttack(): boolean {
    const s = this.s;
    // ボスは、大技の待ち時間が明けていれば大技（負けイベントのオラクルは毎回）
    if (s.boss && s.time >= this.bossReadyAt && (s.boss === 'oracle' || s.rng.chance(0.7))) {
      this.bossMove();
      // 大技のあとは、しばらく普通の攻撃だけ（切れ目なく大技が続くと避けようがない）
      const [lo, hi] = s.boss === 'oracle' ? [6000, 8000] : this.enraged ? [7000, 10000] : [8000, 12000];
      this.bossReadyAt = s.time + s.rng.int(lo, hi);
      return true;
    }
    const p = s.rng.pick(PATTERNS);
    // 照準は概ねプレイヤーの位置。少しブレる
    const aim = GridSystem.clamp({
      x: s.player.pos.x + (s.rng.chance(0.25) ? s.rng.int(-1, 1) : 0),
      y: s.player.pos.y + (s.rng.chance(0.25) ? s.rng.int(-1, 1) : 0),
    });
    const cells = GridSystem.shapeCells(aim, p.shape);
    const castMs = Math.round(s.rng.int(ENEMY.CAST_MIN_MS, ENEMY.CAST_MAX_MS) * p.castScale);
    const dmg = Math.round(p.damage * s.enemyPower * (this.enraged ? 1.2 : 1));
    const atk = s.addAttack('enemy', 'player', cells, dmg, p.element, castMs, p.label);
    s.log('enemy', `敵が「${p.label}」の詠唱を開始！ ${(castMs / 1000).toFixed(1)}秒後に着弾`);
    s.emit({ type: 'ENEMY_CAST_START', attack: atk });
    return true;
  }

  // ---------------------------------------------------------------- ボスの大技

  private inGrid = (c: Vec) => c.x >= 0 && c.y >= 0 && c.x < GRID_SIZE && c.y < GRID_SIZE;
  private all(): Vec[] {
    const out: Vec[] = [];
    for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) out.push({ x, y });
    return out;
  }
  /** 大技を1つ予告する（ダメージ・詠唱時間はステージの強さに合わせる） */
  private bossHit(cells: Vec[], baseDmg: number, element: AttackElement, castMs: number, label: string): void {
    const s = this.s;
    // 負けイベントのオラクルはステージの強さを掛けない（いろんな魔法が一度に来るが、数発では倒れない）
    // 最終オラクルは全ボスの大技を使うぶん、1つずつは少し軽く
    const scale = s.boss === 'oracle-final' ? 0.7 : 1;
    const dmg = s.boss === 'oracle' ? Math.round(baseDmg) : Math.round(baseDmg * scale * s.enemyPower * (this.enraged ? 1.15 : 1));
    const atk = s.addAttack('enemy', 'player', cells.filter(this.inGrid), dmg, element, castMs, label);
    s.emit({ type: 'ENEMY_CAST_START', attack: atk });
  }

  /** ボスの大技 */
  private bossMove(): boolean {
    const s = this.s;
    const kind = s.boss!;
    const p = s.player.pos;
    const base = s.rng.int(ENEMY.CAST_MIN_MS, ENEMY.CAST_MAX_MS);
    const pick = kind === 'oracle-final' || kind === 'chimera' ? s.rng.pick(['cerberus', 'tower', 'ghost', 'stationmaster'] as const) : kind;
    const say = (name: string, note: string) => s.log('enemy', `ボスの大技「${name}」！ ${note}`);
    switch (pick) {
      case 'cerberus': {
        // 左・真ん中・右の3列。全部同時に赤くなるが、着弾は1つずつずれている
        const order = s.rng.shuffle([0, 1, 2]);
        order.forEach((band, i) => {
          const cells = this.all().filter((c) => Math.floor(c.x / 3) === band);
          this.bossHit(cells, 16, 'fire', Math.max(base, 3000) + i * 3000, `三つ首の咆哮（${['左', '真ん中', '右'][band]}）`);
        });
        say('三つ首の咆哮', '三つの列が時間差で燃える。よく見て、最後に燃える列へ');
        return true;
      }
      case 'tower': {
        // 9マスの東京タワーの形（てっぺん・展望台・脚）
        const shape = [[0, -3], [0, -2], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-2, 1], [2, 1]];
        const aim = { x: Math.min(6, Math.max(2, p.x)), y: Math.min(7, Math.max(3, p.y + (s.rng.chance(0.5) ? 0 : 1))) };
        this.bossHit(shape.map(([dx, dy]) => ({ x: aim.x + dx, y: aim.y + dy })), 24, 'thunder', Math.round(base * 1.1), '電波塔の影');
        // 怒ると、もう1本ずらして建てる
        if (this.enraged) {
          const aim2 = { x: aim.x < 4 ? aim.x + 4 : aim.x - 4, y: aim.y };
          this.bossHit(shape.map(([dx, dy]) => ({ x: aim2.x + dx, y: aim2.y + dy })), 24, 'thunder', Math.round(base * 1.1) + 800, '電波塔の影');
        }
        say('電波塔の影', 'タワーの形に雷が落ちる。脚のすき間は安全');
        return true;
      }
      case 'moderator': {
        // 盤面ぜんぶ。3×3 の「発言が許された場所」だけ安全
        const safe = { x: s.rng.int(1, 7), y: s.rng.int(1, 7) };
        const cells = this.all().filter((c) => Math.abs(c.x - safe.x) > 1 || Math.abs(c.y - safe.y) > 1);
        this.bossHit(cells, 19, 'dark', Math.round(base * 1.6), '静粛に');
        say('静粛に', '盤面の全部が対象。光っていない 3×3 に逃げ込め');
        return true;
      }
      case 'stationmaster': {
        // 3本の列車（横一列）が、時間差で走り抜ける。1本は今いる列
        const rows = [p.y, ...s.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((r) => r !== p.y)).slice(0, 2)];
        s.rng.shuffle(rows).forEach((r, i) => {
          this.bossHit(this.all().filter((c) => c.y === r), 20, 'earth', base + i * 800, '発車ベル');
        });
        say('発車ベル', '3本の列車が時間差で走り抜ける');
        return true;
      }
      case 'ghost': {
        // 炎上：今いるマスから、輪になって燃え広がる
        for (let r = 0; r <= 2; r++) {
          const ring = this.all().filter((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) === r);
          this.bossHit(ring, 16, 'fire', base + r * 700, '炎上');
        }
        say('炎上', '足もとから燃え広がる。遠くへ逃げろ');
        return true;
      }
      case 'aegis': {
        // 魔法陣の十字か斜め（盤面の端から端まで）
        const diag = s.rng.chance(0.5);
        const cells = this.all().filter((c) => (diag ? Math.abs(c.x - p.x) === Math.abs(c.y - p.y) : c.x === p.x || c.y === p.y));
        this.bossHit(cells, 14, 'ice', base, diag ? '魔法陣の斜め' : '魔法陣の十字');
        say(diag ? '魔法陣の斜め' : '魔法陣の十字', '盤面の端まで届く');
        return true;
      }
      case 'oracle': {
        // 全術式同時詠唱：あらゆる魔法を一度に。負けイベント。
        // 1発ずつは軽いが、唱えるたびに同時に来る数が増え、50秒たつと盤面すべてを消す最後の術式で終わる
        if (this.finalCast) return true;
        if (s.time >= ORACLE_FINAL_AT) {
          this.finalCast = true;
          this.bossHit(this.all(), 9999, 'dark', 4500, '最終術式・全域消去');
          say('最終術式・全域消去', '盤面のすべてが消える。逃げ場は、ない');
          return true;
        }
        this.volleys++;
        const n = Math.min(9, 2 + this.volleys);
        for (let i = 0; i < n; i++) {
          const pat = s.rng.pick(PATTERNS);
          const aim = GridSystem.clamp({ x: p.x + s.rng.int(-2, 2), y: p.y + s.rng.int(-2, 2) });
          this.bossHit(GridSystem.shapeCells(aim, pat.shape), Math.round(pat.damage * 0.6), pat.element, Math.round(base * 0.7) + i * 250, pat.label);
        }
        const band = s.rng.int(0, 2);
        this.bossHit(this.all().filter((c) => Math.floor(c.x / 3) === band), 5, 'dark', Math.round(base * 0.9), '断罪の列');
        say('全術式同時詠唱', `あなたが唱えてきた魔法が、${n}つ同時に来る`);
        return true;
      }
    }
    return false;
  }

  /** プレイヤーの攻撃予兆が出たとき */
  onIncoming(atk: PendingAttack): void {
    const s = this.s;
    if (!GridSystem.contains(atk.cells, s.enemy.pos)) return;
    if (s.isFrozen('enemy')) return;
    const delaySec = (atk.resolveAt - s.time) / 1000;
    const chance = Math.min(ENEMY.DODGE_CHANCE_MAX, ENEMY.DODGE_CHANCE_PER_SEC * delaySec);
    if (!s.rng.chance(chance)) return;
    const safe = GridSystem.neighbors8(s.enemy.pos).filter((c) => !GridSystem.contains(atk.cells, c));
    if (safe.length === 0) return;
    const reactAt = s.time + (atk.resolveAt - s.time) * (0.3 + s.rng.next() * 0.4);
    this.dodgePlan = { at: reactAt, to: s.rng.pick(safe) };
  }

  /** ラスボスのフィアト・ノクス。盤面すべて・50ダメージ。ただし HP は 30 残す（演出はやにかわのものと同じ） */
  private castFiatNox(): void {
    const s = this.s;
    const atk = s.addAttack('enemy', 'player', this.all(), NOX_DAMAGE, 'dark', NOX_CAST_MS, 'フィアト・ノクス');
    atk.cinematic = 'fiat_nox_enemy';
    atk.leaveHp = NOX_LEAVE_HP;
    s.log('enemy', 'オラクルが「フィアト・ノクス」を唱えはじめた――あなたの、最後の魔法を');
    s.emit({ type: 'ENEMY_CAST_START', attack: atk });
  }

  /** 詠唱を乱された（魔力破壊の代わり）: 次の行動と大技を ms だけ遅らせる */
  stall(ms: number): void {
    this.nextThinkAt += ms;
    this.bossReadyAt += ms;
  }

  /** 凍結した: 解けるまで次の行動を遅らせる */
  onFrozen(): void {
    this.nextThinkAt = Math.max(this.nextThinkAt, this.s.enemy.frozenUntil + 300);
  }
}
