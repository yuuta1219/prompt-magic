import { describe, expect, it } from 'vitest';
import { EPISODES, sceneAfterWin, sceneBefore, storyEnemyName, wholeEpisode } from '../src/story';
import { loadProgress, markStorySeen, newProgress } from '../src/game/progress';

describe('ストーリー（第1話）', () => {
  it('ステージ1の前に開幕の場面が流れ、見たら流れない', () => {
    expect(sceneBefore(1, [])?.id).toBe('ep1-open');
    expect(sceneBefore(1, ['ep1-open'])).toBeNull();
  });
  it('ステージ5に勝ったらエンディング', () => {
    expect(sceneAfterWin(5, [])?.id).toBe('ep1-end');
    expect(sceneAfterWin(4, [])).toBeNull();
  });
  it('第1話の範囲だけ敵に名前がつく', () => {
    expect(storyEnemyName(5)).toBe('門番術式体ケルベロス');
    expect(storyEnemyName(6)).toBeNull();
  });
  it('どの場面にもページとセリフがある', () => {
    for (const sc of EPISODES[0].scenes) {
      expect(sc.pages.length).toBeGreaterThan(0);
      for (const p of sc.pages) expect(p.lines.length).toBeGreaterThan(0);
    }
    expect(wholeEpisode(EPISODES[0]).pages.length).toBe(EPISODES[0].scenes.reduce((n, s) => n + s.pages.length, 0));
  });
  it('見た場面は進み具合に残る（二重に入らない）', () => {
    const p = markStorySeen(markStorySeen(newProgress(), 'ep1-open'), 'ep1-open');
    expect(p.story).toEqual(['ep1-open']);
  });
  it('古い保存データ（story なし）でも読める', () => {
    expect(loadProgress().story).toEqual([]);
  });
});
