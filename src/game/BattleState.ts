import type { BossKind } from './EnemyAI';
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
  /** 5戦ごとの強敵か */
  readonly elite: boolean;
  /** 群れの敵の数（1体なら 1） */
  readonly units: number;
  /**
   * 群れの敵のうち、リーダー（enemy）以外でまだ生きているもの。全員が同時に盤面にいる。
   * リーダーが倒れたら、ここから1体がリーダーになる（倒れたものから消える）
   */
  others: Combatant[] = [];
  /** リーダーのほかに生きている数 */
  get unitsLeft(): number {
    return this.others.length;
  }
  /** 生きている敵ぜんぶ（リーダーが先頭） */
  foes(): Combatant[] {
    return [this.enemy, ...this.others];
  }
  /** ボスのギミックの種類（ふつうの敵は undefined） */
  readonly boss?: BossKind;

  attacks: PendingAttack[] = [];
  fx: ImpactFx[] = [];
  spells: SpellEntry[] = [];
  harnesses: ActiveHarness[] = [];
  reactiveWard: ReactiveWard | null = null;
  /** 敵フィールドの濡れたマス */
  wet: WetCell[] = [];
  /** この戦闘ですでに使った「1度きり」の魔法 */
  usedOnce = new Set<string>();
  /** この戦闘のあいだの攻撃力の倍率（ウェニー・ウィディー・ウィキーなど） */
  attackBuff = 1;
  /** 大魔法の演出イベント（UI が拾って全画面演出を出す） */
  cinematics: { id: number; key: string }[] = [];

  /** このtick中に発生したイベント（自律術式の監視用） */
  events: BattleEvent[] = [];

  readonly logger = new BattleLogger();
  readonly rng: Rng;
  private seq = 0;

  constructor(seed?: number, battleId = 1, opts: { loadout?: Loadout; stage?: number; units?: number; boss?: BossKind } = {}) {
    this.rng = new Rng(seed);
    this.battleId = battleId;
    this.loadout = opts.loadout ?? BASE_ALL_LOADOUT;
    this.stage = opts.stage ?? 1;
    const st = stageStats(this.stage);
    this.player = { hp: this.loadout.hpMax, maxHp: this.loadout.hpMax, pos: { ...PLAYER.START }, shield: null, frozenUntil: 0 };
    // 群れの敵は、全体の HP を何体かに分ける（全体は少しだけ多め）
    this.units = Math.max(1, opts.units ?? 1);
    // 負けイベントのオラクルは倒せない（HP は桁ちがい）
    const unitHp = opts.boss === 'oracle' ? 99999 : this.units > 1 ? Math.round(st.enemyHp / this.units) : st.enemyHp;
    this.enemy = { hp: unitHp, maxHp: unitHp, pos: { ...ENEMY.START }, shield: null, frozenUntil: 0 };
    // 群れのほかの敵は、リーダーと重ならない場所にばらけて立つ
    for (let i = 1; i < this.units; i++) {
      let pos = { x: this.rng.int(0, 8), y: this.rng.int(0, 8) };
      for (let k = 0; k < 30 && this.foes().some((f) => f.pos.x === pos.x && f.pos.y === pos.y); k++) pos = { x: this.rng.int(0, 8), y: this.rng.int(0, 8) };
      this.others.push({ hp: unitHp, maxHp: unitHp, pos, shield: null, frozenUntil: 0 });
    }
    this.boss = opts.boss;
    // 負けイベントのオラクルの普通の攻撃は、第7話の敵と同じくらいの強さ（数発で倒れないように）
    this.enemyPower = opts.boss === 'oracle' ? stageStats(33).enemyPower : st.enemyPower;
    this.enemyThinkMs = st.thinkMs;
    this.elite = st.elite;
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

  /** 大魔法の全画面演出を出す */
  cinematic(key: string): void {
    this.cinematics.push({ id: this.nextId(), key });
    if (this.cinematics.length > 10) this.cinematics.shift();
  }

  emit(ev: BattleEvent): void {
    this.events.push(ev);
  }
}
