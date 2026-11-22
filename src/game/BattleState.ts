import { ENEMY, PLAYER } from './constants';
import { BASE_ALL_LOADOUT, stageStats, type Loadout } from './skills';
import { GridSystem } from './GridSystem';
import { ManaPool } from './ManaSystem';
import { BattleLogger } from './BattleLogger';
import { Rng } from './Rng';
import type {
  ActiveHarness,
  BattleEvent,
  Combatant,
  ImpactFx,
  PendingAttack,
  Phase,
  ReactiveWard,
  Side,
  SpellEntry,
  Vec,
  WetCell,
  AttackElement,
} from './types';

/**
 * 戦闘の全データ。ロジックは持たず（ちょっとした問い合わせのみ）、
 * GameEngine / MagicEngine / EnemyAI / HarnessEngine が操作する。
 */
export class BattleState {
  /** シミュレーション時刻 (ms)。実時間ではなく固定ステップで進む */
  time = 0;
  phase: Phase = 'battle';
  readonly battleId: number;

  player: Combatant;
  /** HP自然回復の端数 */
  hpRegenAcc = 0;
  enemy: Combatant;
  mana: ManaPool;
  /** 習得済みスキルから決まる、使える魔法と強化値 */
  loadout: Loadout;
  readonly stage: number;
  /** 敵の攻撃力の倍率・思考間隔（ステージで決まる） */
  readonly enemyPower: number;
  readonly enemyThinkMs: number;
  /** 敵の魔力（プレイヤーと同じルール: 最大300・毎秒8回復） */
  enemyMana = new ManaPool();

  attacks: PendingAttack[] = [];
  fx: ImpactFx[] = [];
  spells: SpellEntry[] = [];
  harnesses: ActiveHarness[] = [];
  reactiveWard: ReactiveWard | null = null;
  /** 敵フィールドの濡れたマス */
  wet: WetCell[] = [];

  /** このtick中に発生したイベント（自律術式の監視用） */
  events: BattleEvent[] = [];

  readonly logger = new BattleLogger();
  readonly rng: Rng;
  private seq = 0;

  constructor(seed?: number, battleId = 1, opts: { loadout?: Loadout; stage?: number } = {}) {
    this.rng = new Rng(seed);
    this.battleId = battleId;
    this.loadout = opts.loadout ?? BASE_ALL_LOADOUT;
    this.stage = opts.stage ?? 1;
    const st = stageStats(this.stage);
    this.player = { hp: this.loadout.hpMax, maxHp: this.loadout.hpMax, pos: { ...PLAYER.START }, shield: null, frozenUntil: 0 };
    this.enemy = { hp: st.enemyHp, maxHp: st.enemyHp, pos: { ...ENEMY.START }, shield: null, frozenUntil: 0 };
    this.enemyPower = st.enemyPower;
    this.enemyThinkMs = st.thinkMs;
    this.mana = new ManaPool(this.loadout.manaMax, this.loadout.manaMax, this.loadout.manaRegen);
  }

  nextId(): number {
    return ++this.seq;
  }

  log(kind: Parameters<BattleLogger['log']>[1], text: string): void {
    this.logger.log(this.time, kind, text);
  }

  combatant(side: Side): Combatant {
    return side === 'player' ? this.player : this.enemy;
  }

  addAttack(owner: Side, field: Side, cells: Vec[], damage: number, element: AttackElement, delayMs: number, label: string): PendingAttack {
    const atk: PendingAttack = {
      id: this.nextId(),
      owner,
      field,
      cells,
      damage,
      element,
      createdAt: this.time,
      resolveAt: this.time + delayMs,
      label,
    };
    this.attacks.push(atk);
    return atk;
  }

  /** 指定フィールドで、指定時間以内に着弾する危険マス */
  dangerCells(field: Side, withinMs = Infinity): Vec[] {
    const out: Vec[] = [];
    for (const a of this.attacks) {
      if (a.field !== field || a.resolveAt - this.time > withinMs) continue;
      for (const c of a.cells) if (!GridSystem.contains(out, c)) out.push(c);
    }
    return out;
  }

  isDanger(field: Side, p: Vec): boolean {
    return GridSystem.contains(this.dangerCells(field), p);
  }

  isWet(p: Vec): boolean {
    return this.wet.some((w) => w.x === p.x && w.y === p.y && w.until > this.time);
  }

  isFrozen(side: Side): boolean {
    return this.combatant(side).frozenUntil > this.time;
  }

  emit(ev: BattleEvent): void {
    this.events.push(ev);
  }
}
