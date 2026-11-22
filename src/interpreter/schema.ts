/**
 * 構造化命令スキーマ（クライアント・サーバー共通）。
 *
 * 解釈器が出力してよいのは、ここで定義された命令だけ。
 * ゲームエンジンはこのスキーマを通過したデータしか受け付けない。
 * 「新しい能力」はここに無い限り存在しない。
 */
import { z } from 'zod';
import { HARNESS, SPELL_LIMITS } from '../game/constants';
import { SPELL_KEYS, type SpellKey } from '../game/elements';

export const DirectionSchema = z.enum([
  'up', // 敵フィールド側（前）
  'down', // 手前（後ろ）
  'left',
  'right',
  'up_left',
  'up_right',
  'down_left',
  'down_right',
  'auto', // 方向はエンジンに任せる（安全マス探索など）
]);
export type Direction = z.infer<typeof DirectionSchema>;

export const ShapeSchema = z.enum(['single', 'cross', 'square3', 'row', 'column']);
export type Shape = z.infer<typeof ShapeSchema>;

/** プレイヤーの属性魔法。攻撃の形と威力は属性で決まる（src/game/elements.ts） */
export const ElementSchema = z.enum(SPELL_KEYS as [SpellKey, ...SpellKey[]]);
export type Element = z.infer<typeof ElementSchema>;

export const AttackTargetSchema = z.enum(['ENEMY_CURRENT', 'ENEMY_PREDICTED', 'CELL']);

const Coord = z.object({ x: z.number().int(), y: z.number().int() });

export const MoveActionSchema = z.object({
  type: z.literal('MOVE'),
  direction: DirectionSchema,
  /** null = 距離が曖昧（エンジンが、実際に動けるマス数の中からランダムに選ぶ）。過大な値はエンジンが盤面内に制限する */
  distance: z.number().int().min(1).max(999).nullable(),
  /** 敵の攻撃予兆を避けるか */
  avoidDanger: z.boolean(),
});

export const AttackActionSchema = z.object({
  type: z.literal('ATTACK'),
  target: AttackTargetSchema,
  cell: Coord.nullable(),
  element: ElementSchema,
  /** パワー（補助魔法）: 威力を上げる。スキル「パワー」が必要 */
  boost: z.boolean().optional(),
  delayMs: z.number().int().min(SPELL_LIMITS.MIN_DELAY_MS).max(SPELL_LIMITS.MAX_DELAY_MS),
});

export const DefendActionSchema = z.object({
  type: z.literal('DEFEND'),
  reduction: z.number().min(SPELL_LIMITS.MIN_REDUCTION).max(SPELL_LIMITS.MAX_REDUCTION),
  durationMs: z.number().int().min(SPELL_LIMITS.MIN_DEFEND_MS).max(SPELL_LIMITS.MAX_DEFEND_MS),
  /** NOW=即時展開 / BEFORE_IMPACT=次の敵弾の着弾直前に自動展開 */
  timing: z.enum(['NOW', 'BEFORE_IMPACT']),
});

export const HealActionSchema = z.object({
  type: z.literal('HEAL'),
  amount: z.number().int().min(1).max(SPELL_LIMITS.MAX_HEAL),
});

export const NoopActionSchema = z.object({
  type: z.literal('NOOP'),
  reason: z.string().max(200),
});

/** 自律術式の中で実行できる行動（自律術式の中で自律術式は登録できない＝無限再帰の防止） */
export const ExecutableActionSchema = z.discriminatedUnion('type', [
  MoveActionSchema,
  AttackActionSchema,
  DefendActionSchema,
  HealActionSchema,
]);

export const TriggerSchema = z.object({
  type: z.enum(['ENEMY_CAST_START', 'PLAYER_HIT', 'PLAYER_HP_BELOW', 'ENEMY_HP_BELOW', 'EVERY_SECONDS']),
  /** HP系: しきい値 / EVERY_SECONDS: 秒数 */
  value: z.number().nullable(),
});

export const ConditionSchema = z.object({
  type: z.enum(['MANA_ABOVE', 'MANA_BELOW', 'PLAYER_HP_ABOVE', 'PLAYER_HP_BELOW', 'ENEMY_HP_BELOW']),
  value: z.number().min(0).max(1000),
});

export const HarnessSpecSchema = z.object({
  name: z.string().min(1).max(40),
  trigger: TriggerSchema,
  conditions: z.array(ConditionSchema).max(3),
  actions: z.array(ExecutableActionSchema).min(1).max(HARNESS.MAX_ACTIONS),
  cooldownMs: z.number().int().min(HARNESS.MIN_COOLDOWN_MS).max(60000),
  maxTriggers: z.number().int().min(1).max(HARNESS.MAX_TRIGGERS),
});

export const RegisterAutomationSchema = z.object({
  type: z.literal('REGISTER_AUTOMATION'),
  harness: HarnessSpecSchema,
});

export const ActionSchema = z.discriminatedUnion('type', [
  MoveActionSchema,
  AttackActionSchema,
  DefendActionSchema,
  HealActionSchema,
  NoopActionSchema,
  RegisterAutomationSchema,
]);

export const SpellSchema = z.object({
  actions: z.array(ActionSchema).min(1).max(SPELL_LIMITS.MAX_ACTIONS),
  /** 解釈の推論ログ（曖昧さをどう扱ったか） */
  reasoning: z.array(z.string().max(200)).max(8),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;
export type AttackAction = z.infer<typeof AttackActionSchema>;
export type DefendAction = z.infer<typeof DefendActionSchema>;
export type HealAction = z.infer<typeof HealActionSchema>;
export type NoopAction = z.infer<typeof NoopActionSchema>;
export type ExecutableAction = z.infer<typeof ExecutableActionSchema>;
export type HarnessSpec = z.infer<typeof HarnessSpecSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Spell = z.infer<typeof SpellSchema>;

export type ValidationResult = { ok: true; spell: Spell } | { ok: false; error: string };

/** 不正な命令データを安全に拒否する。throwしない。 */
export function validateSpell(data: unknown): ValidationResult {
  const r = SpellSchema.safeParse(data);
  if (r.success) return { ok: true, spell: r.data };
  const issues = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join(' / ');
  return { ok: false, error: `術式の構造が不正: ${issues}` };
}
