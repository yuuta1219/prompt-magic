/** ストーリーモード: 話・チャプターの一覧と、どこまで進めるか */
import { EPISODE1 } from './episode1';
import type { Chapter, Episode, StoryPage, StoryScene } from './types';

export const EPISODES: Episode[] = [EPISODE1];
export const ALL_CHAPTERS: Chapter[] = EPISODES.flatMap((e) => e.chapters);

/** 進み具合に残す「済み」の印 */
export const PROLOGUE_DONE = (e: Episode) => e.prologue.id;
export const CHAPTER_CLEAR = (c: Chapter) => c.id;

/** チャプターを選べるか（前のチャプターをクリアしていれば選べる。最初のチャプターはプロローグを見ていれば） */
export function chapterOpen(e: Episode, idx: number, done: readonly string[]): boolean {
  if (idx === 0) return done.includes(e.prologue.id);
  return done.includes(e.chapters[idx - 1].id);
}

export function episodeCleared(e: Episode, done: readonly string[]): boolean {
  return e.chapters.every((c) => done.includes(c.id));
}

/** チャプターの頭に出すタイトルのページ */
function chapterTitle(c: Chapter): StoryPage {
  return { tone: 'black', title: true, lines: [{ text: `チャプター${c.no}　${c.title}` }] };
}

export function chapterBefore(c: Chapter): StoryScene {
  return { id: `${c.id}-before`, pages: [chapterTitle(c), ...c.before], bgm: c.bgm?.before };
}
export function chapterAfter(c: Chapter): StoryScene | null {
  return c.after.length ? { id: `${c.id}-after`, pages: c.after, bgm: c.bgm?.after } : null;
}
