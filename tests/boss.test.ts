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
  it('ラスボス: HP が半分を切ると一度だけフィアト・ノクス（50ダメージ、HP は30残す）', () => {
    const e = new GameEngine(4, { stage: 35, boss: 'oracle-final' });
    e.reset();
    e.s.attacks = [];
    e.s.enemy.hp = Math.floor(e.s.enemy.maxHp * 0.45);
    e.s.player.hp = 70;
    e.advance(50);
    const nox = e.s.attacks.find((a) => a.label === 'フィアト・ノクス')!;
    expect(nox.cells).toHaveLength(81);
    expect(nox.cinematic).toBe('fiat_nox_enemy');
    expect(e.enemyAI.nextThinkAt).toBeGreaterThanOrEqual(e.s.time + 15000 - 100); // 着弾のあと10秒は何もしない
    e.s.attacks = [nox]; // ほかの攻撃は外して、ノクスだけ当てる
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    e.advance(5100);
    expect(e.s.player.hp).toBe(30); // 70-50=20 になるところ、30 残る
    expect(e.s.cinematics.some((c) => c.key === 'fiat_nox_enemy')).toBe(true);
    // 二度目は来ない
    e.enemyAI.nextThinkAt = 0;
    for (let i = 0; i < 100; i++) e.advance(50);
    expect(e.s.attacks.some((a) => a.label === 'フィアト・ノクス')).toBe(false);
  });
  it('ラスボスのフィアト・ノクス: HP に余裕があれば、そのまま50ダメージ', () => {
    const e = new GameEngine(4, { stage: 35, boss: 'oracle-final' });
    e.reset();
    e.s.attacks = [];
    e.s.enemy.hp = Math.floor(e.s.enemy.maxHp * 0.45);
    e.s.player.hp = e.s.player.maxHp = 200;
    e.advance(50);
    e.s.attacks = e.s.attacks.filter((a) => a.label === 'フィアト・ノクス');
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    e.advance(5100);
    expect(e.s.player.hp).toBeLessThanOrEqual(150);
    expect(e.s.player.hp).toBeGreaterThanOrEqual(149);
  });
  it('群れ: 全員が同時に盤面にいて、倒れたものから消え、全部倒すまで勝ちにならない', () => {
    const e = new GameEngine(1, { stage: 6, units: 3 });
    e.reset();
    expect(e.s.foes()).toHaveLength(3);
    const spots = new Set(e.s.foes().map((f) => `${f.pos.x},${f.pos.y}`));
    expect(spots.size).toBe(3); // 重ならない
    // リーダー以外の1体が倒れると、その1体だけ消える
    e.s.others[0].hp = 0;
    e.s.others = e.s.others.filter((o) => o.hp > 0);
    e.advance(50);
    expect(e.s.foes()).toHaveLength(2);
    // リーダーが倒れると、残りの1体がリーダーになる
    const last = { ...e.s.others[0].pos };
    e.s.enemy.hp = 0;
    e.advance(50);
    expect(e.s.phase).toBe('battle');
    expect(e.s.foes()).toHaveLength(1);
    expect(e.s.enemy.pos).toEqual(last);
    e.s.enemy.hp = 0;
    e.advance(50);
    expect(e.s.phase).toBe('victory');
  });
  it('群れ: 範囲魔法は、範囲に入っている敵みんなに当たる', () => {
    const e = new GameEngine(1, { stage: 6, units: 3 });
    e.reset();
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    e.enemyAI.onIncoming = () => {};
    const hps = e.s.foes().map((f) => f.hp);
    const all = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) all.push({ x, y });
    e.s.addAttack('player', 'enemy', all, 10, 'fire', 100, 'テスト');
    e.advance(150);
    e.s.foes().forEach((f, i) => expect(f.hp).toBe(hps[i] - 10));
  });

});
