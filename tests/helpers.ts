import { GameEngine } from '../src/game/GameEngine';
import { interpretSpell } from '../src/interpreter/SpellInterpreter';
import type { Spell } from '../src/interpreter/schema';

/** 敵が動かない・攻撃しない状態のエンジン（決定的なテスト用） */
export function quietEngine(seed = 42): GameEngine {
  const e = new GameEngine(seed);
  freezeEnemy(e);
  return e;
}

export function freezeEnemy(e: GameEngine): void {
  e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
}

/** 詠唱し、詠唱完了まで時間を進める */
export function castNow(e: GameEngine, text: string, spell: Spell = interpretSpell(text)): number {
  const entry = e.submitSpell(text);
  if (!('id' in entry)) throw new Error(entry.error);
  e.applyInterpretation(entry.id, e.battleId, { ok: true, spell });
  // 詠唱が終わるまで進める（移動の距離ランダムは詠唱開始時に詠唱時間が決まるので、見積もりでは進めない）
  const me = () => e.s.spells.find((x) => x.id === entry.id)!;
  for (let t = 0; t < 10_000 && ['waiting_mana', 'casting'].includes(me().status); t += 50) e.advance(50);
  e.advance(100);
  return entry.id;
}
