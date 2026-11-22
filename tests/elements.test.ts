import { castNow, quietEngine } from './helpers';
import { ELEMENTS, ELEMENT_RULES } from '../src/game/elements';
import type { GameEngine } from '../src/game/GameEngine';

/** 敵が回避しないエンジン */
function noDodge(): GameEngine {
  const e = quietEngine();
  e.enemyAI.onIncoming = () => {};
  return e;
}

function lastPlayerAttackCells(e: GameEngine) {
  return e.s.attacks.filter((a) => a.owner === 'player').at(-1)!.cells;
}

describe('属性魔法 - 攻撃の形', () => {
  it('ファイアとアイスは単体、ウォーターは3×3、ウインドは横一列、アースは縦一列', () => {
    const e = noDodge();
    e.s.enemy.pos = { x: 4, y: 4 };
    const shapeOf = (text: string) => {
      castNow(e, text);
      return lastPlayerAttackCells(e);
    };
    expect(shapeOf('ファイア')).toEqual([{ x: 4, y: 4 }]);
    expect(shapeOf('アイス')).toEqual([{ x: 4, y: 4 }]);
    expect(shapeOf('ウォーター')).toHaveLength(9);
    const wind = shapeOf('ウインド');
    expect(wind).toHaveLength(9);
    expect(wind.every((c) => c.y === 4)).toBe(true);
    const earth = shapeOf('アース');
    expect(earth).toHaveLength(9);
    expect(earth.every((c) => c.x === 4)).toBe(true);
  });

  it('サンダーは照準の周囲3×3のどこかにランダムで4か所', () => {
    const e = noDodge();
    e.s.enemy.pos = { x: 4, y: 4 };
    castNow(e, 'サンダー');
    const cells = lastPlayerAttackCells(e);
    expect(cells).toHaveLength(ELEMENT_RULES.THUNDER_BOLTS);
    for (const c of cells) {
      expect(Math.abs(c.x - 4)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - 4)).toBeLessThanOrEqual(1);
    }
  });

  it('ダメージは属性で決まる（「最大威力」と言っても変わらない）', () => {
    const e = noDodge();
    castNow(e, '最大威力の全力ファイア');
    e.advance(2000);
    expect(e.s.enemy.hp).toBe(e.s.enemy.maxHp - ELEMENTS.fire.damage);
  });
});

describe('属性魔法 - コンボ', () => {
  it('ウォーターで濡れたマスにサンダーが引き寄せられ、2倍ダメージ', () => {
    const e = noDodge();
    castNow(e, 'ウォーター');
    e.advance(1000);
    expect(e.s.isWet(e.s.enemy.pos)).toBe(true);
    const hpAfterWater = e.s.enemy.hp;
    castNow(e, 'サンダー');
    // 4か所すべて濡れたマスに落ちる
    expect(lastPlayerAttackCells(e).every((c) => e.s.isWet(c))).toBe(true);
    e.advance(2000);
    // 敵のいるマスに落ちた場合は感電2倍、落ちなかった場合は無傷
    const dealt = hpAfterWater - e.s.enemy.hp;
    expect([0, ELEMENTS.thunder.damage * 2]).toContain(dealt);
  });

  it('1回の詠唱で「ウォーター→サンダー」なら、これから濡れるマスも狙う', () => {
    const e = noDodge();
    castNow(e, 'ウォーターからのサンダー');
    const [water, thunder] = e.s.attacks.filter((a) => a.owner === 'player');
    expect(water.element).toBe('water');
    expect(thunder.element).toBe('thunder');
    expect(thunder.resolveAt).toBeGreaterThan(water.resolveAt);
    for (const c of thunder.cells) expect(water.cells).toContainEqual(c);
  });

  it('濡れは一定時間で乾く', () => {
    const e = noDodge();
    castNow(e, 'ウォーター');
    e.advance(1000);
    expect(e.s.wet.length).toBe(9);
    e.advance(ELEMENT_RULES.WET_DURATION_MS + 100);
    expect(e.s.wet.length).toBe(0);
  });

  it('アイスで凍結した敵は回避も行動もできない', () => {
    const e = quietEngine();
    e.enemyAI.nextThinkAt = 0;
    e.enemyAI.nextAction = 'move';
    e.enemyAI.onIncoming = () => {};
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    castNow(e, 'アイス');
    e.advance(1000);
    expect(e.s.isFrozen('enemy')).toBe(true);
    // 凍結中は回避の計画を立てない
    e.enemyAI.onIncoming = Object.getPrototypeOf(e.enemyAI).onIncoming.bind(e.enemyAI);
    const pos = { ...e.s.enemy.pos };
    castNow(e, 'ウインド');
    e.advance(1500);
    expect(e.s.enemy.pos).toEqual(pos);
  });

  it('凍結中の敵にファイアで融解ボーナス1.5倍、凍結は解ける', () => {
    const e = noDodge();
    castNow(e, 'アイス');
    e.advance(1000);
    expect(e.s.isFrozen('enemy')).toBe(true);
    const hp = e.s.enemy.hp;
    castNow(e, 'ファイア');
    e.advance(1000);
    expect(hp - e.s.enemy.hp).toBe(Math.round(ELEMENTS.fire.damage * ELEMENT_RULES.MELT_MULTIPLIER));
    expect(e.s.isFrozen('enemy')).toBe(false);
  });
});
