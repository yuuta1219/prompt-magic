/**
 * セリフの音声ファイルの名前。話す人とセリフから決める（FNV-1a の16進）。
 * セリフを書き換えると名前が変わるので、変わったセリフだけ作り直せばよい。
 * scripts/voice.mts（音声を作る側）と紙芝居（鳴らす側）の両方で使う。import を持たないこと。
 */
export function voiceKey(who: string, text: string): string {
  let h = 0x811c9dc5;
  const s = `${who}\u0000${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 声をつける人（VOICEVOX のキャラ）。ここに無い人（遊び方・効果音など）は声なし */
export const VOICE_CAST: Record<string, { speaker: number; name: string; speed?: number; pitch?: number; intonation?: number }> = {
  やにかわ: { speaker: 116, name: 'あんこもん（けだるげ）', speed: 1.1 },
  管理術式オラクル: { speaker: 53, name: '麒ヶ島宗麟', speed: 1.05 },
  ナレーション: { speaker: 31, name: 'No.7（読み聞かせ）', speed: 1.2 },
  機械音: { speaker: 89, name: 'Voidoll', speed: 1.1 },
  記録: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 1.05 },
  自販機型術式体: { speaker: 89, name: 'Voidoll', speed: 0.9, pitch: -0.06 },
  門番術式体ケルベロス: { speaker: 21, name: '剣崎雌雄', speed: 0.95, pitch: -0.06 },
};

/** 声に出すときだけ読みを直す（画面の文字はそのまま） */
export function speakable(text: string): string {
  return text
    .replace(/汝/g, 'なんじ')
    .replace(/我は/g, 'われは')
    .replace(/術式霧/g, 'じゅつしききり')
    .replace(/唱え/g, 'となえ') // 「うたえ」と読まれる
    .replace(/なき者/g, 'なきもの') // 「なきしゃ」と読まれる
    .replace(/門を開け/g, 'もんをひらけ') // 「あけ」と読まれる
    .replace(/delete/gi, 'デリート')
    .replace(/[“”「」]/g, '')
    .replace(/――/g, '、');
}
