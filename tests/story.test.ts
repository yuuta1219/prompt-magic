import { describe, expect, it } from 'vitest';
import { EPISODES, chapterAfter, chapterBefore, chapterOpen, episodeCleared } from '../src/story';
import { loadProgress, markStorySeen, newProgress } from '../src/game/progress';

const ep = EPISODES[0];

describe('ストーリー（第1話）', () => {
  it('プロローグと5つのチャプター。チャプターはステージ1〜5の強さ', () => {
    expect(ep.prologue.pages.length).toBeGreaterThan(0);
    expect(ep.chapters.map((c) => c.stage)).toEqual([1, 2, 3, 4, 5]);
  });
  it('チャプターは前をクリアすると開く。最初のチャプターはプロローグを見たら開く', () => {
    expect(chapterOpen(ep, 0, [])).toBe(false);
    expect(chapterOpen(ep, 0, [ep.prologue.id])).toBe(true);
    expect(chapterOpen(ep, 1, [ep.prologue.id])).toBe(false);
    expect(chapterOpen(ep, 1, [ep.prologue.id, ep.chapters[0].id])).toBe(true);
  });
  it('全チャプターをクリアすると第1話クリア', () => {
    expect(episodeCleared(ep, ep.chapters.slice(0, 4).map((c) => c.id))).toBe(false);
    expect(episodeCleared(ep, ep.chapters.map((c) => c.id))).toBe(true);
  });
  it('チャプターの紙芝居は、頭にタイトルのページがつく。どのページにもセリフがある', () => {
    for (const c of ep.chapters) {
      const b = chapterBefore(c);
      expect(b.pages[0].title).toBe(true);
      for (const p of [...b.pages, ...(chapterAfter(c)?.pages ?? [])]) expect(p.lines.length).toBeGreaterThan(0);
    }
  });
  it('見た場面は進み具合に残る（二重に入らない）', () => {
    const p = markStorySeen(markStorySeen(newProgress(), 'ep1-c1'), 'ep1-c1');
    expect(p.story).toEqual(['ep1-c1']);
  });
  it('古い保存データ（story なし）でも読める', () => {
    expect(loadProgress().story).toEqual([]);
  });
});
