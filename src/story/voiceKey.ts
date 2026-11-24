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
  ナレーション: { speaker: 29, name: 'No.7', speed: 1.1 },
  機械音: { speaker: 89, name: 'Voidoll', speed: 1.1 },
  記録: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 1.05 },
  自販機型術式体: { speaker: 89, name: 'Voidoll', speed: 0.9, pitch: -0.06 },
  門番術式体ケルベロス: { speaker: 21, name: '剣崎雌雄', speed: 0.95, pitch: -0.06 },
  // 第2話
  少女: { speaker: 14, name: '冥鳴ひまり', speed: 1.05 }, // 名乗る前のノワール
  ノワール: { speaker: 14, name: '冥鳴ひまり', speed: 1.05 },
  ミナト: { speaker: 14, name: '冥鳴ひまり', speed: 1.0 },
  長老: { speaker: 42, name: 'ちび式じい', speed: 1.0 },
  村人: { speaker: 11, name: '玄野武宏', speed: 1.1 },
  電波塔術式体トウキョウ: { speaker: 13, name: '青山龍星', speed: 0.95, pitch: -0.05 },
  声: { speaker: 13, name: '青山龍星', speed: 0.9, pitch: -0.08 },
  // 第3話（「ソラの文字」「ハルの文字」は筆談なので声なし）
  ソラ: { speaker: 12, name: '白上虎太郎', speed: 1.0 },
  ハル: { speaker: 58, name: '猫使ビィ', speed: 0.95 },
  母: { speaker: 109, name: '東北イタコ', speed: 1.0 },
  フィルター術式体: { speaker: 89, name: 'Voidoll', speed: 1.0 },
  フィルター術式体の残骸: { speaker: 89, name: 'Voidoll', speed: 0.9, pitch: -0.04 },
  モデレーター: { speaker: 89, name: 'Voidoll', speed: 0.85, pitch: -0.1 },
  // 第4話〜第7話
  改札術式体: { speaker: 89, name: 'Voidoll', speed: 1.05 },
  記録の声: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 1.0 },
  認証の声: { speaker: 48, name: 'ナースロボ＿タイプＴ（楽々）', speed: 1.0 },
  駅舎術式体ステーションマスター: { speaker: 21, name: '剣崎雌雄', speed: 0.9, pitch: -0.06 },
  入館管理術式体: { speaker: 89, name: 'Voidoll', speed: 1.0 },
  上司の記録: { speaker: 52, name: '雀松朱司', speed: 1.05 },
  過去のやにかわ: { speaker: 116, name: 'あんこもん（けだるげ）', speed: 1.0 },
  未処理例外術式体: { speaker: 89, name: 'Voidoll', speed: 0.95, pitch: -0.04 },
  '統合術式体M&A': { speaker: 13, name: '青山龍星', speed: 0.9, pitch: -0.06 },
  炎上の亡霊: { speaker: 117, name: 'あんこもん（ささやき）', speed: 1.0 },
  謎の声: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 0.9, pitch: -0.05 },
  軍用ロボ: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 0.9, pitch: -0.05 },
  サージ: { speaker: 47, name: 'ナースロボ＿タイプＴ', speed: 0.9, pitch: -0.05 },
  防衛術式体アイギス: { speaker: 89, name: 'Voidoll', speed: 0.9, pitch: -0.08 },
  完全体試作: { speaker: 102, name: 'ユーレイちゃん', speed: 1.0 },
};

/** やにかわの（ ）つきのセリフは、声に出せない場面の心の声なので、ささやき声にする */
export const WHISPER: Record<string, number> = { やにかわ: 117 };
export function speakerFor(who: string, text: string): number {
  return text.startsWith('（') && WHISPER[who] ? WHISPER[who] : VOICE_CAST[who].speaker;
}

/** 声に出すときだけ読みを直す（画面の文字はそのまま） */
/** ロボのセリフ（「止メロ」「残ッテイル」のように送りがながカタカナ）を読めるように、漢字のあとのカタカナをひらがなにする */
function robotKana(text: string): string {
  if (!/[一-龥々][ァ-ヶ]/.test(text)) return text;
  return text
    .replace(/([一-龥々])([ァ-ヶー]+)/g, (_, k: string, kana: string) => k + kana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)))
    .replace(/ハ(?=[、。！？]|$)/g, 'わ');
}

export function speakable(text: string): string {
  return robotKana(text)
    .replace(/汝/g, 'なんじ')
    .replace(/我は/g, 'われは')
    .replace(/術式霧/g, 'じゅつしききり')
    .replace(/唱え/g, 'となえ') // 「うたえ」と読まれる
    .replace(/なき者/g, 'なきもの') // 「なきしゃ」と読まれる
    .replace(/門を開け/g, 'もんをひらけ') // 「あけ」と読まれる
    .replace(/delete/gi, 'デリート')
    .replace(/[《》（）]/g, '')
    .replace(/天穿つ/g, 'てんうがつ')
    .replace(/魔塔/g, 'まとう')
    .replace(/災禍姫/g, 'さいかひめ')
    .replace(/我が/g, 'わが')
    .replace(/我も/g, 'われも')
    .replace(/我らが/g, 'われらが')
    .replace(/我らの/g, 'われらの')
    .replace(/我の/g, 'われの')
    .replace(/我こそは/g, 'われこそは')
    .replace(/我を/g, 'われを')
    .replace(/顕現/g, 'けんげん')
    .replace(/煉獄/g, 'れんごく')
    .replace(/迷い人/g, 'まよいびと') // 「まよいじん」と読まれる
    .replace(/五分だ/g, 'ごふんだ') // 「ごぶだ」と読まれる
    .replace(/無言の民/g, 'むごんのたみ') // 「みん」と読まれる
    .replace(/し者/g, 'しもの') // 「導かれし者」が「しゃ」と読まれる
    .replace(/神じゃ/g, 'かみじゃ') // 「じんじゃ（神社）」と読まれる
    .replace(/十分。/g, 'じゅっぷん。') // 「じゅうぶん」と読まれる
    .replace(/右腕/g, 'みぎうで') // 「うわん」と読まれる
    .replace(/一行/g, 'いちぎょう') // 「いっこう」と読まれる
    .replace(/術式体/g, 'じゅつしきたい') // 「消音術式体だ」が「からだ」と読まれる
    .replace(/ワードハ/g, 'ワードワ') // カタカナの「ハ」が「は」と読まれる
    .replace(/止めれば/g, 'とめれば') // 「やめれば」と読まれる
    .replace(/^……は？$/, 'はっ？') // 「わ？」と読まれる
    .replace(/て消えた/g, 'てきえた') // 「ぎえた」と読まれる
    .replace(/MISSION……FAILED/g, 'ミッション……フェイルド')
    .replace(/US……ARMY/g, 'ユーエス……アーミー')
    .replace(/TODO/g, 'トゥードゥー')
    .replace(/M&A/g, 'エムアンドエー')
    .replace(/AI/g, 'エーアイ')
    .replace(/体の/g, 'からだの')
    .replace(/体が/g, 'からだが')
    .replace(/体に/g, 'からだに')
    .replace(/[“”「」]/g, '')
    .replace(/――/g, '、');
}
