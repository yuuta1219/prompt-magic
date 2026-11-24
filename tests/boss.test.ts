import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine';
import type { BossKind } from '../src/game/EnemyAI';

/** 敵が唱えた攻撃が出るまで時間を進める */
function firstVolley(boss: BossKind, stage = 10, seed = 1, label?: RegExp) {
  const e = new GameEngine(seed, { stage, boss });
  e.reset();
  for (let i = 0; i < 2000; i++) {
    const list = e.s.attacks.filter((a) => a.owner === 'enemy');
    if (label ? list.some((a) => label.test(a.label)) : list.length > 1) return { e, list };
    e.advance(50);
  }
  return { e, list: e.s.attacks.filter((a) => a.owner === 'enemy') };
}

describe('ボスのギミック', () => {
  it('ケルベロス: 左・真ん中・右の3列が、時間差で着弾する', () => {
    const { list } = firstVolley('cerberus');
    expect(list).toHaveLength(3);
    const times = list.map((a) => a.resolveAt).sort((a, b) => a - b);
    expect(times[1] - times[0]).toBeGreaterThan(1000);
    expect(new Set(list.map((a) => a.cells.length))).toEqual(new Set([27]));
  });
  it('東京タワー: 9マスの塔の形', () => {
    const { list } = firstVolley('tower', 10, 3, /電波塔/);
    const t = list.find((a) => /電波塔/.test(a.label))!;
    expect(t.cells.length).toBeGreaterThan(4);
    expect(t.cells.length).toBeLessThanOrEqual(9);
  });
  it('負けイベのオラクル: いろんな魔法を同時に', () => {
    const { list } = firstVolley('oracle', 99);
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(new Set(list.map((a) => a.label)).size).toBeGreaterThanOrEqual(2);
  });
  it('負けイベのオラクル: 倒せず、50秒すぎると最後の術式で必ず負ける', () => {
    const e = new GameEngine(2, { stage: 99, boss: 'oracle' });
    e.reset();
    expect(e.s.enemy.maxHp).toBeGreaterThan(10000);
    e.s.player.hp = e.s.player.maxHp = 99999; // 途中では倒れないようにして、最後の術式まで進める
    for (let t = 0; t < 90_000 && e.s.phase === 'battle'; t += 50) {
      e.advance(50);
      if (e.s.logger.has(/最終術式/)) break;
    }
    expect(e.s.time).toBeGreaterThanOrEqual(50_000);
    expect(e.s.attacks.some((a) => a.label === '最終術式・全域消去' && a.damage >= 9999)).toBe(true);
  });
  it('群れ: 1体倒すと次が出てきて、全部倒すまで勝ちにならない', () => {
    const e = new GameEngine(1, { stage: 6, units: 3 });
    e.reset();
    for (let k = 0; k < 2; k++) {
      e.s.enemy.hp = 0;
      e.advance(50);
      expect(e.s.phase).toBe('battle');
      expect(e.s.enemy.hp).toBe(e.s.enemy.maxHp);
    }
    e.s.enemy.hp = 0;
    e.advance(50);
    expect(e.s.phase).toBe('victory');
  });
});
