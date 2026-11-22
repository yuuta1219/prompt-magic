/**
 * 魔力システム。
 *
 * 魔力 = トークン予算をゲーム化したもの。
 * - 詠唱トークン（冗長さ）     : 入力文の長さから再現可能な方法で計算
 * - 複雑度（処理の高度さ）     : 構造化された術式の中身から計算（文の長さとは無関係）
 * - 効果 / 範囲 / 自動化コスト : 実行内容から計算
 *
 */
import { CAST_TIME, COST, MANA } from './constants';
import { ELEMENTS } from './elements';
import type { Loadout } from './skills';
import type { Action, ExecutableAction, HarnessSpec, Spell } from '../interpreter/schema';
import type { CostBreakdown } from './types';

const CJK = /[぀-ヿ㐀-䶿一-鿿々〆ー]/;
const TOKEN_RE = /[0-9０-９]+|[A-Za-zＡ-Ｚａ-ｚ]+|[぀-ヿ㐀-䶿一-鿿々〆ー]+|\S/gu;
const FREE_PUNCT = /^[、。，．,.!！?？「」『』（）()・…\-ー〜~]$/;

/**
 * ゲーム内トークン数。決定的（同じ入力なら常に同じ値）。
 * - 日本語（かな・漢字）の連続: 2文字で1トークン（切り上げ）
 * - 英単語・数字のかたまり: 1トークン
 * - 句読点: 0
 * - その他の記号: 1
 */
export function countGameTokens(text: string): number {
  const parts = text.normalize('NFKC').match(TOKEN_RE) ?? [];
  let n = 0;
  for (const p of parts) {
    if (CJK.test(p[0]) && p.length > 1) n += Math.ceil(p.length / 2);
    else if (p.length === 1 && FREE_PUNCT.test(p)) n += 0;
    else n += 1;
  }
  return n;
}

function actionComplexity(a: Action | ExecutableAction): number {
  switch (a.type) {
    case 'MOVE':
      return 1 + (a.distance !== null ? 1 : 0) + (a.avoidDanger ? 2 : 0) + (a.direction === 'auto' ? 1 : 0);
    case 'ATTACK':
      return (
        1 +
        (a.target === 'ENEMY_PREDICTED' ? 3 : a.target === 'CELL' ? 1 : 0) +
        (a.delayMs < 600 ? 1 : 0) +
        (a.boost ? 2 : 0)
      );
    case 'DEFEND':
      return 1 + (a.timing === 'BEFORE_IMPACT' ? 3 : 0);
    case 'HEAL':
      return 1;
    case 'NOOP':
      return 0;
    case 'REGISTER_AUTOMATION':
      return 2 + a.harness.conditions.length + a.harness.actions.reduce((s, x) => s + actionComplexity(x), 0);
  }
}

function actionEffect(a: Action | ExecutableAction, eco?: Loadout['branchEco']): { effect: number; area: number } {
  switch (a.type) {
    case 'MOVE': {
      const d = a.distance === null ? 2 : Math.min(a.distance, 8);
      return { effect: COST.MOVE_BASE + COST.MOVE_PER_CELL * d, area: 0 };
    }
    case 'ATTACK':
      // 範囲の広さは属性の効果コストに含まれている（elements.ts）
      return { effect: COST.ATTACK_BASE + ELEMENTS[a.element].cost * (eco?.[ELEMENTS[a.element].branch] ?? 1) + (a.boost ? COST.BOOST_EFFECT : 0), area: 0 };
    case 'DEFEND':
      return {
        effect: COST.DEFEND_BASE + COST.DEFEND_PER_REDUCTION * a.reduction + COST.DEFEND_PER_SEC * (a.durationMs / 1000),
        area: 0,
      };
    case 'HEAL':
      return { effect: COST.HEAL_PER_HP * a.amount, area: 0 };
    case 'NOOP':
    case 'REGISTER_AUTOMATION':
      return { effect: 0, area: 0 };
  }
}

/**
 * 1つの行動の魔力（詠唱トークン分を除く）= 効果 + 範囲 + 複雑度 × 6。
 * 敵は呪文を唱えないのでトークン分は無いが、それ以外はプレイヤーと同じ式で払う。
 */
export function actionManaCost(a: ExecutableAction): number {
  const { effect, area } = actionEffect(a);
  return Math.round(effect + area + actionComplexity(a) * COST.PER_COMPLEXITY);
}

/** 自律術式が1回自動発動するときの魔力（登録時にエンジンが確定させる） */
export function harnessTriggerCost(spec: HarnessSpec): number {
  let c = COST.AUTOMATION_TRIGGER_OVERHEAD;
  for (const a of spec.actions) {
    const { effect, area } = actionEffect(a);
    c += effect + area + actionComplexity(a) * COST.PER_COMPLEXITY * 0.5;
  }
  return Math.round(c);
}

export function computeSpellCost(text: string, spell: Spell, lo?: Loadout): CostBreakdown {
  const notes: string[] = [];
  const gameTokens = countGameTokens(text);
  const tokenCost = gameTokens * COST.PER_TOKEN;

  let complexityPoints = 0;
  let effectCost = 0;
  let areaCost = 0;
  let automationCost = 0;
  let realActions = 0;

  for (const a of spell.actions) {
    complexityPoints += actionComplexity(a);
    const { effect, area } = actionEffect(a, lo?.branchEco);
    effectCost += effect;
    areaCost += area;
    if (a.type !== 'NOOP') realActions++;
    if (a.type === 'REGISTER_AUTOMATION') {
      automationCost += COST.AUTOMATION_REGISTER + COST.AUTOMATION_PER_CONDITION * a.harness.conditions.length;
      notes.push(`自律術式の発動ごとに ${harnessTriggerCost(a.harness)} 魔力を別途消費`);
    }
    if (a.type === 'ATTACK' && a.target === 'ENEMY_PREDICTED') notes.push('未来位置の予測: 高度な処理（複雑度+3）');
    if (a.type === 'MOVE' && a.avoidDanger) notes.push('危険マス回避の計算（複雑度+2）');
    if (a.type === 'ATTACK' && a.boost) notes.push(`パワー: 威力アップ（効果+${COST.BOOST_EFFECT}・複雑度+2）`);
  }
  const complexityCost = complexityPoints * COST.PER_COMPLEXITY;

  let total = tokenCost + complexityCost + effectCost + areaCost + automationCost;
  if (realActions === 0) {
    total = tokenCost * COST.FAILED_TOKEN_RATIO;
    notes.push('不発: 詠唱トークン分の魔力の半分だけ消費');
  }

  const castTimeMs = realActions === 0 ? 0 : spellCastTimeMs(spell.actions, [], lo);
  if (spell.actions.some((a) => a.type === 'MOVE' && a.direction !== 'auto' && a.distance === null)) {
    notes.push('距離ランダム: 詠唱開始時に距離が決まり、詠唱時間もそのとき確定する');
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    gameTokens,
    tokenCost: r1(tokenCost),
    complexityPoints,
    complexityCost: r1(complexityCost),
    effectCost: r1(effectCost),
    areaCost: r1(areaCost),
    automationCost: r1(automationCost),
    total: Math.round(total),
    castTimeMs,
    notes,
  };
}

/** 移動の詠唱時間。マス数指定なら1マス0.1秒、距離ランダムなら1マス0.5秒 */
export function moveCastMs(cells: number, random: boolean): number {
  const per = random ? CAST_TIME.MOVE_RANDOM_PER_CELL_MS : CAST_TIME.MOVE_PER_CELL_MS;
  return per * Math.max(1, Math.min(8, cells));
}

/**
 * 詠唱時間 = 移動以外の詠唱時間（複雑度と命令数から）＋ 移動の詠唱時間（マス数から）
 * 移動の距離ランダムは、詠唱開始時に GameEngine が距離を決めてから計算し直す。
 * @param randomIdx 距離をランダムで決めた移動の位置（distance が null のものは自動的にランダム扱い）
 */
export function spellCastTimeMs(actions: Action[], randomIdx: number[] = [], lo?: Loadout): number {
  const others = actions.filter((a) => a.type !== 'MOVE' && a.type !== 'NOOP');
  // 大魔法の追加詠唱時間（elements.ts の castExtraMs）は上限の外で足す
  const extra = others.reduce((n, a) => (a.type === 'ATTACK' ? n + (ELEMENTS[a.element].castExtraMs ?? 0) : n), 0);
  const otherMs =
    others.length === 0
      ? 0
      : Math.round(
          (Math.min(
            CAST_TIME.MAX_MS,
            CAST_TIME.BASE_MS + others.reduce((n, a) => n + actionComplexity(a), 0) * CAST_TIME.PER_COMPLEXITY_MS + others.length * CAST_TIME.PER_ACTION_MS,
          ) +
            extra) *
            (lo?.castMult ?? 1),
        );
  // 距離ランダムでまだ距離が決まっていないものは、1マスとして見積もる
  const moveMs = actions.reduce(
    (n, a, i) => (a.type === 'MOVE' ? n + moveCastMs(a.distance ?? 1, a.distance === null && a.direction !== 'auto' ? true : randomIdx.includes(i)) : n),
    0,
  );
  return otherMs + moveMs;
}

/** 魔力プール */
export class ManaPool {
  current: number;
  max: number;
  regenPerSec: number;

  constructor(max: number = MANA.MAX, start: number = MANA.START, regenPerSec: number = MANA.REGEN_PER_SEC) {
    this.max = max;
    this.current = start;
    this.regenPerSec = regenPerSec;
  }

  regen(dtMs: number): void {
    this.current = Math.min(this.max, this.current + (this.regenPerSec * dtMs) / 1000);
  }

  canAfford(cost: number): boolean {
    return this.current + 1e-9 >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.current = Math.max(0, this.current - cost);
    return true;
  }

  /** 必要魔力までの待ち時間 (ms) */
  timeUntil(cost: number): number {
    if (cost > this.max) return Infinity;
    const lack = cost - this.current;
    return lack <= 0 ? 0 : (lack / this.regenPerSec) * 1000;
  }
}
