/**
 * 魔法の定義（唯一の情報源）。魔法はすべてデータで、1行足せば増やせる。
 *
 * 攻撃の「形」「威力」「効果」は魔法ごとに決まっている。詠唱の言葉で変えられるのは
 * 照準（現在地 / 予測）と着弾までの時間、補助魔法（パワー）だけ。発数は指定できない。
 * エンジン・魔力計算・解釈器・UI はすべてここを参照する。
 */

/** 攻撃範囲の形。中心は照準のマス */
export type Shape =
  | { k: 'single' }
  | { k: 'square'; r: number } // 一辺 2r+1 の正方形
  | { k: 'row'; w: number } // 横 w 列（照準の行を中心に）
  | { k: 'col'; w: number } // 縦 w 列
  | { k: 'cross'; r: number } // 十字（腕の長さ r）
  | { k: 'x' } // 斜め2本（盤面の端まで）
  | { k: 'star' } // 縦横斜め（盤面の端まで）
  | { k: 'ring'; r: number } // 照準からちょうど r 離れた輪（照準そのものは含まない）
  | { k: 'board' } // 敵の盤面すべて
  | { k: 'random'; n: number; r: number }; // 照準の周囲 (2r+1)² のどこかに n か所（濡れたマスに引き寄せられる）

/** 着弾したときの効果 */
export interface Effects {
  /** 着弾マスを「濡れ」にする（当たり外れに関係なく） */
  wet?: boolean;
  /** 命中すると凍結。数値なら凍結時間(ms)、true ならスキル込みの標準時間 */
  freeze?: boolean | number;
  /** 凍結中の敵に1.5倍（融解） */
  melt?: boolean;
  /** 濡れたマスにいる敵に2倍（感電） */
  shock?: boolean;
  /** 与えたダメージのこの割合だけ HP を回復（吸収） */
  drain?: number;
  /** 命中すると敵の魔力をこれだけ削る */
  manaBreak?: number;
  /** 敵の防御結界を無視する */
  pierce?: boolean;
  /** 敵のHPが below（割合）以下なら威力 ×mult（とどめの一撃） */
  execute?: { below: number; mult: number };
  /** 命中すると敵の今のHPを半分にする（威力・結界は無視） */
  halve?: boolean;
  /** 攻撃ではなく自分への強化: この戦闘のあいだ攻撃力をこの倍率にする */
  selfBuff?: number;
}

export type Branch = 'water' | 'fire' | 'thunder' | 'ice' | 'wind' | 'earth' | 'holy' | 'dark' | 'hybrid';

interface RawDef {
  name: string;
  /** 詠唱で通じる言葉（カタカナはスペースや「・」なしで書く） */
  words: string[];
  branch: Branch;
  shape: Shape;
  damage: number;
  /** 効果コスト（魔力） */
  cost: number;
  effects?: Effects;
  /** 詠唱時間の追加 (ms)。大魔法ほど長い */
  castExtraMs?: number;
  /** 着弾までの時間の追加 (ms) */
  delayExtraMs?: number;
  /** 究極魔法（演出・表示用） */
  ultimate?: boolean;
  /** 1回の戦闘で1度しか使えない */
  oncePerBattle?: boolean;
  summary: string;
}

const RAW = {
  // ================================================================ 水
  water: { name: 'ウォーター', words: ['ウォーター', 'ウオーター', 'ウォータ', 'アクア', 'water', 'aqua'], branch: 'water', shape: { k: 'square', r: 1 }, damage: 12, cost: 32, effects: { wet: true }, summary: '照準の周囲に水を降らせる。最初から使える基本魔法。' },
  aqua_lance: { name: 'アクアランス', words: ['アクアランス', 'aqualance'], branch: 'water', shape: { k: 'col', w: 1 }, damage: 15, cost: 36, effects: { wet: true }, summary: '水の槍で縦一列を貫き、濡らす。' },
  aqua_ring: { name: 'アクアリング', words: ['アクアリング', 'aquaring'], branch: 'water', shape: { k: 'ring', r: 1 }, damage: 14, cost: 34, effects: { wet: true }, summary: '照準の周りの8マスを水の輪で囲む。逃げ道をふさぐ。' },
  tidal: { name: 'タイダル', words: ['タイダルウェーブ', 'タイダル', 'tidal'], branch: 'water', shape: { k: 'row', w: 3 }, damage: 10, cost: 48, effects: { wet: true }, summary: '横3列を大波が押し流し、すべて濡らす。' },
  maelstrom: { name: 'メイルシュトローム', words: ['メイルシュトローム', 'maelstrom'], branch: 'water', shape: { k: 'square', r: 2 }, damage: 18, cost: 70, effects: { wet: true, manaBreak: 30 }, castExtraMs: 300, summary: '5×5の大渦。敵の魔力も渦に飲み込む。' },
  deep_requiem: { name: 'ディープブルー・レクイエム', words: ['ディープブルーレクイエム'], branch: 'water', shape: { k: 'board' }, damage: 30, cost: 170, effects: { wet: true }, castExtraMs: 1500, ultimate: true, summary: '深海の鎮魂歌。敵の盤面すべてを沈め、濡らす。' },
  // ================================================================ 炎
  fire: { name: 'ファイア', words: ['ファイア', 'ファイアー', 'ファイヤ', 'ファイヤー', 'フレイム', 'fire', 'flame'], branch: 'fire', shape: { k: 'single' }, damage: 30, cost: 40, effects: { melt: true }, summary: '照準の1マスを焼く。単体の威力が高い。' },
  blaze: { name: 'ブレイズ', words: ['ブレイズ', 'blaze'], branch: 'fire', shape: { k: 'row', w: 1 }, damage: 18, cost: 40, effects: { melt: true }, summary: '炎の帯で横一列を焼き払う。' },
  flare: { name: 'フレア', words: ['フレア', 'flare'], branch: 'fire', shape: { k: 'square', r: 1 }, damage: 26, cost: 50, effects: { melt: true }, summary: '3×3を爆炎で包む。' },
  ifrit: { name: 'イフリート', words: ['イフリート', 'ifrit'], branch: 'fire', shape: { k: 'cross', r: 2 }, damage: 24, cost: 55, effects: { melt: true }, summary: '炎の魔人の十字の業火（腕の長さ2）。' },
  inferno: { name: 'インフェルノ', words: ['インフェルノ', 'inferno'], branch: 'fire', shape: { k: 'square', r: 2 }, damage: 28, cost: 80, effects: { melt: true }, castExtraMs: 500, summary: '5×5を地獄の炎で焼き尽くす。' },
  meteor: { name: 'メテオ', words: ['メテオ', 'meteor'], branch: 'fire', shape: { k: 'single' }, damage: 75, cost: 85, effects: { melt: true }, castExtraMs: 600, delayExtraMs: 1500, summary: '隕石を落とす。威力は絶大だが、着弾まで遅く避けられやすい。凍結と合わせたい。' },
  catastrophe: { name: 'ヘルファイア・カタストロフ', words: ['ヘルファイアカタストロフ'], branch: 'fire', shape: { k: 'board' }, damage: 55, cost: 190, effects: { melt: true }, castExtraMs: 1800, ultimate: true, summary: '獄炎の大災厄。敵の盤面すべてを焼き尽くす。' },
  // ================================================================ 雷
  thunder: { name: 'サンダー', words: ['サンダー', 'サンダ', 'thunder'], branch: 'thunder', shape: { k: 'random', n: 4, r: 1 }, damage: 15, cost: 30, effects: { shock: true }, summary: '照準の周囲にランダムで落ちる。濡れたマスに引き寄せられる。' },
  spark: { name: 'スパーク', words: ['スパーク', 'spark'], branch: 'thunder', shape: { k: 'single' }, damage: 16, cost: 26, effects: { shock: true }, summary: '安くて速い電撃。濡れていれば2倍。' },
  lightning: { name: 'ライトニング', words: ['ライトニング', 'lightning'], branch: 'thunder', shape: { k: 'col', w: 1 }, damage: 20, cost: 46, effects: { shock: true, pierce: true }, summary: '縦一列を貫く稲妻。防御結界も貫く。' },
  plasma: { name: 'プラズマ', words: ['プラズマ', 'plasma'], branch: 'thunder', shape: { k: 'cross', r: 1 }, damage: 22, cost: 50, effects: { shock: true }, summary: '十字に弾けるプラズマ。' },
  vortex: { name: 'ボルテックス', words: ['ボルテックス', 'vortex'], branch: 'thunder', shape: { k: 'random', n: 8, r: 2 }, damage: 18, cost: 64, effects: { shock: true }, summary: '雷の渦。周囲5×5に8か所落ちる。' },
  thor: { name: 'トール・ジャッジメント', words: ['トールジャッジメント'], branch: 'thunder', shape: { k: 'random', n: 14, r: 4 }, damage: 32, cost: 180, effects: { shock: true, pierce: true }, castExtraMs: 1600, ultimate: true, summary: '雷神の裁き。盤面に14の雷が降り注ぐ。' },
  // ================================================================ 氷
  ice: { name: 'アイス', words: ['アイス', 'ice'], branch: 'ice', shape: { k: 'single' }, damage: 10, cost: 34, effects: { freeze: true }, summary: '照準の1マスを凍らせる。命中すると敵が凍結する。' },
  frost: { name: 'フロスト', words: ['フロスト', 'frost'], branch: 'ice', shape: { k: 'cross', r: 1 }, damage: 9, cost: 38, effects: { freeze: 1500 }, summary: '十字の霜。凍結は短め（1.5秒）。' },
  icicle: { name: 'アイシクル', words: ['アイシクル', 'icicle'], branch: 'ice', shape: { k: 'col', w: 1 }, damage: 16, cost: 42, effects: { freeze: 1200 }, summary: '縦一列に氷柱を降らせる。凍結は短め（1.2秒）。' },
  blizzard: { name: 'ブリザード', words: ['ブリザード', 'blizzard'], branch: 'ice', shape: { k: 'square', r: 1 }, damage: 8, cost: 44, effects: { freeze: true }, summary: '3×3の吹雪。逃げられにくい凍結。' },
  cocytus: { name: 'コキュートス', words: ['コキュートス', 'cocytus'], branch: 'ice', shape: { k: 'square', r: 2 }, damage: 14, cost: 72, effects: { freeze: true }, castExtraMs: 400, summary: '5×5を氷獄に閉ざす。' },
  absolute_zero: { name: 'アブソリュート・ゼロ', words: ['アブソリュートゼロ'], branch: 'ice', shape: { k: 'board' }, damage: 40, cost: 175, effects: { freeze: 4000 }, castExtraMs: 1600, ultimate: true, summary: '絶対零度。盤面すべてを4秒凍結させる。' },
  // ================================================================ 風
  wind: { name: 'ウインド', words: ['ウインド', 'ウィンド', 'wind'], branch: 'wind', shape: { k: 'row', w: 1 }, damage: 14, cost: 32, summary: '横一列を薙ぎ払う。' },
  gale: { name: 'ゲイル', words: ['ゲイル', 'gale'], branch: 'wind', shape: { k: 'row', w: 3 }, damage: 12, cost: 44, summary: '横3列を吹き抜ける疾風。' },
  air_cutter: { name: 'エアカッター', words: ['エアカッター', 'aircutter'], branch: 'wind', shape: { k: 'x' }, damage: 16, cost: 40, effects: { pierce: true }, summary: '斜め2本の真空刃。防御結界を貫く。' },
  tornado: { name: 'トルネード', words: ['トルネード', 'tornado'], branch: 'wind', shape: { k: 'square', r: 1 }, damage: 20, cost: 52, effects: { pierce: true }, summary: '3×3の竜巻。防御結界を貫く。' },
  tempest: { name: 'テンペスト・オブ・ゼファー', words: ['テンペストオブゼファー'], branch: 'wind', shape: { k: 'star' }, damage: 45, cost: 170, effects: { pierce: true }, castExtraMs: 1500, ultimate: true, summary: '西風の大嵐。縦横斜めを同時に切り裂く。' },
  // ================================================================ 土
  earth: { name: 'アース', words: ['アース', 'ストーン', 'earth', 'stone'], branch: 'earth', shape: { k: 'col', w: 1 }, damage: 14, cost: 32, summary: '縦一列を岩柱で貫く。' },
  rock_blast: { name: 'ロックブラスト', words: ['ロックブラスト', 'rockblast'], branch: 'earth', shape: { k: 'single' }, damage: 28, cost: 42, effects: { pierce: true }, summary: '岩塊を撃ち込む。防御結界を貫く。' },
  quake: { name: 'クエイク', words: ['クエイク', 'quake'], branch: 'earth', shape: { k: 'col', w: 3 }, damage: 13, cost: 46, summary: '縦3列を揺らす地震。' },
  gaia: { name: 'ガイアプレス', words: ['ガイアプレス', 'gaiapress'], branch: 'earth', shape: { k: 'square', r: 2 }, damage: 20, cost: 72, effects: { manaBreak: 40 }, castExtraMs: 400, summary: '大地の重圧で5×5を押しつぶし、魔力も削る。' },
  terra_end: { name: 'エンド・オブ・ジ・アース', words: ['エンドオブジアース'], branch: 'earth', shape: { k: 'board' }, damage: 45, cost: 180, effects: { manaBreak: 120 }, castExtraMs: 1600, ultimate: true, summary: '大地の終焉。盤面すべてを砕き、敵の魔力を大きく削る。' },
  // ================================================================ 光
  holy: { name: 'ホーリー', words: ['ホーリー', 'holy'], branch: 'holy', shape: { k: 'cross', r: 1 }, damage: 20, cost: 50, effects: { drain: 0.3 }, summary: '十字の聖光。与えたダメージの30%を回復。' },
  judgment: { name: 'ジャッジメント', words: ['ジャッジメント', 'judgment', 'judgement'], branch: 'holy', shape: { k: 'col', w: 1 }, damage: 24, cost: 54, effects: { pierce: true, drain: 0.2 }, summary: '縦一列への審判。結界を貫き、20%を回復。' },
  sanctuary: { name: 'セイクリッド・サンクチュアリ', words: ['セイクリッドサンクチュアリ'], branch: 'holy', shape: { k: 'board' }, damage: 35, cost: 175, effects: { drain: 0.5 }, castExtraMs: 1500, ultimate: true, summary: '聖域の顕現。盤面すべてを浄化し、50%を回復。' },
  // ================================================================ 闇
  shadow: { name: 'シャドウ', words: ['シャドウ', 'シャドー', 'shadow'], branch: 'dark', shape: { k: 'x' }, damage: 18, cost: 42, effects: { manaBreak: 20 }, summary: '斜め2本の影。敵の魔力を削る。' },
  dark_bolt: { name: 'ダークボルト', words: ['ダークボルト', 'darkbolt'], branch: 'dark', shape: { k: 'single' }, damage: 28, cost: 44, effects: { pierce: true, manaBreak: 20 }, summary: '闇の矢。結界を貫き、魔力を削る。' },
  drain: { name: 'ドレイン', words: ['ドレイン', 'drain'], branch: 'dark', shape: { k: 'single' }, damage: 20, cost: 46, effects: { drain: 1 }, summary: '与えたダメージと同じだけ HP を吸い取る。' },
  eclipse: { name: 'エクリプス', words: ['エクリプス', 'eclipse'], branch: 'dark', shape: { k: 'ring', r: 2 }, damage: 30, cost: 66, effects: { manaBreak: 50 }, summary: '日蝕の輪。照準から2マス離れた輪を闇が覆う。' },
  crypt_nova: { name: 'クリプス・ノヴァ', words: ['クリプスノヴァ', 'クリプスノバ'], branch: 'dark', shape: { k: 'random', n: 10, r: 3 }, damage: 26, cost: 110, effects: { pierce: true }, castExtraMs: 800, summary: '冥府の新星。周囲7×7に10の闇が炸裂する。' },
  apocalypse: { name: 'アポカリプス', words: ['アポカリプス', 'apocalypse'], branch: 'dark', shape: { k: 'board' }, damage: 70, cost: 190, effects: { pierce: true, manaBreak: 80 }, castExtraMs: 2000, ultimate: true, summary: '黙示録。世界の終わりを告げ、盤面すべてを押しつぶす。' },
  memento_mori: { name: 'メメント・モリ', words: ['メメントモリ', 'mementomori'], branch: 'dark', shape: { k: 'board' }, damage: 45, cost: 170, effects: { execute: { below: 0.4, mult: 2.5 }, manaBreak: 100 }, castExtraMs: 1800, ultimate: true, summary: '死を想え。弱った敵（HP40%以下）には2.5倍の死の宣告。とどめの魔法。' },
  veni_vidi_vici: { name: 'ウェニー・ウィディー・ウィキー', words: ['ウェニーウィディーウィキー', 'ウェニウィディウィキ', 'ウェーニーウィーディーウィーキー', 'ヴェニヴィディヴィキ', 'ヴェニーヴィディーヴィキー', 'ベニビディビキ', 'ベニービディービキー', 'ウェイニービーディウィーキー', 'ウェイニービディウィキ', 'venividivici'], branch: 'hybrid', shape: { k: 'single' }, damage: 0, cost: 60, effects: { selfBuff: 1.5 }, castExtraMs: 500, oncePerBattle: true, summary: '「来た、見た、勝った」（カエサル）。勝利を宣言し、この戦闘のあいだ攻撃力が1.5倍になる。1回の戦闘で1度だけ。' },
  deus_ex_machina: { name: 'デウス・エクス・マキナ', words: ['デウスエクスマキナ', 'deusexmachina'], branch: 'hybrid', shape: { k: 'board' }, damage: 0, cost: 100, effects: { halve: true }, castExtraMs: 1000, ultimate: true, oncePerBattle: true, summary: '機械仕掛けの神。物語を無理やり終わらせる神が降り、敵の今のHPを半分にする。1回の戦闘で1度だけ。' },
  fiat_nox: { name: 'フィアト・ノクス', words: ['フィアトノクス', 'フィアットノクス', 'フィアトノックス', 'フィアットノックス', 'fiatnox'], branch: 'dark', shape: { k: 'board' }, damage: 999, cost: 270, effects: { pierce: true, manaBreak: 9999, freeze: 3000, drain: 0.3 }, castExtraMs: 3200, ultimate: true, summary: '「闇あれ」（Fiat nox）。神が「光あれ」で世界を始めたように、この一言で世界を終わらせる。時を止め、敵の魔力を消し去り、盤面すべてを闇に還す真の最強魔法。' },
  // ================================================================ 合体魔法（2つの枝を極めると覚えられる）
  steam: { name: 'スチームバースト', words: ['スチームバースト', 'steamburst'], branch: 'hybrid', shape: { k: 'square', r: 1 }, damage: 22, cost: 56, effects: { wet: true, melt: true }, summary: '水と炎の合体魔法。3×3の蒸気爆発で濡らす。' },
  storm: { name: 'サンダーストーム', words: ['サンダーストーム', 'thunderstorm'], branch: 'hybrid', shape: { k: 'random', n: 6, r: 2 }, damage: 20, cost: 62, effects: { wet: true, shock: true }, summary: '水と雷の合体魔法。濡らしながら落ちるので必ず感電する。' },
  sandstorm: { name: 'サンドストーム', words: ['サンドストーム', 'sandstorm'], branch: 'hybrid', shape: { k: 'row', w: 3 }, damage: 16, cost: 60, effects: { manaBreak: 30 }, summary: '風と土の合体魔法。横3列の砂嵐で魔力を削る。' },
  frost_nova: { name: 'フロストノヴァ', words: ['フロストノヴァ', 'フロストノバ'], branch: 'hybrid', shape: { k: 'square', r: 2 }, damage: 12, cost: 66, effects: { freeze: 2000 }, summary: '氷と風の合体魔法。5×5を凍てつかせる。' },
  chaos: { name: 'カオス・ディザスター', words: ['カオスディザスター'], branch: 'hybrid', shape: { k: 'board' }, damage: 60, cost: 200, effects: { pierce: true, drain: 0.3 }, castExtraMs: 2000, ultimate: true, summary: '光と闇の合体究極魔法。混沌が盤面を飲み込む。' },
} satisfies Record<string, RawDef>;

export type SpellKey = keyof typeof RAW;
export const SPELL_KEYS = Object.keys(RAW) as SpellKey[];

export interface ElementDef extends RawDef {
  key: SpellKey;
  shapeLabel: string;
  /** 効果の説明 */
  combo: string;
  /** 解説パネルのミニ図（5×5、中央が照準）。1=攻撃マス、2=ランダム候補 */
  pattern: number[][];
  /** 魔法の色（"r, g, b"） */
  color: string;
}

export const BRANCH_COLOR: Record<Branch, string> = {
  water: '61, 139, 255',
  fire: '255, 122, 61',
  thunder: '255, 225, 77',
  ice: '127, 216, 255',
  wind: '125, 255, 196',
  earth: '212, 162, 106',
  holy: '255, 240, 180',
  dark: '199, 125, 255',
  hybrid: '255, 140, 220',
};

export function shapeLabel(s: Shape): string {
  switch (s.k) {
    case 'single': return '単体';
    case 'square': return `${2 * s.r + 1}×${2 * s.r + 1}`;
    case 'row': return s.w === 1 ? '横一列' : `横${s.w}列`;
    case 'col': return s.w === 1 ? '縦一列' : `縦${s.w}列`;
    case 'cross': return s.r === 1 ? '十字' : `大十字（${s.r}）`;
    case 'x': return '斜め2本';
    case 'star': return '縦横斜め';
    case 'ring': return s.r === 1 ? '周囲8マス' : `${s.r}マス先の輪`;
    case 'board': return '盤面すべて';
    case 'random': return `ランダム${s.n}か所`;
  }
}

function effectsLabel(e: Effects | undefined): string {
  if (!e) return '特殊効果なし。';
  const out: string[] = [];
  if (e.wet) out.push('着弾マスを濡らす');
  if (e.freeze) out.push(typeof e.freeze === 'number' ? `命中で凍結（${e.freeze / 1000}秒）` : '命中で凍結');
  if (e.melt) out.push('凍結中の敵に1.5倍');
  if (e.shock) out.push('濡れたマスの敵に2倍');
  if (e.drain) out.push(`ダメージの${Math.round(e.drain * 100)}%を回復`);
  if (e.manaBreak) out.push(e.manaBreak >= 9999 ? '敵の魔力をすべて消す' : `敵の魔力-${e.manaBreak}`);
  if (e.pierce) out.push('防御結界を貫く');
  if (e.selfBuff) out.push(`この戦闘のあいだ攻撃力${e.selfBuff}倍（攻撃はしない）`);
  if (e.halve) out.push('命中すると敵の今のHPを半分にする');
  if (e.execute) out.push(`敵のHPが${Math.round(e.execute.below * 100)}%以下なら${e.execute.mult}倍`);
  return out.join('・') + '。';
}

/** 5×5 のミニ図（中心が照準） */
function patternOf(s: Shape): number[][] {
  const g = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) {
      const ax = Math.abs(x), ay = Math.abs(y);
      let v = 0;
      switch (s.k) {
        case 'single': v = x === 0 && y === 0 ? 1 : 0; break;
        case 'square': v = ax <= s.r && ay <= s.r ? 1 : 0; break;
        case 'row': v = ay <= (s.w - 1) / 2 ? 1 : 0; break;
        case 'col': v = ax <= (s.w - 1) / 2 ? 1 : 0; break;
        case 'cross': v = (x === 0 && ay <= s.r) || (y === 0 && ax <= s.r) ? 1 : 0; break;
        case 'x': v = ax === ay ? 1 : 0; break;
        case 'star': v = ax === ay || x === 0 || y === 0 ? 1 : 0; break;
        case 'ring': v = Math.max(ax, ay) === s.r ? 1 : 0; break;
        case 'board': v = 1; break;
        case 'random': v = ax <= s.r && ay <= s.r ? 2 : 0; break;
      }
      g[y + 2][x + 2] = v;
    }
  return g;
}

export const ELEMENTS = Object.fromEntries(
  (Object.entries(RAW) as [SpellKey, RawDef][]).map(([key, d]) => [
    key,
    { ...d, key, shapeLabel: shapeLabel(d.shape), combo: effectsLabel(d.effects), pattern: patternOf(d.shape), color: BRANCH_COLOR[d.branch] },
  ]),
) as Record<SpellKey, ElementDef>;

/** 解説パネルの並び順 */
export const ELEMENT_ORDER: SpellKey[] = SPELL_KEYS;

export const ELEMENT_RULES = {
  WET_DURATION_MS: 6000,
  THUNDER_BOLTS: 4,
  THUNDER_RADIUS: 1,
  THUNDER_WET_MULTIPLIER: 2,
  FREEZE_MS: 2500,
  MELT_MULTIPLIER: 1.5,
  /** 1回の詠唱で複数の攻撃を唱えたとき、2つ目以降の着弾をずらす (ms) */
  CHAIN_STAGGER_MS: 450,
} as const;
