/**
 * ストーリー第4話「記録の駅」。ステージ16〜20の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep4.txt にある。直すときは ep4.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 絵や曲がまだ無いところは、色だけ・ほかの話の曲で進む。
 */
import raw from './ep4.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const FIELD = { before: 'ep4-field', after: 'ep4-field', battle: ['ep4-battle-1', 'ep4-battle-2'] as [string, string] };

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; units?: number; boss?: import('../game/EnemyAI').BossKind; thumb: string; bgm: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 16, sprite: 'gate', thumb: 'ep4/03-gates', bgm: FIELD },
  2: { stage: 17, sprite: 'announcer', thumb: 'ep4/06-platform', bgm: FIELD },
  3: { stage: 18, sprite: 'guardian', thumb: 'ep4/09-auth', bgm: FIELD },
  4: { stage: 19, sprite: 'chimera', units: 2, boss: 'chimera', thumb: 'ep4/13-prototypes', bgm: FIELD },
  5: { stage: 20, sprite: 'stationmaster', boss: 'stationmaster', thumb: 'ep4/16-stationmaster', bgm: { before: 'ep4-tension', after: 'ep4-ending', battle: ['ep4-boss', 'ep4-boss'] } },
};

export const EPISODE4: Episode = {
  id: 'ep4',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep4-prologue', pages: script.prologue, bgm: 'ep4-field' },
  prologueThumb: 'ep4/02-station',
  prologueTitle: '赤レンガの保管庫',
  prologueDesc: '東京駅に、この国のすべての記録が眠っている。',
  nextThumb: 'ep4/18-alone',
  mapBgm: 'ep4-main',
  chapters: script.chapters.map((c) => ({
    id: `ep4-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 15,
    sprite: BATTLE[c.no]?.sprite,
    units: BATTLE[c.no]?.units,
    boss: BATTLE[c.no]?.boss,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm,
    loseEvent: c.loseEvent,
    before: c.before,
    after: c.after,
  })),
};
