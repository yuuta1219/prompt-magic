/**
 * スキルツリー（104個。うち特別枠3つ）。
 *
 * - 移動は最初から使える。ツリーの中心はウォーター（最初から習得済み）
 * - SP を払って、線でつながった先のスキルを解放していく
 * - 習得済みスキルから「ロードアウト」（使える魔法・コマンドと、強化された数値）を計算し、エンジンに渡す
 *
 * 17×17 のマップ。中心 (8,8) がウォーター。8方向に枝が伸びる:
 *   上: 水 / 左: 炎 / 右: 雷 / 下: 氷 / 左上: 風 / 右上: 土 / 左下: 光（守り） / 右下: 闇（術式）
 * 合体魔法は2つの枝の両方を覚えると解放できる（requiresAll）。
 */
import { ELEMENTS, ELEMENT_RULES, SPELL_KEYS, type Branch, type SpellKey } from './elements';
import { MANA, PLAYER } from './constants';

export type CommandKey = 'guard' | 'counter' | 'heal' | 'predict' | 'quick' | 'auto' | 'boost';

export type SkillKind = 'spell' | 'command' | 'passive' | 'support';

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  /** 解放に必要な SP */
  cost: number;
  /** 先に覚えている必要があるスキル（requiresAll が無ければ、どれか1つでよい） */
  requires: string[];
  requiresAll?: boolean;
  pos: { x: number; y: number };
  /** ツリーの枝（色分け用） */
  branch: Branch;
  desc: string;
  /** 唱え方（呪文・コマンドのとき） */
  incantation?: string;
  /** 特別枠（マップには置かない）。needCount があればその数のスキルを覚えたとき、無ければほかを全部覚えたときに解放できる */
  special?: boolean;
  needCount?: number;
}

export const TREE_SIZE = 17;

export const SKILLS: SkillDef[] = [
  // ---- water
  { id: 'water', name: 'ウォーター', kind: 'spell', cost: 0, requires: [], pos: { x: 8, y: 8 }, branch: 'water', incantation: 'ウォーター', desc: '3×3に水を降らせる（威力12）。着弾マスを濡らす。最初から使える' },
  { id: 'wide_water', name: 'ワイドウォーター', kind: 'passive', cost: 2, requires: ['water'], pos: { x: 8, y: 7 }, branch: 'water', desc: 'ウォーターの範囲が 3×3 → 5×5' },
  { id: 'long_wet', name: 'ロングウェット', kind: 'passive', cost: 1, requires: ['wide_water'], pos: { x: 8, y: 6 }, branch: 'water', desc: '「濡れ」が続く時間 6秒 → 10秒' },
  { id: 'tidal', name: 'タイダル', kind: 'spell', cost: 3, requires: ['long_wet'], pos: { x: 8, y: 5 }, branch: 'water', incantation: 'タイダル', desc: '横3列を大波で押し流す（威力10）。すべて濡らす' },
  { id: 'maelstrom', name: 'メイルシュトローム', kind: 'spell', cost: 4, requires: ['tidal'], pos: { x: 8, y: 4 }, branch: 'water', incantation: 'メイルシュトローム', desc: '5×5の大渦（威力18）。濡らして敵の行動を0.8秒遅らせる' },
  { id: 'deep_requiem', name: 'ディープブルー・レクイエム', kind: 'spell', cost: 7, requires: ['maelstrom'], pos: { x: 8, y: 3 }, branch: 'water', incantation: 'ディープブルー レクイエム', desc: '【究極】盤面すべて（威力30）を沈めて濡らす' },
  { id: 'aqua_lance', name: 'アクアランス', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 9, y: 7 }, branch: 'water', incantation: 'アクアランス', desc: '縦一列（威力15）を貫いて濡らす' },
  { id: 'aqua_ring', name: 'アクアリング', kind: 'spell', cost: 2, requires: ['aqua_lance'], pos: { x: 10, y: 6 }, branch: 'water', incantation: 'アクアリング', desc: '照準の周り8マス（威力14）を水の輪で囲む' },
  { id: 'water_dmg1', name: '水の加護', kind: 'passive', cost: 2, requires: ['wide_water'], pos: { x: 9, y: 6 }, branch: 'water', desc: '水の魔法の威力 ×1.15' },
  { id: 'water_dmg2', name: '水の真髄', kind: 'passive', cost: 3, requires: ['water_dmg1'], pos: { x: 9, y: 5 }, branch: 'water', desc: '水の魔法の威力 さらに×1.15' },
  { id: 'water_eco', name: '水の節約', kind: 'passive', cost: 2, requires: ['tidal'], pos: { x: 9, y: 4 }, branch: 'water', desc: '水の魔法の消費魔力 -15%' },
  // ---- fire
  { id: 'fire', name: 'ファイア', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 7, y: 8 }, branch: 'fire', incantation: 'ファイア', desc: '単体（威力30）。凍結中の敵には1.5倍' },
  { id: 'fire_up', name: 'ファイア強化', kind: 'passive', cost: 2, requires: ['fire'], pos: { x: 6, y: 8 }, branch: 'fire', desc: 'ファイアの威力 30 → 40' },
  { id: 'flare', name: 'フレア', kind: 'spell', cost: 3, requires: ['fire_up'], pos: { x: 5, y: 8 }, branch: 'fire', incantation: 'フレア', desc: '3×3の爆発（威力26）。凍結中1.5倍' },
  { id: 'inferno', name: 'インフェルノ', kind: 'spell', cost: 4, requires: ['flare'], pos: { x: 4, y: 8 }, branch: 'fire', incantation: 'インフェルノ', desc: '5×5の業火（威力28）。凍結中1.5倍' },
  { id: 'meteor', name: 'メテオ', kind: 'spell', cost: 4, requires: ['inferno'], pos: { x: 3, y: 8 }, branch: 'fire', incantation: 'メテオ', desc: '単体に隕石（威力75）。着弾まで遅い' },
  { id: 'catastrophe', name: 'ヘルファイア・カタストロフ', kind: 'spell', cost: 7, requires: ['meteor'], pos: { x: 2, y: 8 }, branch: 'fire', incantation: 'ヘルファイア カタストロフ', desc: '【究極】盤面すべて（威力55）を焼き尽くす' },
  { id: 'blaze', name: 'ブレイズ', kind: 'spell', cost: 1, requires: ['fire'], pos: { x: 6, y: 7 }, branch: 'fire', incantation: 'ブレイズ', desc: '横一列（威力18）を焼き払う' },
  { id: 'ifrit', name: 'イフリート', kind: 'spell', cost: 3, requires: ['flare'], pos: { x: 4, y: 7 }, branch: 'fire', incantation: 'イフリート', desc: '大十字（威力24）の業火' },
  { id: 'boost', name: 'パワー', kind: 'support', cost: 2, requires: ['fire'], pos: { x: 6, y: 9 }, branch: 'fire', incantation: 'パワー ○○', desc: '補助魔法。呪文の頭につけると、その攻撃の威力が1.5倍（魔力+27・詠唱+0.24秒）' },
  { id: 'boost_up', name: 'パワー強化', kind: 'passive', cost: 2, requires: ['boost'], pos: { x: 5, y: 9 }, branch: 'fire', desc: 'パワーの倍率 1.5倍 → 2倍' },
  { id: 'fire_dmg1', name: '炎の加護', kind: 'passive', cost: 2, requires: ['fire_up'], pos: { x: 5, y: 7 }, branch: 'fire', desc: '炎の魔法の威力 ×1.15' },
  { id: 'fire_dmg2', name: '炎の真髄', kind: 'passive', cost: 3, requires: ['fire_dmg1'], pos: { x: 4, y: 6 }, branch: 'fire', desc: '炎の魔法の威力 さらに×1.15' },
  { id: 'fire_eco', name: '炎の節約', kind: 'passive', cost: 2, requires: ['inferno'], pos: { x: 3, y: 7 }, branch: 'fire', desc: '炎の魔法の消費魔力 -15%' },
  // ---- thunder
  { id: 'thunder', name: 'サンダー', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 9, y: 8 }, branch: 'thunder', incantation: 'サンダー', desc: '周囲3×3にランダム4か所（威力15）。濡れたマスに引き寄せられ2倍' },
  { id: 'bolt_plus', name: 'ボルトプラス', kind: 'passive', cost: 2, requires: ['thunder'], pos: { x: 10, y: 8 }, branch: 'thunder', desc: 'サンダーの落ちる数 4か所 → 6か所' },
  { id: 'lightning', name: 'ライトニング', kind: 'spell', cost: 2, requires: ['bolt_plus'], pos: { x: 11, y: 8 }, branch: 'thunder', incantation: 'ライトニング', desc: '縦一列（威力20）。結界を貫く。濡れで2倍' },
  { id: 'vortex', name: 'ボルテックス', kind: 'spell', cost: 3, requires: ['lightning'], pos: { x: 12, y: 8 }, branch: 'thunder', incantation: 'ボルテックス', desc: '周囲5×5にランダム8か所（威力18）' },
  { id: 'thor', name: 'トール・ジャッジメント', kind: 'spell', cost: 7, requires: ['vortex'], pos: { x: 13, y: 8 }, branch: 'thunder', incantation: 'トール ジャッジメント', desc: '【究極】盤面に14の雷（威力32）。結界を貫く' },
  { id: 'spark', name: 'スパーク', kind: 'spell', cost: 1, requires: ['thunder'], pos: { x: 10, y: 9 }, branch: 'thunder', incantation: 'スパーク', desc: '安い単体（威力16）。濡れで2倍' },
  { id: 'shock_up', name: '感電強化', kind: 'passive', cost: 2, requires: ['bolt_plus'], pos: { x: 11, y: 9 }, branch: 'thunder', desc: '濡れたマスでの感電の倍率 2倍 → 3倍' },
  { id: 'plasma', name: 'プラズマ', kind: 'spell', cost: 2, requires: ['lightning'], pos: { x: 12, y: 7 }, branch: 'thunder', incantation: 'プラズマ', desc: '十字（威力22）。濡れで2倍' },
  { id: 'thunder_dmg1', name: '雷の加護', kind: 'passive', cost: 2, requires: ['spark'], pos: { x: 12, y: 9 }, branch: 'thunder', desc: '雷の魔法の威力 ×1.15' },
  { id: 'thunder_dmg2', name: '雷の真髄', kind: 'passive', cost: 3, requires: ['thunder_dmg1'], pos: { x: 13, y: 9 }, branch: 'thunder', desc: '雷の魔法の威力 さらに×1.15' },
  { id: 'thunder_eco', name: '雷の節約', kind: 'passive', cost: 2, requires: ['vortex'], pos: { x: 13, y: 7 }, branch: 'thunder', desc: '雷の魔法の消費魔力 -15%' },
  // ---- ice
  { id: 'ice', name: 'アイス', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 8, y: 9 }, branch: 'ice', incantation: 'アイス', desc: '単体（威力10）。命中すると敵を凍結' },
  { id: 'deep_freeze', name: 'ディープフリーズ', kind: 'passive', cost: 2, requires: ['ice'], pos: { x: 8, y: 10 }, branch: 'ice', desc: '凍結の時間 2.5秒 → 3.5秒' },
  { id: 'blizzard', name: 'ブリザード', kind: 'spell', cost: 3, requires: ['deep_freeze'], pos: { x: 8, y: 11 }, branch: 'ice', incantation: 'ブリザード', desc: '3×3の吹雪（威力8）。凍結' },
  { id: 'cocytus', name: 'コキュートス', kind: 'spell', cost: 4, requires: ['blizzard'], pos: { x: 8, y: 12 }, branch: 'ice', incantation: 'コキュートス', desc: '5×5の氷獄（威力14）。凍結' },
  { id: 'absolute_zero', name: 'アブソリュート・ゼロ', kind: 'spell', cost: 7, requires: ['cocytus'], pos: { x: 8, y: 13 }, branch: 'ice', incantation: 'アブソリュート ゼロ', desc: '【究極】盤面すべて（威力40）を4秒凍結' },
  { id: 'frost', name: 'フロスト', kind: 'spell', cost: 1, requires: ['ice'], pos: { x: 7, y: 10 }, branch: 'ice', incantation: 'フロスト', desc: '十字（威力9）。短い凍結' },
  { id: 'icicle', name: 'アイシクル', kind: 'spell', cost: 2, requires: ['deep_freeze'], pos: { x: 7, y: 11 }, branch: 'ice', incantation: 'アイシクル', desc: '縦一列（威力16）。短い凍結' },
  { id: 'ice_dmg1', name: '氷の加護', kind: 'passive', cost: 2, requires: ['frost'], pos: { x: 7, y: 12 }, branch: 'ice', desc: '氷の魔法の威力 ×1.15' },
  { id: 'ice_dmg2', name: '氷の真髄', kind: 'passive', cost: 3, requires: ['ice_dmg1'], pos: { x: 7, y: 13 }, branch: 'ice', desc: '氷の魔法の威力 さらに×1.15' },
  { id: 'ice_eco', name: '氷の節約', kind: 'passive', cost: 2, requires: ['cocytus'], pos: { x: 9, y: 13 }, branch: 'ice', desc: '氷の魔法の消費魔力 -15%' },
  // ---- wind
  { id: 'wind', name: 'ウインド', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 7, y: 7 }, branch: 'wind', incantation: 'ウインド', desc: '横一列（威力14）を薙ぎ払う' },
  { id: 'gale', name: 'ゲイル', kind: 'spell', cost: 2, requires: ['wind'], pos: { x: 6, y: 6 }, branch: 'wind', incantation: 'ゲイル', desc: '横3列（威力12）の疾風' },
  { id: 'tornado', name: 'トルネード', kind: 'spell', cost: 3, requires: ['gale'], pos: { x: 5, y: 5 }, branch: 'wind', incantation: 'トルネード', desc: '3×3の竜巻（威力20）。結界を貫く' },
  { id: 'tempest', name: 'テンペスト・オブ・ゼファー', kind: 'spell', cost: 7, requires: ['tornado'], pos: { x: 4, y: 4 }, branch: 'wind', incantation: 'テンペスト オブ ゼファー', desc: '【究極】縦横斜め（威力45）を切り裂く' },
  { id: 'air_cutter', name: 'エアカッター', kind: 'spell', cost: 2, requires: ['wind'], pos: { x: 5, y: 6 }, branch: 'wind', incantation: 'エアカッター', desc: '斜め2本（威力16）の真空刃。結界を貫く' },
  { id: 'swift', name: '疾風詠唱', kind: 'passive', cost: 3, requires: ['gale'], pos: { x: 4, y: 5 }, branch: 'wind', desc: '詠唱時間 -15%（移動以外）' },
  { id: 'wind_dmg1', name: '風の加護', kind: 'passive', cost: 2, requires: ['air_cutter'], pos: { x: 3, y: 5 }, branch: 'wind', desc: '風の魔法の威力 ×1.15' },
  { id: 'wind_dmg2', name: '風の真髄', kind: 'passive', cost: 3, requires: ['wind_dmg1'], pos: { x: 2, y: 4 }, branch: 'wind', desc: '風の魔法の威力 さらに×1.15' },
  { id: 'wind_eco', name: '風の節約', kind: 'passive', cost: 2, requires: ['tornado'], pos: { x: 3, y: 4 }, branch: 'wind', desc: '風の魔法の消費魔力 -15%' },
  // ---- earth
  { id: 'earth', name: 'アース', kind: 'spell', cost: 1, requires: ['water'], pos: { x: 10, y: 7 }, branch: 'earth', incantation: 'アース', desc: '縦一列（威力14）を岩柱で貫く' },
  { id: 'rock_blast', name: 'ロックブラスト', kind: 'spell', cost: 2, requires: ['earth'], pos: { x: 11, y: 6 }, branch: 'earth', incantation: 'ロックブラスト', desc: '単体（威力28）。結界を貫く' },
  { id: 'quake', name: 'クエイク', kind: 'spell', cost: 2, requires: ['rock_blast'], pos: { x: 12, y: 5 }, branch: 'earth', incantation: 'クエイク', desc: '縦3列（威力13）の地震' },
  { id: 'gaia', name: 'ガイアプレス', kind: 'spell', cost: 3, requires: ['quake'], pos: { x: 13, y: 4 }, branch: 'earth', incantation: 'ガイアプレス', desc: '5×5（威力20）。敵の行動を1.0秒遅らせる' },
  { id: 'terra_end', name: 'エンド・オブ・ジ・アース', kind: 'spell', cost: 7, requires: ['gaia'], pos: { x: 14, y: 3 }, branch: 'earth', incantation: 'エンド オブ ジ アース', desc: '【究極】盤面すべて（威力45）。敵の行動を3.0秒遅らせる' },
  { id: 'stone_skin', name: '岩の守り', kind: 'passive', cost: 2, requires: ['earth'], pos: { x: 12, y: 6 }, branch: 'earth', desc: 'ガードの軽減率 +15%' },
  { id: 'earth_dmg1', name: '土の加護', kind: 'passive', cost: 2, requires: ['rock_blast'], pos: { x: 13, y: 5 }, branch: 'earth', desc: '土の魔法の威力 ×1.15' },
  { id: 'earth_dmg2', name: '土の真髄', kind: 'passive', cost: 3, requires: ['earth_dmg1'], pos: { x: 14, y: 4 }, branch: 'earth', desc: '土の魔法の威力 さらに×1.15' },
  { id: 'earth_eco', name: '土の節約', kind: 'passive', cost: 2, requires: ['gaia'], pos: { x: 15, y: 3 }, branch: 'earth', desc: '土の魔法の消費魔力 -15%' },
  // ---- holy
  { id: 'guard', name: 'ガード', kind: 'command', cost: 1, requires: ['water'], pos: { x: 7, y: 9 }, branch: 'holy', incantation: 'ガード', desc: 'すぐに障壁（50%軽減・2.5秒）' },
  { id: 'heal', name: 'ヒール', kind: 'command', cost: 1, requires: ['guard'], pos: { x: 6, y: 10 }, branch: 'holy', incantation: 'ヒール', desc: 'HPを回復。10MPでHP1（ヒール 20 なら200MP。上限40）' },
  { id: 'heal_up', name: 'ハイヒール', kind: 'passive', cost: 2, requires: ['heal'], pos: { x: 5, y: 11 }, branch: 'holy', desc: 'ヒールの回復量 ×1.5' },
  { id: 'holy', name: 'ホーリー', kind: 'spell', cost: 2, requires: ['heal_up'], pos: { x: 4, y: 12 }, branch: 'holy', incantation: 'ホーリー', desc: '十字（威力20）。与えたダメージの30%を回復' },
  { id: 'judgment', name: 'ジャッジメント', kind: 'spell', cost: 3, requires: ['holy'], pos: { x: 3, y: 13 }, branch: 'holy', incantation: 'ジャッジメント', desc: '縦一列（威力24）。結界を貫き20%回復' },
  { id: 'sanctuary', name: 'セイクリッド・サンクチュアリ', kind: 'spell', cost: 7, requires: ['judgment'], pos: { x: 2, y: 14 }, branch: 'holy', incantation: 'セイクリッド サンクチュアリ', desc: '【究極】盤面すべて（威力35）。50%回復' },
  { id: 'counter', name: 'カウンターガード', kind: 'command', cost: 2, requires: ['guard'], pos: { x: 5, y: 10 }, branch: 'holy', incantation: 'カウンター ガード', desc: '次に当たる直前に自動で障壁' },
  { id: 'mana_max', name: 'マナ上限アップ', kind: 'passive', cost: 2, requires: ['heal'], pos: { x: 4, y: 11 }, branch: 'holy', desc: '魔力の最大値 +80' },
  { id: 'mana_max2', name: 'マナ上限アップII', kind: 'passive', cost: 3, requires: ['mana_max'], pos: { x: 2, y: 12 }, branch: 'holy', desc: '魔力の最大値 さらに+80' },
  { id: 'regen', name: 'リジェネ', kind: 'passive', cost: 3, requires: ['heal_up'], pos: { x: 3, y: 12 }, branch: 'holy', desc: 'HPが2秒に1回復する' },
  { id: 'hp_up', name: 'ライフアップ', kind: 'passive', cost: 2, requires: ['guard'], pos: { x: 6, y: 11 }, branch: 'holy', desc: '最大HP +25' },
  { id: 'hp_up2', name: 'ライフアップII', kind: 'passive', cost: 3, requires: ['hp_up'], pos: { x: 5, y: 12 }, branch: 'holy', desc: '最大HP さらに+25' },
  { id: 'holy_dmg1', name: '光の加護', kind: 'passive', cost: 2, requires: ['holy'], pos: { x: 2, y: 13 }, branch: 'holy', desc: '光の魔法の威力 ×1.15' },
  { id: 'holy_dmg2', name: '光の真髄', kind: 'passive', cost: 3, requires: ['holy_dmg1'], pos: { x: 0, y: 14 }, branch: 'holy', desc: '光の魔法の威力 さらに×1.15' },
  { id: 'holy_eco', name: '光の節約', kind: 'passive', cost: 2, requires: ['judgment'], pos: { x: 1, y: 14 }, branch: 'holy', desc: '光の魔法の消費魔力 -15%' },
  // ---- dark
  { id: 'predict', name: 'プレディクト', kind: 'command', cost: 1, requires: ['water'], pos: { x: 9, y: 9 }, branch: 'dark', incantation: 'プレディクト ○○', desc: '敵の逃げる先を予測して撃つ' },
  { id: 'quick', name: 'クイック', kind: 'command', cost: 1, requires: ['predict'], pos: { x: 10, y: 10 }, branch: 'dark', incantation: 'クイック ○○', desc: '着弾までの時間 0.9秒 → 0.45秒' },
  { id: 'shadow', name: 'シャドウ', kind: 'spell', cost: 2, requires: ['quick'], pos: { x: 11, y: 11 }, branch: 'dark', incantation: 'シャドウ', desc: '斜め2本（威力18）。敵の行動を0.5秒遅らせる' },
  { id: 'dark_bolt', name: 'ダークボルト', kind: 'spell', cost: 2, requires: ['shadow'], pos: { x: 12, y: 12 }, branch: 'dark', incantation: 'ダークボルト', desc: '単体（威力28）。結界を貫き、魔力-20' },
  { id: 'eclipse', name: 'エクリプス', kind: 'spell', cost: 3, requires: ['dark_bolt'], pos: { x: 13, y: 13 }, branch: 'dark', incantation: 'エクリプス', desc: '2マス先の輪（威力30）。敵の行動を1.2秒遅らせる' },
  { id: 'crypt_nova', name: 'クリプス・ノヴァ', kind: 'spell', cost: 5, requires: ['eclipse'], pos: { x: 14, y: 14 }, branch: 'dark', incantation: 'クリプス ノヴァ', desc: '周囲7×7にランダム10か所（威力26）。結界を貫く' },
  { id: 'apocalypse', name: 'アポカリプス', kind: 'spell', cost: 8, requires: ['crypt_nova'], pos: { x: 15, y: 15 }, branch: 'dark', incantation: 'アポカリプス', desc: '【究極】盤面すべて（威力70）。結界を貫き、敵の行動を2.0秒遅らせる' },
  { id: 'memento_mori', name: 'メメント・モリ', kind: 'spell', cost: 8, requires: ['crypt_nova'], pos: { x: 13, y: 15 }, branch: 'dark', incantation: 'メメント モリ', desc: '【究極】盤面すべて（威力45）。敵のHPが40%以下なら2.5倍。敵の行動を2.5秒遅らせる' },
  { id: 'veni_vidi_vici', name: 'ウェニー・ウィディー・ウィキー', kind: 'spell', cost: 5, requires: [], special: true, needCount: 25, pos: { x: -1, y: -1 }, branch: 'hybrid', incantation: 'ウェニー ウィディー ウィキー', desc: '【特別】「来た、見た、勝った」。この戦闘のあいだ攻撃力1.5倍。1回の戦闘で1度だけ使える。スキルを25個覚えると解放できる' },
  { id: 'deus_ex_machina', name: 'デウス・エクス・マキナ', kind: 'spell', cost: 10, requires: [], special: true, needCount: 50, pos: { x: -1, y: -1 }, branch: 'hybrid', incantation: 'デウス エクス マキナ', desc: '【特別】敵の今のHPを半分にする（結界も無視）。1回の戦闘で1度だけ使える。スキルを50個覚えると解放できる' },
  { id: 'fiat_nox', name: 'フィアト・ノクス', kind: 'spell', cost: 15, requires: [], special: true, pos: { x: -1, y: -1 }, branch: 'dark', incantation: 'フィアト ノクス', desc: '【真・最強】「闇あれ」。盤面すべて（威力999）。結界を貫き、時を止めて3秒凍結、30%回復' },
  { id: 'auto', name: '自律術式', kind: 'command', cost: 2, requires: ['predict'], pos: { x: 11, y: 10 }, branch: 'dark', incantation: 'オン アタック ○○', desc: '条件で自動発動する術式を1つ登録（オン アタック / オン ヒット / エブリ）' },
  { id: 'mana_regen', name: 'マナ回復アップ', kind: 'passive', cost: 2, requires: ['quick'], pos: { x: 12, y: 11 }, branch: 'dark', desc: '魔力の回復 +3/秒' },
  { id: 'mana_regen2', name: 'マナ回復アップII', kind: 'passive', cost: 3, requires: ['mana_regen'], pos: { x: 14, y: 12 }, branch: 'dark', desc: '魔力の回復 さらに+3/秒' },
  { id: 'drain', name: 'ドレイン', kind: 'spell', cost: 2, requires: ['shadow'], pos: { x: 13, y: 12 }, branch: 'dark', incantation: 'ドレイン', desc: '単体（威力20）。与えたダメージと同じだけ回復' },
  { id: 'finisher', name: '処刑人', kind: 'passive', cost: 3, requires: ['dark_bolt'], pos: { x: 14, y: 13 }, branch: 'dark', desc: '敵のHPが25%以下のとき、威力 ×1.5' },
  { id: 'mana_leech', name: 'マナリーチ', kind: 'passive', cost: 2, requires: ['drain'], pos: { x: 15, y: 13 }, branch: 'dark', desc: '攻撃が命中するたびに魔力+6' },
  { id: 'combo_master', name: 'コンボマスター', kind: 'passive', cost: 3, requires: ['auto'], pos: { x: 13, y: 11 }, branch: 'dark', desc: '融解 1.5倍→2倍、感電の倍率 +1' },
  { id: 'dark_dmg1', name: '闇の加護', kind: 'passive', cost: 2, requires: ['shadow'], pos: { x: 12, y: 13 }, branch: 'dark', desc: '闇の魔法の威力 ×1.15' },
  { id: 'dark_dmg2', name: '闇の真髄', kind: 'passive', cost: 3, requires: ['dark_dmg1'], pos: { x: 13, y: 14 }, branch: 'dark', desc: '闇の魔法の威力 さらに×1.15' },
  { id: 'dark_eco', name: '闇の節約', kind: 'passive', cost: 2, requires: ['eclipse'], pos: { x: 15, y: 14 }, branch: 'dark', desc: '闇の魔法の消費魔力 -15%' },
  // ---- hybrid
  { id: 'steam', name: 'スチームバースト', kind: 'spell', cost: 3, requires: ['flare', 'tidal'], requiresAll: true, pos: { x: 7, y: 6 }, branch: 'hybrid', incantation: 'スチームバースト', desc: '水と炎。3×3（威力22）を濡らし、凍結中1.5倍' },
  { id: 'storm', name: 'サンダーストーム', kind: 'spell', cost: 3, requires: ['tidal', 'lightning'], requiresAll: true, pos: { x: 10, y: 5 }, branch: 'hybrid', incantation: 'サンダーストーム', desc: '水と雷。ランダム6か所（威力20）。濡らしながら落ちて必ず感電' },
  { id: 'sandstorm', name: 'サンドストーム', kind: 'spell', cost: 3, requires: ['gale', 'quake'], requiresAll: true, pos: { x: 10, y: 4 }, branch: 'hybrid', incantation: 'サンドストーム', desc: '風と土。横3列（威力16）。敵の行動を0.8秒遅らせる' },
  { id: 'frost_nova', name: 'フロストノヴァ', kind: 'spell', cost: 3, requires: ['blizzard', 'tornado'], requiresAll: true, pos: { x: 4, y: 9 }, branch: 'hybrid', incantation: 'フロストノヴァ', desc: '氷と風。5×5（威力12）を2秒凍結' },
  { id: 'chaos', name: 'カオス・ディザスター', kind: 'spell', cost: 8, requires: ['judgment', 'eclipse'], requiresAll: true, pos: { x: 8, y: 14 }, branch: 'hybrid', incantation: 'カオス ディザスター', desc: '【究極】光と闇。盤面すべて（威力60）。結界を貫き30%回復' },
];

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const TOTAL_SP = SKILLS.reduce((n, s) => n + s.cost, 0);
export const INITIAL_UNLOCKED = ['water'];

const BRANCHES: Branch[] = ['water', 'fire', 'thunder', 'ice', 'wind', 'earth', 'holy', 'dark', 'hybrid'];
const COMMAND_SKILLS: CommandKey[] = ['guard', 'counter', 'heal', 'predict', 'quick', 'auto', 'boost'];

/** 習得済みスキルから決まる「使えるもの」と「強化された数値」 */
export interface Loadout {
  spells: Set<SpellKey>;
  commands: Set<CommandKey>;
  /** ウォーターの範囲（一辺のマス数） */
  waterSize: 3 | 5;
  wetMs: number;
  fireDamage: number;
  thunderBolts: number;
  /** 感電（濡れたマス）の倍率 */
  thunderWetMult: number;
  /** 融解（凍結中）の倍率 */
  meltMult: number;
  freezeMs: number;
  /** パワーをつけた攻撃の威力倍率 */
  boostMult: number;
  manaMax: number;
  manaRegen: number;
  /** 枝ごとの威力倍率・消費魔力倍率 */
  branchDmg: Record<Branch, number>;
  branchEco: Record<Branch, number>;
  healMult: number;
  /** HP の自然回復（毎秒） */
  hpRegen: number;
  /** ガードの軽減率に足す値 */
  guardBonus: number;
  /** 詠唱時間の倍率（移動以外） */
  castMult: number;
  hpMax: number;
  /** 敵のHPが25%以下のときの威力倍率 */
  finisherMult: number;
  /** 命中したときに回復する魔力 */
  manaLeech: number;
}

export function computeLoadout(unlocked: Iterable<string>): Loadout {
  const u = new Set(unlocked);
  const branchDmg = Object.fromEntries(BRANCHES.map((b) => [b, (u.has(b + '_dmg1') ? 1.15 : 1) * (u.has(b + '_dmg2') ? 1.15 : 1)])) as Record<Branch, number>;
  const branchEco = Object.fromEntries(BRANCHES.map((b) => [b, u.has(b + '_eco') ? 0.85 : 1])) as Record<Branch, number>;
  const combo = u.has('combo_master');
  return {
    spells: new Set(SPELL_KEYS.filter((k) => u.has(k))),
    commands: new Set(COMMAND_SKILLS.filter((c) => u.has(c))),
    waterSize: u.has('wide_water') ? 5 : 3,
    wetMs: u.has('long_wet') ? 10_000 : ELEMENT_RULES.WET_DURATION_MS,
    fireDamage: u.has('fire_up') ? 40 : ELEMENTS.fire.damage,
    thunderBolts: u.has('bolt_plus') ? 6 : ELEMENT_RULES.THUNDER_BOLTS,
    thunderWetMult: (u.has('shock_up') ? 3 : ELEMENT_RULES.THUNDER_WET_MULTIPLIER) + (combo ? 1 : 0),
    meltMult: combo ? 2 : ELEMENT_RULES.MELT_MULTIPLIER,
    freezeMs: u.has('deep_freeze') ? 3500 : ELEMENT_RULES.FREEZE_MS,
    boostMult: u.has('boost_up') ? 2 : 1.5,
    manaMax: MANA.MAX + (u.has('mana_max') ? 80 : 0) + (u.has('mana_max2') ? 80 : 0),
    manaRegen: MANA.REGEN_PER_SEC + (u.has('mana_regen') ? 3 : 0) + (u.has('mana_regen2') ? 3 : 0),
    branchDmg,
    branchEco,
    healMult: u.has('heal_up') ? 1.5 : 1,
    hpRegen: u.has('regen') ? 0.5 : 0,
    guardBonus: u.has('stone_skin') ? 0.15 : 0,
    castMult: u.has('swift') ? 0.85 : 1,
    hpMax: PLAYER.MAX_HP + (u.has('hp_up') ? 25 : 0) + (u.has('hp_up2') ? 25 : 0),
    finisherMult: u.has('finisher') ? 1.5 : 1,
    manaLeech: u.has('mana_leech') ? 6 : 0,
  };
}

/** すべての魔法・コマンドが使えて、強化は無し（テストや練習用の既定値） */
export const BASE_ALL_LOADOUT: Loadout = {
  ...computeLoadout([]),
  spells: new Set(SPELL_KEYS),
  commands: new Set(COMMAND_SKILLS),
};

/** 特別枠の解放まで、あと何個スキルを覚える必要があるか */
export function specialRemaining(def: SkillDef, unlocked: Set<string>): number {
  const normal = SKILLS.filter((s) => !s.special);
  const have = normal.filter((s) => unlocked.has(s.id)).length;
  return Math.max(0, (def.needCount ?? normal.length) - have);
}

export type UnlockCheck = { ok: true } | { ok: false; reason: string };

export function canUnlock(id: string, unlocked: Set<string>, sp: number): UnlockCheck {
  const def = SKILL_BY_ID.get(id);
  if (!def) return { ok: false, reason: '存在しないスキル' };
  if (unlocked.has(id)) return { ok: false, reason: '習得済み' };
  if (def.special) {
    const rest = specialRemaining(def, unlocked);
    if (rest > 0) return { ok: false, reason: def.needCount ? `スキルを${def.needCount}個覚えると解放できる（あと${rest}個）` : `ほかのスキルをすべて解放すると解放できる（残り${rest}個）` };
  }
  const names = (ids: string[]) => ids.map((r) => SKILL_BY_ID.get(r)?.name).join('」と「');
  if (def.requiresAll) {
    const missing = def.requires.filter((r) => !unlocked.has(r));
    if (missing.length > 0) return { ok: false, reason: `先に「${names(missing)}」を覚える` };
  } else if (def.requires.length > 0 && !def.requires.some((r) => unlocked.has(r))) {
    return { ok: false, reason: `先に「${def.requires.map((r) => SKILL_BY_ID.get(r)?.name).join('」か「')}」を覚える` };
  }
  if (sp < def.cost) return { ok: false, reason: `SPが足りない（必要${def.cost}）` };
  return { ok: true };
}

// ---------------------------------------------------------------- ステージ（敵の強さ）と SP

export const STAGE = {
  /** 敗北でも得る SP / 最初に持っている SP */
  SP_LOSE: 1,
  SP_START: 2,
} as const;

/** ステージ stage で勝ったときにもらえる SP（先に進むほど多い） */
export function spForWin(stage: number): number {
  return 3 + Math.floor(Math.max(1, stage) / 3);
}

export interface StageStats {
  enemyHp: number;
  /** 敵の攻撃力の倍率 */
  enemyPower: number;
  /** 敵が行動を考える間隔 (ms) */
  thinkMs: number;
  /** 5戦ごとの強敵 */
  elite: boolean;
  /** 10戦ごとの段階（1〜10戦目が 0） */
  tier: number;
}

/**
 * 敵の強さ。
 * - 10戦ごとに一律で強くなる（1〜10 / 11〜20 / 21〜30 …で段階が上がる。段階の中では伸びない）
 * - 5戦ごと（5, 10, 15 …）は「強敵」で少し強め
 */
/**
 * 敵の強さの決め方。ステージが1つ進むごとに少しずつ強くなり、5の倍数は強敵。
 * 数字は tests/balance（BALANCE=20 npx vitest run tests/balance）のボット対戦で決めた：
 * 「ふつう」のボットが勝率7〜9割・残りHP4割前後、「うまい」ボットはほぼ必ず勝って残りHP8割以上。
 */
export const STAGE_RULES = {
  BASE_HP: 120,
  BASE_POWER: 0.9,
  BASE_THINK_MS: 3200,
  /** 1ステージごとの上がり幅（HP は割合、攻撃は倍率に足す、考える時間は ms 減る） */
  HP_PER_STAGE: 0.08,
  POWER_PER_STAGE: 0.012,
  THINK_PER_STAGE: 20,
  /** 強敵の倍率 */
  ELITE_HP: 1.12,
  ELITE_POWER: 1.06,
  ELITE_THINK_MS: 200,
  MIN_THINK_MS: 2000,
};

/** 1-1 の敵の HP */
const FIRST_HP = 80;

export function stageStats(stage: number): StageStats {
  const st = Math.max(1, Math.floor(stage));
  const tier = Math.floor((st - 1) / 10);
  const elite = st % 5 === 0;
  const R = STAGE_RULES;
  const k = st - 1;
  return {
    // 1-1（最初の戦闘）だけは、操作に慣れてもらうために HP 80
    enemyHp: st === 1 ? FIRST_HP : Math.round(R.BASE_HP * (1 + R.HP_PER_STAGE * k) * (elite ? R.ELITE_HP : 1)),
    enemyPower: Math.round((R.BASE_POWER + R.POWER_PER_STAGE * k) * (elite ? R.ELITE_POWER : 1) * 100) / 100,
    thinkMs: Math.max(R.MIN_THINK_MS, R.BASE_THINK_MS - R.THINK_PER_STAGE * k - (elite ? R.ELITE_THINK_MS : 0)),
    elite,
    tier,
  };
}
