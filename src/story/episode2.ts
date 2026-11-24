/**
 * ストーリー第2話「中二病の街と、電波の塔」。ステージ6〜10の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep2.txt にある。直すときは ep2.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 曲は ep2-* が無ければ第1話の曲で代わりに鳴らす（src/ui/bgm.ts）。
 */
import raw from './ep2.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const FIELD = { before: 'ep2-field', after: 'ep2-field', battle: ['ep2-battle-1', 'ep2-battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; thumb: string; bgm?: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 6, sprite: 'crow', thumb: 'ep2/03-crows' },
  2: { stage: 7, sprite: 'statue', thumb: 'ep2/07-statue', bgm: { before: 'ep2-village', after: 'ep2-village', battle: FIELD.battle } },
  3: { stage: 8, sprite: 'spirit', thumb: 'ep2/09-runaway', bgm: { before: 'ep2-night', after: 'ep2-night', battle: FIELD.battle } },
  4: { stage: 9, sprite: 'spider', thumb: 'ep2/11-spider' },
  5: { stage: 10, sprite: 'tower', thumb: 'ep2/12-tower-top', bgm: { before: 'ep2-tension', after: 'ep2-ending', battle: ['ep2-boss', 'ep2-boss'] } },
};

export const EPISODE2: Episode = {
  id: 'ep2',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep2-prologue', pages: script.prologue, bgm: 'ep2-field' },
  prologueThumb: 'ep2/01-ruins',
  /** 第2話のメインテーマ（ep2-main が無いあいだは、廃墟の曲で代わりに流す） */
  mapBgm: 'ep2-main',
  prologueTitle: '地上の三日間',
  prologueDesc: '折れた塔を目指して、廃墟の東京を歩く。',
  chapters: script.chapters.map((c) => ({
    id: `ep2-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 5,
    sprite: BATTLE[c.no]?.sprite,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm ?? FIELD,
    before: c.before,
    after: c.after,
  })),
};
