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

describe('台本テキストの読み取り', () => {
  it('台本からプロローグと5チャプターが読める', async () => {
    const { parseScript } = await import('../src/story/script');
    const { readFileSync } = await import('node:fs');
    const sc = parseScript(readFileSync('src/story/ep1.txt', 'utf8'));
    expect(sc.title).toBe('第1話');
    expect(sc.subtitle).toBe('812年寝坊した詠唱者');
    expect(sc.chapters.map((c) => c.enemy)).toEqual(['清掃術式体', '巡回術式体', '自販機型術式体', '記録保管術式体', '門番術式体ケルベロス']);
    expect(sc.prologue[0].title).toBe(true);
    expect(sc.prologue[2]).toMatchObject({ img: 'ep1/01-pod', tone: 'alarm', fx: 'shake' });
  });
  it('セリフの中のカギかっこは、最後の 」 までをセリフにする', async () => {
    const { parseScript } = await import('../src/story/script');
    const sc = parseScript('## プロローグ\n--- ページ1\nナレーション「彼は「プラン」だった。」\n【効果音】カチッ。\n【中央】おわり');
    expect(sc.prologue[0].lines).toEqual([
      { who: 'ナレーション', text: '彼は「プラン」だった。' },
      { who: '', text: 'カチッ。', sfx: 'lighter' },
      { text: 'おわり' },
    ]);
  });
});

describe('第2話', () => {
  const ep2 = EPISODES[1];
  it('プロローグと5チャプター。強さはステージ6〜10（チャプター5は強敵）', () => {
    expect(ep2.prologue.pages.length).toBeGreaterThan(0);
    expect(ep2.chapters.map((c) => c.stage)).toEqual([6, 7, 8, 9, 10]);
    expect(ep2.chapters[4].enemy).toBe('電波塔術式体トウキョウ');
  });
  it('第1話をクリアするまで第2話は開かない', async () => {
    const { episodeOpen } = await import('../src/story');
    expect(episodeOpen(1, [])).toBe(false);
    expect(episodeOpen(1, EPISODES[0].chapters.map((c) => c.id))).toBe(true);
  });
});
