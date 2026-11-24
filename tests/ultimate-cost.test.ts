import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine';
import { ELEMENTS } from '../src/game/elements';
import { BASE_ALL_LOADOUT } from '../src/game/skills';

describe('究極魔法の魔力', () => {
  it('連発できないくらい重いが、魔力の上限を上げていなくても（300）1発は撃てる', () => {
    const ults = Object.entries(ELEMENTS).filter(([, d]) => d.ultimate);
    for (const [, d] of ults) {
      const e = new GameEngine(1, { loadout: { ...BASE_ALL_LOADOUT, manaMax: 300 } });
      e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
      const before = e.s.mana.current;
      e.cast(d.name.replace(/・/g, ' '));
      for (let t = 0; t < 8000; t += 50) e.advance(50);
      const spent = before - e.s.mana.current + 8 * e.s.loadout.manaRegen; // 自然回復ぶんを足し戻す
      expect(spent, d.name).toBeGreaterThan(d.oncePerBattle ? 100 : 250);
    }
  });
});
