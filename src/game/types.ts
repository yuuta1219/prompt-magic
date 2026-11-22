import type { Element, HarnessSpec, Spell } from '../interpreter/schema';

/** 着弾・エフェクトの属性。dark は敵専用 */
export type AttackElement = Element | 'dark';

export interface Vec {
  x: number;
  y: number;
}

export type Side = 'player' | 'enemy';

export interface Shield {
  reduction: number;
  until: number;
}

export interface Combatant {
  hp: number;
  maxHp: number;
  pos: Vec;
  shield: Shield | null;
  /** 凍結が解ける時刻（0 = 凍結していない） */
  frozenUntil: number;
}

/** 濡れたマス（ウォーターで発生、サンダーを引き寄せる） */
export interface WetCell {
  x: number;
  y: number;
  until: number;
}

/** 着弾待ちの攻撃（予兆として盤面に表示される） */
export interface PendingAttack {
  id: number;
  owner: Side;
  /** 着弾するフィールド */
  field: Side;
  cells: Vec[];
  damage: number;
  element: AttackElement;
  createdAt: number;
  resolveAt: number;
  label: string;
}

/** 着弾エフェクト（表示用、一定時間で消える） */
export interface ImpactFx {
  id: number;
  field: Side;
  cells: Vec[];
  element: AttackElement;
  at: number;
  hit: boolean;
}

export type SpellStatus =
  | 'interpreting' // 解釈中（ブラウザ内で即時に終わる）
  | 'waiting_mana' // 魔力不足で待機中
  | 'casting' // 詠唱中
  | 'done'
  | 'failed'
  | 'cancelled';

export interface CostBreakdown {
  gameTokens: number;
  tokenCost: number;
  complexityPoints: number;
  complexityCost: number;
  effectCost: number;
  areaCost: number;
  automationCost: number;
  total: number;
  castTimeMs: number;
  notes: string[];
}

export interface SpellEntry {
  id: number;
  text: string;
  status: SpellStatus;
  submittedAt: number;
  spell?: Spell;
  cost?: CostBreakdown;
  castStartAt?: number;
  castEndAt?: number;
  error?: string;
  reasoning: string[];
  /** 詠唱開始時に距離ランダムを確定させた命令（実行はこちらを使う） */
  resolvedActions?: Spell['actions'];
  /** resolvedActions のうち、距離をランダムで決めた命令の位置 */
  rolledIndexes?: number[];
}

export interface ActiveHarness {
  id: number;
  spec: HarnessSpec;
  sourceText: string;
  registeredAt: number;
  lastTriggeredAt: number;
  triggerCount: number;
  /** 自動発動1回あたりの魔力（エンジンが算出する） */
  triggerCost: number;
  /** HP系トリガーのエッジ検出用 */
  armed: boolean;
  lastStatus: string;
}

export interface EnemyCastInfo {
  label: string;
  startedAt: number;
  resolveAt: number;
}

export type Phase = 'battle' | 'victory' | 'defeat';

export type LogKind = 'system' | 'player' | 'enemy' | 'magic' | 'harness' | 'ai' | 'error' | 'mana';

export interface LogEntry {
  id: number;
  t: number;
  kind: LogKind;
  text: string;
}

/** 反応障壁（着弾直前に自動展開する障壁） */
export interface ReactiveWard {
  reduction: number;
  expiresAt: number;
}

export interface BattleEvent {
  type: 'ENEMY_CAST_START' | 'PLAYER_HIT';
  attack?: PendingAttack;
}

export type { HarnessSpec, Spell };
