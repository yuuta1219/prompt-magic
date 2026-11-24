/**
 * ストーリー第6話「錦糸町」。ステージ26〜30の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep6.txt にある。直すときは ep6.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 絵や曲がまだ無いところは、色だけ・ほかの話の曲で進む。
 */
import raw from './ep6.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const FIELD = { before: 'ep6-field', after: 'ep6-field', battle: ['ep6-battle-1', 'ep6-battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; thumb: string; bgm: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 26, sprite: 'watcher', thumb: 'ep6/03-watchers', bgm: FIELD },
  2: { stage: 27, sprite: 'tank', thumb: 'ep6/07-wrecks', bgm: FIELD },
  3: { stage: 28, sprite: 'missile', thumb: 'ep6/12-untouched', bgm: FIELD },
  4: { stage: 29, sprite: 'sweeper', thumb: 'ep6/16-sweepers', bgm: FIELD },
  5: { stage: 30, sprite: 'aegis', thumb: 'ep6/20-aegis', bgm: { before: 'ep6-tension', after: 'ep6-ending', battle: ['ep6-boss', 'ep6-boss'] } },
};

export const EPISODE6: Episode = {
  id: 'ep6',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep6-prologue', pages: script.prologue, bgm: 'ep6-field' },
  prologueThumb: 'ep6/01-bridge',
  prologueTitle: '人のいない街',
  prologueDesc: '隅田川の向こうは、オラクルの庭だった。',
  nextThumb: 'ep6/23-gate-open',
  mapBgm: 'ep6-main',
  chapters: script.chapters.map((c) => ({
    id: `ep6-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 25,
    sprite: BATTLE[c.no]?.sprite,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm,
    loseEvent: c.loseEvent,
    before: c.before,
    after: c.after,
  })),
};
