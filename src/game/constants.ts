/**
 * ゲームバランス定数。ここを変えるだけで調整できるように一箇所に集約する。
 */
export const GRID_SIZE = 9;

/** 固定タイムステップ (ms)。シミュレーションは常にこの刻みで進む */
export const TICK_MS = 50;

export const PLAYER = {
  MAX_HP: 100,
  START: { x: 4, y: 4 },
} as const;

export const ENEMY = {
  MAX_HP: 220,
  START: { x: 4, y: 4 },
  /** 敵が次の行動を考える間隔 (ms) */
  THINK_INTERVAL_MS: 2300,
  /** HPが半分を切ったときの思考間隔 */
  ENRAGED_THINK_INTERVAL_MS: 1700,
  /** 攻撃の予兆（詠唱）時間の範囲 */
  CAST_MIN_MS: 3200,
  CAST_MAX_MS: 4200,
  /** プレイヤーの魔法の予兆を見て回避する基本確率（着弾まで1秒あたり） */
  DODGE_CHANCE_PER_SEC: 0.12, // 逃げすぎるので 1/3 に（もとは 0.35）
  DODGE_CHANCE_MAX: 0.2, // 同じく 1/3（もとは 0.6）
  GUARD_REDUCTION: 0.4,
  GUARD_DURATION_MS: 2500,
} as const;

export const MANA = {
  MAX: 300,
  /** 1秒あたりの自然回復量 */
  REGEN_PER_SEC: 8,
  START: 300,
} as const;

/**
 * 魔力コスト係数。
 * 「冗長さ（トークン量）」と「処理の複雑さ」は別々に評価する。
 */
export const COST = {
  /** 詠唱トークン1つあたりの魔力 */
  PER_TOKEN: 0.6,
  /** 複雑度1ポイントあたりの魔力 */
  PER_COMPLEXITY: 6,
  MOVE_BASE: 8,
  MOVE_PER_CELL: 2,
  /** 攻撃の基本コスト（属性ごとの効果コストは elements.ts） */
  ATTACK_BASE: 6,
  DEFEND_BASE: 14,
  DEFEND_PER_REDUCTION: 50, // reduction 0.5 → +25
  DEFEND_PER_SEC: 4,
  /** ヒール: 10MP で HP 1 */
  HEAL_PER_HP: 10,
  AUTOMATION_REGISTER: 30,
  AUTOMATION_PER_CONDITION: 8,
  /** 自律術式が自動発動するときの追加オーバーヘッド */
  AUTOMATION_TRIGGER_OVERHEAD: 6,
  /** パワー（威力アップ）をつけた攻撃の追加効果コスト。複雑度も+2 */
  BOOST_EFFECT: 15,
  /** 解釈に失敗した詠唱は、トークン分の魔力だけ半分消費 */
  FAILED_TOKEN_RATIO: 0.5,
} as const;

export const CAST_TIME = {
  /** 移動の詠唱時間: マス数を指定した場合の1マスあたり */
  MOVE_PER_CELL_MS: 100,
  /** 移動の詠唱時間: 距離ランダムの場合の1マスあたり（曖昧な指示ほど隙が大きい） */
  MOVE_RANDOM_PER_CELL_MS: 500,
  /** 以下は移動以外（攻撃・防御・回復・自律術式）の詠唱時間 */
  BASE_MS: 250,
  PER_COMPLEXITY_MS: 120,
  PER_ACTION_MS: 150,
  MAX_MS: 2600,
} as const;

export const DAMAGE = {
  /** 敵の雷属性: 防御障壁の軽減率を割合で貫通 */
  THUNDER_PIERCE: 0.5,
} as const;

export const SPELL_LIMITS = {
  MAX_ACTIONS: 3,
  MAX_INPUT_CHARS: 300,
  MIN_DELAY_MS: 300,
  MAX_DELAY_MS: 3000,
  MIN_DEFEND_MS: 500,
  MAX_DEFEND_MS: 5000,
  MIN_REDUCTION: 0.2,
  MAX_REDUCTION: 0.8,
  MAX_HEAL: 40,
  /** 「着弾直前に障壁」の待機が有効な時間 */
  REACTIVE_WARD_WINDOW_MS: 8000,
  /** 着弾の何ms前に反応障壁を張るか */
  REACTIVE_WARD_LEAD_MS: 250,
  REACTIVE_WARD_DURATION_MS: 700,
} as const;

export const HARNESS = {
  MAX_ACTIVE: 1,
  MIN_COOLDOWN_MS: 2000,
  MAX_TRIGGERS: 20,
  MAX_ACTIONS: 2,
} as const;
