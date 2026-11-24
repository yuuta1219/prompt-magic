/**
 * ストーリー第3話「無言の街」。ステージ11〜15の強さ。
 *
 * 文章（セリフ・ページの絵・色・演出）は台本 ep3.txt にある。直すときは ep3.txt だけを書き換える。
 * ここには、台本に書かない戦闘の設定（強さ・敵の画像・マスの絵・曲）だけを置く。
 * 第3話の曲（ep3-*）が無いあいだは、ほかの話の曲で代わりに鳴らす（src/ui/bgm.ts）。
 */
import raw from './ep3.txt?raw';
import { parseScript } from './script';
import type { Episode } from './types';

const script = parseScript(raw);

const BATTLE_BGM: [string, string] = ['ep3-battle-1', 'ep3-battle-2'];

/** チャプター番号ごとの戦闘の設定 */
const BATTLE: Record<number, { stage: number; sprite: string; units?: number; boss?: import('../game/EnemyAI').BossKind; thumb: string; bgm: { before?: string; after?: string; battle?: [string, string] } }> = {
  1: { stage: 11, sprite: 'ad', units: 3, thumb: 'ep3/03-screens', bgm: { before: 'ep3-field', after: 'ep3-field', battle: BATTLE_BGM } },
  2: { stage: 12, sprite: 'mute', thumb: 'ep3/07-siblings', bgm: { before: 'ep3-station', after: 'ep3-station', battle: BATTLE_BGM } },
  3: { stage: 13, sprite: 'filter', thumb: 'ep3/11-haru-paper', bgm: { before: 'ep3-name', after: 'ep3-station', battle: BATTLE_BGM } },
  4: { stage: 14, sprite: 'hachi', thumb: 'ep3/14-hachiko', bgm: { before: 'ep3-hachi', after: 'ep3-hachi', battle: BATTLE_BGM } },
  5: { stage: 15, sprite: 'moderator', boss: 'moderator', thumb: 'ep3/18-moderator', bgm: { before: 'ep3-tension', after: 'ep3-ending', battle: ['ep3-boss', 'ep3-boss'] } },
};

export const EPISODE3: Episode = {
  id: 'ep3',
  title: script.title,
  subtitle: script.subtitle,
  prologue: { id: 'ep3-prologue', pages: script.prologue, bgm: 'ep3-field' },
  prologueThumb: 'ep3/02-crossing',
  prologueTitle: '水晶の交差点',
  prologueDesc: '渋谷に、誰もいない。人の形をした水晶だけが立っている。',
  mapBgm: 'ep3-main',
  nextThumb: 'ep3/27-yanikawa-alone',
  chapters: script.chapters.map((c) => ({
    id: `ep3-c${c.no}`,
    no: c.no,
    title: c.title,
    enemy: c.enemy,
    stage: BATTLE[c.no]?.stage ?? c.no + 10,
    sprite: BATTLE[c.no]?.sprite,
    units: BATTLE[c.no]?.units,
    boss: BATTLE[c.no]?.boss,
    thumb: BATTLE[c.no]?.thumb,
    bgm: BATTLE[c.no]?.bgm,
    before: c.before,
    after: c.after,
  })),
};
