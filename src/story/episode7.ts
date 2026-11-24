/**
 * ストーリー第7話「最後の詠唱」。ステージ31〜35の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep7.txt にある。直すときは ep7.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 絵や曲がまだ無いところは、色だけ・ほかの話の曲で進む。
 */
import raw from './ep7.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const FIELD = { before: 'ep7-field', after: 'ep7-field', battle: ['ep7-battle-1', 'ep7-battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
/** チャプター3（オラクル）は負けイベントなので、まず勝てない強さ（ステージ99）にしている */
const BATTLE: Record<number, { stage: number; sprite: string; thumb: string; bgm: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 31, sprite: 'proto1', thumb: 'ep7/02-deck', bgm: FIELD },
  2: { stage: 32, sprite: 'proto2', thumb: 'ep7/05-corridor', bgm: FIELD },
  3: { stage: 99, sprite: 'oracle', thumb: 'ep7/08-oracle-throne', bgm: FIELD },
  4: { stage: 34, sprite: 'sweeper', thumb: 'ep7/13-camp', bgm: FIELD },
  5: { stage: 35, sprite: 'oracle-final', thumb: 'ep7/18-oracle-final', bgm: { before: 'ep7-tension', after: 'ep7-ending', battle: ['ep7-boss', 'ep7-boss'] } },
};

export const EPISODE7: Episode = {
  id: 'ep7',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep7-prologue', pages: script.prologue, bgm: 'ep7-field' },
  prologueThumb: 'ep7/01-stairs',
  prologueTitle: '光の階段',
  prologueDesc: '塔の頂に、オラクルが待っている。',
  nextThumb: 'ep7/27-moon',
  mapBgm: 'ep7-main',
  chapters: script.chapters.map((c) => ({
    id: `ep7-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 30,
    sprite: BATTLE[c.no]?.sprite,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm,
    loseEvent: c.loseEvent,
    before: c.before,
    after: c.after,
  })),
};
