/**
 * 音声認識の表記ゆれを吸収するための「かな」処理。
 *
 * 音声認識は同じ言葉でも「うぇにー」「ウェニー」「ウエニ」「ヴェニ」「Wiki」「森」のように
 * 毎回ちがう表記で返してくる（漢字に変換しない設定は Web Speech API に無い）。
 * そこで、呪文の辞書と聞き取った言葉の両方を「かなのキー」にそろえて比べる。
 */

/** ひらがな → カタカナ */
export function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

const SMALL: Record<string, string> = { ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ', ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ヮ: 'ワ', ヵ: 'カ', ヶ: 'ケ' };

/**
 * カタカナを比較用のキーにする。
 * 小さい字は大きく、「ヴ」は「ブ」行、伸ばす音「ー」・小さい「ッ」・区切り「・」は消す。
 *   ウェニー / ウエニ / ヴェニー → ウエニ（ヴェはベになる。ヴ系は別キーになるので辞書側に両方入れる必要はない）
 */
export function kanaKey(s: string): string {
  return s
    .replace(/ヴァ/g, 'バ')
    .replace(/ヴィ/g, 'ビ')
    .replace(/ヴェ/g, 'ベ')
    .replace(/ヴォ/g, 'ボ')
    .replace(/ヴ/g, 'ブ')
    .replace(/[ァィゥェォャュョヮヵヶ]/g, (c) => SMALL[c])
    .replace(/[ーッ・\s]/g, '');
}

/** 呪文の一部がよく化ける漢字 → カタカナ（音声認識の誤変換対策） */
export const KANJI_READINGS: Record<string, string> = {
  森: 'モリ',
  守: 'モリ',
  杜: 'モリ',
  盛り: 'モリ',
  干支: 'エト',
  上: 'アップ',
  下: 'ダウン',
  右: 'ライト',
  左: 'レフト',
};

// ---------------------------------------------------------------- ローマ字 → カタカナ（アルファベットで返ってきた知らない単語用）

const ROMAJI: [string, string][] = [
  ['kya', 'キャ'], ['kyu', 'キュ'], ['kyo', 'キョ'], ['sha', 'シャ'], ['shu', 'シュ'], ['sho', 'ショ'], ['chi', 'チ'], ['cha', 'チャ'], ['chu', 'チュ'], ['cho', 'チョ'],
  ['tsu', 'ツ'], ['shi', 'シ'], ['nya', 'ニャ'], ['hya', 'ヒャ'], ['mya', 'ミャ'], ['rya', 'リャ'], ['gya', 'ギャ'], ['ja', 'ジャ'], ['ju', 'ジュ'], ['jo', 'ジョ'],
  ['wi', 'ウィ'], ['we', 'ウェ'], ['wo', 'ウォ'], ['vi', 'ヴィ'], ['va', 'ヴァ'], ['ve', 'ヴェ'], ['vo', 'ヴォ'], ['vu', 'ヴ'], ['fa', 'ファ'], ['fi', 'フィ'], ['fe', 'フェ'], ['fo', 'フォ'],
  ['di', 'ディ'], ['ti', 'ティ'], ['du', 'ドゥ'], ['tu', 'トゥ'], ['ci', 'チ'], ['ce', 'セ'], ['qu', 'ク'], ['th', 'ス'], ['ph', 'フ'],
  ['ka', 'カ'], ['ki', 'キ'], ['ku', 'ク'], ['ke', 'ケ'], ['ko', 'コ'], ['sa', 'サ'], ['si', 'シ'], ['su', 'ス'], ['se', 'セ'], ['so', 'ソ'],
  ['ta', 'タ'], ['te', 'テ'], ['to', 'ト'], ['na', 'ナ'], ['ni', 'ニ'], ['nu', 'ヌ'], ['ne', 'ネ'], ['no', 'ノ'], ['ha', 'ハ'], ['hi', 'ヒ'], ['fu', 'フ'], ['hu', 'フ'], ['he', 'ヘ'], ['ho', 'ホ'],
  ['ma', 'マ'], ['mi', 'ミ'], ['mu', 'ム'], ['me', 'メ'], ['mo', 'モ'], ['ya', 'ヤ'], ['yu', 'ユ'], ['yo', 'ヨ'], ['ra', 'ラ'], ['ri', 'リ'], ['ru', 'ル'], ['re', 'レ'], ['ro', 'ロ'],
  ['la', 'ラ'], ['li', 'リ'], ['lu', 'ル'], ['le', 'レ'], ['lo', 'ロ'], ['wa', 'ワ'], ['ga', 'ガ'], ['gi', 'ギ'], ['gu', 'グ'], ['ge', 'ゲ'], ['go', 'ゴ'], ['za', 'ザ'], ['ji', 'ジ'], ['zi', 'ジ'], ['zu', 'ズ'], ['ze', 'ゼ'], ['zo', 'ゾ'],
  ['da', 'ダ'], ['de', 'デ'], ['do', 'ド'], ['ba', 'バ'], ['bi', 'ビ'], ['bu', 'ブ'], ['be', 'ベ'], ['bo', 'ボ'], ['pa', 'パ'], ['pi', 'ピ'], ['pu', 'プ'], ['pe', 'ペ'], ['po', 'ポ'],
  ['a', 'ア'], ['i', 'イ'], ['u', 'ウ'], ['e', 'エ'], ['o', 'オ'], ['n', 'ン'],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];

const CONSONANT_ONLY: Record<string, string> = { k: 'ク', s: 'ス', t: 'ト', p: 'プ', b: 'ブ', d: 'ド', g: 'グ', m: 'ム', r: 'ル', l: 'ル', f: 'フ', v: 'ブ', x: 'クス', c: 'ク', h: '', w: 'ウ', y: 'イ', z: 'ズ', j: 'ジ', q: 'ク' };

/** アルファベットの単語をローマ字読みでカタカナにする（"wiki" → "ウィキ"） */
export function romajiToKata(word: string): string {
  let out = '';
  let i = 0;
  const w = word.toLowerCase();
  while (i < w.length) {
    // 同じ子音が2つ続いたら小さい「ッ」
    if (i + 1 < w.length && w[i] === w[i + 1] && !'aeioun'.includes(w[i])) {
      out += 'ッ';
      i++;
      continue;
    }
    const hit = ROMAJI.find(([r]) => w.startsWith(r, i));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else {
      out += CONSONANT_ONLY[w[i]] ?? '';
      i++;
    }
  }
  return out;
}

/** 編集距離（レーベンシュタイン距離） */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
