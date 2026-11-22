/**
 * ストーリー第1話「812年寝坊した詠唱者」。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep1.txt にある。直すときは ep1.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵）だけを置く。
 */
import raw from './ep1.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; thumb: string }> = {
  1: { stage: 1, sprite: 'cleaner', thumb: 'ep1/03-cleaner' },
  2: { stage: 2, sprite: 'patrol', thumb: 'ep1/10-patrol' },
  3: { stage: 3, sprite: 'vending', thumb: 'ep1/04-vending' },
  4: { stage: 4, sprite: 'archive', thumb: 'ep1/05-log' },
  5: { stage: 5, sprite: 'cerberus', thumb: 'ep1/06-gate' },
};

export const EPISODE1: Episode = {
  id: 'ep1',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep1-prologue', pages: script.prologue },
  chapters: script.chapters.map((c) => ({
    id: `ep1-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no,
    sprite: BATTLE[c.no]?.sprite,
    thumb: BATTLE[c.no]?.thumb,
    before: c.before,
    after: c.after,
  })),
};
