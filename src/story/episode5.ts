/**
 * ストーリー第5話「新橋」。ステージ21〜25の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep5.txt にある。直すときは ep5.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 絵や曲がまだ無いところは、色だけ・ほかの話の曲で進む。
 */
import raw from './ep5.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const FIELD = { before: 'ep5-field', after: 'ep5-field', battle: ['ep5-battle-1', 'ep5-battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; thumb: string; bgm: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 21, sprite: 'sl', thumb: 'ep5/02-sl-square', bgm: FIELD },
  2: { stage: 22, sprite: 'securitygate', thumb: 'ep5/05-office-building', bgm: FIELD },
  3: { stage: 23, sprite: 'exception', thumb: 'ep5/13-exception', bgm: FIELD },
  4: { stage: 24, sprite: 'merger', thumb: 'ep5/14-history', bgm: FIELD },
  5: { stage: 25, sprite: 'ghost', thumb: 'ep5/18-ghost', bgm: { before: 'ep5-tension', after: 'ep5-ending', battle: ['ep5-boss', 'ep5-boss'] } },
};

export const EPISODE5: Episode = {
  id: 'ep5',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep5-prologue', pages: script.prologue, bgm: 'ep5-field' },
  prologueThumb: 'ep5/01-walk-alone',
  prologueTitle: 'ひとりの帰り道',
  prologueDesc: 'オラクルの声は、もう聞こえない。',
  nextThumb: 'ep5/21-skytree-far',
  mapBgm: 'ep5-main',
  chapters: script.chapters.map((c) => ({
    id: `ep5-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 20,
    sprite: BATTLE[c.no]?.sprite,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm,
    loseEvent: c.loseEvent,
    before: c.before,
    after: c.after,
  })),
};
