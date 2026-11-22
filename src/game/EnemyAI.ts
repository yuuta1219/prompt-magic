/**
 * 敵AI（ルールベース）。LLMは使わない。
 *
 * - 一定間隔で「移動 / 攻撃詠唱 / 防御」を行う
 * - 次の行動と次の移動先は「一手先」まで事前に決めておく
 *   → プレイヤーが「敵の次の移動先を予測して」と詠唱すると、エンジンはこの計画を読める
 * - プレイヤーの魔法の予兆を見て、確率で回避する
 */
import { COST, ENEMY } from './constants';
import { actionManaCost } from './ManaSystem';
import { GridSystem } from './GridSystem';
import type { BattleState } from './BattleState';
import type { AttackElement, PendingAttack, Vec } from './types';
import type { Shape } from '../interpreter/schema';

type EnemyAction = 'move' | 'attack' | 'guard';

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
      const cost = enemyMoveCost(1, true);
      if (!s.enemyMana.canAfford(cost)) {
        s.log('enemy', '敵は回避しようとしたが魔力が足りない');
      } else if (!s.isDanger('enemy', to)) {
        s.enemyMana.spend(cost);
        s.enemy.pos = to;
        s.log('enemy', `敵は予兆を察知して (${to.x},${to.y}) へ回避した`);
        this.plannedMove = this.planMove(to);
      }
    }

    if (s.time < this.nextThinkAt) return;

    // 魔力が足りない行動はできない（足りなければ、できる行動に切り替える／溜める）
    const action = this.nextAction;
    let done: boolean;
    if (action === 'attack' && !this.isCasting) done = this.castAttack(); // 足りなければ移動せずに溜める
    else if (action === 'guard') done = this.guard();
    else done = this.move(true);
    if (!done) s.log('enemy', `敵は魔力を溜めている（${Math.floor(s.enemyMana.current)}/${s.enemyMana.max}）`);

    // 暴走中は思考間隔が短くなる（ステージが上がると全体的に短くなる）
    const base = s.enemyThinkMs;
    const interval = this.enraged ? Math.round(base * (ENEMY.ENRAGED_THINK_INTERVAL_MS / ENEMY.THINK_INTERVAL_MS)) : base;
    this.nextThinkAt = s.time + interval;
    this.nextAction = this.decideNext();
  }

  private decideNext(): EnemyAction {
    const r = this.s.rng.next();
    const lowHp = this.s.enemy.hp < this.s.enemy.maxHp * 0.4;
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

  /** @param keepReserve 動いたあとも一番安い攻撃1回分の魔力が残るときだけ動く */
  private move(keepReserve = false): boolean {
    const s = this.s;
    const from = s.enemy.pos;
    const cells = Math.max(Math.abs(this.plannedMove.x - from.x), Math.abs(this.plannedMove.y - from.y));
    const cost = enemyMoveCost(cells);
    const reserve = keepReserve ? Math.min(...PATTERNS.map(enemyAttackCost)) : 0;
    if (!s.enemyMana.canAfford(cost + reserve)) return false;
    s.enemyMana.spend(cost);
    s.enemy.pos = { ...this.plannedMove };
    s.log('enemy', `敵が (${s.enemy.pos.x},${s.enemy.pos.y}) へ移動（魔力-${cost}）`);
    this.plannedMove = this.planMove(s.enemy.pos);
    return true;
  }

  private guard(): boolean {
    const s = this.s;
    const cost = enemyGuardCost();
    if (!s.enemyMana.spend(cost)) return false;
    s.enemy.shield = { reduction: ENEMY.GUARD_REDUCTION, until: s.time + ENEMY.GUARD_DURATION_MS };
    s.log('enemy', `敵が防御結界を展開（${Math.round(ENEMY.GUARD_REDUCTION * 100)}%軽減／魔力-${cost}）`);
    return true;
  }

  /** 払える攻撃の中からランダムに選ぶ。どれも払えなければ false */
  private castAttack(): boolean {
    const s = this.s;
    const affordable = PATTERNS.filter((p) => s.enemyMana.canAfford(enemyAttackCost(p)));
    if (affordable.length === 0) return false;
    const p = s.rng.pick(affordable);
    const cost = enemyAttackCost(p);
    s.enemyMana.spend(cost);
    // 照準は概ねプレイヤーの位置。少しブレる
    const aim = GridSystem.clamp({
      x: s.player.pos.x + (s.rng.chance(0.25) ? s.rng.int(-1, 1) : 0),
      y: s.player.pos.y + (s.rng.chance(0.25) ? s.rng.int(-1, 1) : 0),
    });
    const cells = GridSystem.shapeCells(aim, p.shape);
    const castMs = Math.round(s.rng.int(ENEMY.CAST_MIN_MS, ENEMY.CAST_MAX_MS) * p.castScale);
    const dmg = Math.round(p.damage * s.enemyPower * (this.enraged ? 1.2 : 1));
    const atk = s.addAttack('enemy', 'player', cells, dmg, p.element, castMs, p.label);
    s.log('enemy', `敵が「${p.label}」の詠唱を開始！ ${(castMs / 1000).toFixed(1)}秒後に着弾（魔力-${cost}）`);
    s.emit({ type: 'ENEMY_CAST_START', attack: atk });
    return true;
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

  /** 凍結した: 解けるまで次の行動を遅らせる */
  onFrozen(): void {
    this.nextThinkAt = Math.max(this.nextThinkAt, this.s.enemy.frozenUntil + 300);
  }
}
