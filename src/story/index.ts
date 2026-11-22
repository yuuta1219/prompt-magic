/** ストーリーモード: どのステージの前後に、どの紙芝居を流すか */
import { EPISODE1 } from './episode1';
import type { Episode, StoryScene } from './types';

export const EPISODES: Episode[] = [EPISODE1];

const ALL_SCENES = EPISODES.flatMap((e) => e.scenes);

/** ステージの戦闘前に流す、まだ見ていない場面 */
export function sceneBefore(stage: number, seen: readonly string[]): StoryScene | null {
  return ALL_SCENES.find((s) => s.before === stage && !seen.includes(s.id)) ?? null;
}

/** ステージに勝ったあとに流す、まだ見ていない場面 */
export function sceneAfterWin(stage: number, seen: readonly string[]): StoryScene | null {
  return ALL_SCENES.find((s) => s.afterWin === stage && !seen.includes(s.id)) ?? null;
}

/** ストーリー中のステージなら、その敵の名前 */
export function storyEnemyName(stage: number): string | null {
  for (const e of EPISODES) if (e.enemies[stage]) return e.enemies[stage];
  return null;
}

/** 見直し用: 話の場面を全部つなげて1本にする */
export function wholeEpisode(e: Episode): StoryScene {
  return { id: `${e.id}-replay`, pages: e.scenes.flatMap((s) => s.pages) };
}
