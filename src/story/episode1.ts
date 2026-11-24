/**
 * ストーリー第1話「82年寝坊した詠唱者」。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep1.txt にある。直すときは ep1.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵）だけを置く。
 */
import raw from './ep1.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

/** 地下の紙芝居・ふつうの戦闘の曲 */
const UNDERGROUND = { before: 'underground', after: 'underground', battle: ['battle-1', 'battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; units?: number; boss?: import('../game/EnemyAI').BossKind; thumb: string; bgm?: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 1, sprite: 'cleaner', thumb: 'ep1/03-cleaner' },
  2: { stage: 2, sprite: 'patrol', thumb: 'ep1/10-patrol' },
  3: { stage: 3, sprite: 'vending', thumb: 'ep1/04-vending' },
  4: { stage: 4, sprite: 'archive', thumb: 'ep1/05-log' },
  5: { stage: 5, sprite: 'cerberus', boss: 'cerberus', thumb: 'ep1/06-gate', bgm: { before: 'tension', after: 'ending', battle: ['boss', 'boss'] } },
};

export const EPISODE1: Episode = {
  id: 'ep1',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep1-prologue', pages: script.prologue, bgm: 'underground' },
  prologueThumb: 'ep1/01-pod',
  prologueTitle: '82年後の目覚め',
  prologueDesc: '地下の休眠施設で、カプセルが壊れた。',
  nextThumb: 'ep1/07-surface',
  mapBgm: 'main',
  chapters: script.chapters.map((c) => ({
    id: `ep1-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no,
    sprite: BATTLE[c.no]?.sprite,
    units: BATTLE[c.no]?.units,
    boss: BATTLE[c.no]?.boss,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm ?? UNDERGROUND,
    before: c.before,
    after: c.after,
  })),
};
