/**
 * 魔法の実行。構造化命令（Action）を受け取り、世界の物理法則の範囲内で実行する。
 * 呪文の言葉が何であれ、移動範囲・威力・当たり判定はここ（エンジン）が決める。
 */
import { GRID_SIZE, SPELL_LIMITS } from './constants';
import { ELEMENTS, ELEMENT_RULES } from './elements';
import { GridSystem } from './GridSystem';
import type { BattleState } from './BattleState';
import type { EnemyAI } from './EnemyAI';
import type { HarnessEngine } from './HarnessEngine';
import type { Vec } from './types';
import type { Action, AttackAction, DefendAction, Direction, HealAction, MoveAction } from '../interpreter/schema';
import type { SpellKey } from './elements';

const DIR_JA: Record<Direction, string> = {
  up: '前（敵側）',
  down: '後ろ',
  left: '左',
  right: '右',
  up_left: '左前',
  up_right: '右前',
  down_left: '左後ろ',
  down_right: '右後ろ',
  auto: '自動',
};


export type ExecSource = 'spell' | 'harness';

export class MagicEngine {
  harness: HarnessEngine | null = null;

  constructor(
    private readonly s: BattleState,
    private readonly enemyAI: EnemyAI,
  ) {}

  /**
   * @param rolled 詠唱開始時に距離をランダムで決めた移動か（ログの書き方を変えるだけ）
   */
  execute(action: Action, source: ExecSource, sourceText = '', chainIndex = 0, rolled = false): void {
    switch (action.type) {
      case 'MOVE':
        return this.move(action, source, rolled);
      case 'ATTACK':
        return this.attack(action, chainIndex);
      case 'DEFEND':
        return this.defend(action);
      case 'HEAL':
        return this.heal(action);
      case 'REGISTER_AUTOMATION':
        if (source === 'harness') {
          this.s.log('error', '自律術式の中から自律術式は登録できない（再帰禁止）');
          return;
        }
        this.harness?.register(action.harness, sourceText);
        return;
      case 'NOOP':
        this.s.log('magic', `術式は何も起こさなかった: ${action.reason}`);
        return;
    }
  }

  // ---------------------------------------------------------------- MOVE

  move(a: MoveAction, source: ExecSource, rolled = false): void {
    const s = this.s;
    const from = { ...s.player.pos };
    const danger = a.avoidDanger ? s.dangerCells('player') : [];
    const isSafe = (p: Vec) => !GridSystem.contains(danger, p);
    const tag = source === 'harness' ? '[自律] ' : '';

    if (a.direction === 'auto') {
      // 方向をエンジンに委ねる: 最寄りの安全マス
      if (isSafe(from)) {
        s.log('magic', `${tag}現在地 (${from.x},${from.y}) は安全と判断。移動しない`);
        return;
      }
      const maxR = a.distance ?? 1;
      const cand: Vec[] = [];
      for (let y = 0; y < GRID_SIZE; y++)
        for (let x = 0; x < GRID_SIZE; x++) {
          const p = { x, y };
          const cheb = Math.max(Math.abs(x - from.x), Math.abs(y - from.y));
          if (cheb >= 1 && cheb <= Math.min(maxR, 8) && isSafe(p)) cand.push(p);
        }
      if (cand.length === 0) {
        s.log('magic', `${tag}半径${maxR}マス以内に安全なマスが無い。移動失敗${maxR < 2 ? '（ヒント: 3×3の攻撃は2マス以上動かないと逃げられない）' : ''}`);
        return;
      }
      cand.sort((p, q) => GridSystem.manhattan(p, from) - GridSystem.manhattan(q, from));
      const best = cand.filter((c) => GridSystem.manhattan(c, from) === GridSystem.manhattan(cand[0], from));
      const to = s.rng.pick(best);
      s.player.pos = to;
      s.log('magic', `${tag}安全マスを探索 → (${to.x},${to.y}) へ移動`);
      return;
    }

    const dir = a.direction;
    const maxS = GridSystem.maxSteps(from, dir);
    if (maxS === 0) {
      s.log('magic', `${tag}${DIR_JA[dir]}は盤面の端。これ以上進めない（移動失敗）`);
      return;
    }

    let d: number;
    if (a.distance === null) {
      // 曖昧な指示 → 実際に動けるマス数の中からランダム（自律術式など、詠唱時間を経ない移動のとき）
      const all = Array.from({ length: maxS }, (_, k) => k + 1);
      if (a.avoidDanger) {
        const safeDs = all.filter((n) => isSafe(GridSystem.step(from, dir, n)));
        if (safeDs.length > 0) {
          d = s.rng.pick(safeDs);
          s.log('ai', `${tag}推論: 距離指定なし → 予兆の無いマスの中から${d}マスを選択`);
        } else {
          d = s.rng.pick(all);
          s.log('ai', `${tag}推論: ${DIR_JA[dir]}方向に安全なマスが無い。ランダムに${d}マス移動（被弾の危険）`);
        }
      } else {
        d = s.rng.pick(all);
        s.log('magic', `${tag}距離が曖昧 → ランダムに${d}マス（動ける${maxS}マスの中から）`);
      }
    } else {
      d = a.distance;
      if (d > maxS) {
        if (rolled) s.log('magic', `${tag}詠唱中に位置が変わり、${d}マスは動けない → 端までの${maxS}マスに制限`);
        else s.log('magic', `${tag}${d}マスの移動は物理的に不可能。盤面の端までの${maxS}マスに制限`);
        d = maxS;
      }
      if (a.avoidDanger && !isSafe(GridSystem.step(from, dir, d))) {
        const alt = [...Array(maxS).keys()]
          .map((i) => i + 1)
          .filter((n) => isSafe(GridSystem.step(from, dir, n)))
          .sort((p, q) => Math.abs(p - d) - Math.abs(q - d))[0];
        if (alt !== undefined) {
          s.log('ai', `${tag}推論: 指定の${d}マス先は着弾予定地 → 最も近い安全な${alt}マスに変更`);
          d = alt;
        } else {
          s.log('ai', `${tag}推論: ${DIR_JA[dir]}方向に安全なマスが無い。指定どおり${d}マス移動`);
        }
      }
    }

    const to = GridSystem.step(from, dir, d);
    s.player.pos = to;
    s.log('magic', `${tag}${DIR_JA[dir]}に${d}マス移動 → (${to.x},${to.y})`);
  }

  // ---------------------------------------------------------------- ATTACK

  /**
   * 属性魔法。形と威力は属性で決まる（elements.ts）。
   * @param chainIndex 1回の詠唱の中で何番目の攻撃か。2つ目以降は着弾を少し遅らせ、順番に効果が出るようにする
   */
  attack(a: AttackAction, chainIndex = 0): void {
    const s = this.s;
    const def = ELEMENTS[a.element];
    const delayMs = a.delayMs + chainIndex * ELEMENT_RULES.CHAIN_STAGGER_MS;
    const resolveAt = s.time + delayMs;
    let center: Vec;
    let how: string;
    if (a.target === 'ENEMY_PREDICTED') {
      center = this.enemyAI.predictPosition(resolveAt);
      const moved = center.x !== s.enemy.pos.x || center.y !== s.enemy.pos.y;
      how = moved ? `敵の移動先 (${center.x},${center.y}) を予測` : `敵は動かないと予測 (${center.x},${center.y})`;
    } else if (a.target === 'CELL' && a.cell) {
      center = GridSystem.clamp(a.cell);
      if (center.x !== a.cell.x || center.y !== a.cell.y) s.log('magic', '指定座標が盤面外 → 盤面内に補正');
      how = `座標 (${center.x},${center.y}) を指定`;
    } else {
      center = { ...s.enemy.pos };
      how = `敵の現在地 (${center.x},${center.y}) を照準`;
    }
    const cells = this.cellsFor(a.element, center, resolveAt);
    const lo = s.loadout;
    const baseDamage = a.element === 'fire' ? lo.fireDamage : def.damage;
    const damage = Math.round(baseDamage * lo.branchDmg[def.branch] * (a.boost ? lo.boostMult : 1));
    const boostNote = a.boost ? `【パワー×${lo.boostMult}】` : '';
    const label = a.element === 'water' && lo.waterSize === 5 ? '5×5' : def.shapeLabel;
    const totalDelay = delayMs + (def.delayExtraMs ?? 0);
    const atk = s.addAttack('player', 'enemy', cells, damage, a.element, totalDelay, def.name);
    s.log('magic', `${def.ultimate ? '★★ ' : ''}${boostNote}${def.name}（${label}）を放った — ${how}／${(totalDelay / 1000).toFixed(1)}秒後に着弾`);
    this.enemyAI.onIncoming(atk);
  }

  /** 魔法の形（elements.ts の shape）から、着弾するマスを求める */
  private cellsFor(el: SpellKey, c: Vec, resolveAt: number): Vec[] {
    const s = this.s;
    const shape = ELEMENTS[el].shape;
    const all: Vec[] = [];
    for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) all.push({ x, y });
    const dx = (p: Vec) => Math.abs(p.x - c.x);
    const dy = (p: Vec) => Math.abs(p.y - c.y);
    switch (shape.k) {
      case 'single':
        return [c];
      case 'square': {
        const r = el === 'water' && s.loadout.waterSize === 5 ? 2 : shape.r;
        return all.filter((p) => dx(p) <= r && dy(p) <= r);
      }
      case 'row':
        return all.filter((p) => dy(p) <= (shape.w - 1) / 2);
      case 'col':
        return all.filter((p) => dx(p) <= (shape.w - 1) / 2);
      case 'cross':
        return all.filter((p) => (dx(p) === 0 && dy(p) <= shape.r) || (dy(p) === 0 && dx(p) <= shape.r));
      case 'x':
        return all.filter((p) => dx(p) === dy(p));
      case 'star':
        return all.filter((p) => dx(p) === dy(p) || dx(p) === 0 || dy(p) === 0);
      case 'ring':
        return all.filter((p) => Math.max(dx(p), dy(p)) === shape.r);
      case 'board':
        return all;
      case 'random': {
        const n = el === 'thunder' ? s.loadout.thunderBolts : shape.n;
        return this.randomCells(c, n, shape.r, resolveAt);
      }
    }
  }

  /** ランダム型（サンダーなど）: 濡れたマス（これから濡れるマスも含む）に照準から近い順に落ち、残りは照準周囲からランダム */
  private randomCells(center: Vec, n: number, r: number, resolveAt: number): Vec[] {
    const s = this.s;
    const wet: Vec[] = s.wet.filter((w) => w.until > resolveAt).map((w) => ({ x: w.x, y: w.y }));
    for (const atk of s.attacks)
      if (atk.owner === 'player' && atk.element !== 'dark' && ELEMENTS[atk.element].effects?.wet && atk.resolveAt <= resolveAt)
        for (const c of atk.cells) if (!GridSystem.contains(wet, c)) wet.push(c);
    // 濡れたマスのうち、照準に近いものから落ちる（同じ距離ならランダム）
    const dist = (p: Vec) => Math.max(Math.abs(p.x - center.x), Math.abs(p.y - center.y));
    const pool = wet.filter((p) => dist(p) <= Math.max(r, 2)).map((p) => ({ p, k: dist(p) + s.rng.next() * 0.5 })).sort((a, b) => a.k - b.k);
    const picked: Vec[] = pool.slice(0, n).map((x) => x.p);
    if (picked.length > 0) s.log('magic', `雷が濡れたマスに引き寄せられる（${picked.length}か所）`);
    const area: Vec[] = [];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const p = { x: center.x + dx, y: center.y + dy };
        if (GridSystem.inBounds(p) && !GridSystem.contains(picked, p)) area.push(p);
      }
    while (picked.length < n && area.length > 0) picked.push(area.splice(s.rng.int(0, area.length - 1), 1)[0]);
    return picked;
  }

  // ---------------------------------------------------------------- DEFEND / HEAL

  defend(a: DefendAction): void {
    const s = this.s;
    if (a.timing === 'BEFORE_IMPACT') {
      s.reactiveWard = { reduction: a.reduction, expiresAt: s.time + SPELL_LIMITS.REACTIVE_WARD_WINDOW_MS };
      s.log('magic', `反応障壁を待機（次の被弾直前に${Math.round(a.reduction * 100)}%軽減の障壁を自動展開・${SPELL_LIMITS.REACTIVE_WARD_WINDOW_MS / 1000}秒間有効）`);
      return;
    }
    const reduction = Math.min(0.9, a.reduction + s.loadout.guardBonus);
    s.player.shield = { reduction, until: s.time + a.durationMs };
    s.log('magic', `防御障壁を展開（${Math.round(reduction * 100)}%軽減／${(a.durationMs / 1000).toFixed(1)}秒）`);
  }

  heal(a: HealAction): void {
    const s = this.s;
    const before = s.player.hp;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.round(a.amount * s.loadout.healMult));
    s.log('magic', `治癒魔法: HP ${before} → ${s.player.hp}`);
  }
}
