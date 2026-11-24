/** ストーリー（紙芝居）のデータの形 */

export interface StoryLine {
  /** 話している人。空文字なら効果音、省略ならナレーションの中央表示 */
  who?: string;
  text: string;
  /** 一緒に鳴らす効果音（【効果音】の言葉から決まる） */
  sfx?: 'lighter' | 'splash' | 'rumble' | 'clank';
}

export interface StoryPage {
  /** 絵（public/story/ の下、拡張子なし）。無いときは色だけで見せる */
  img?: string;
  /** 画面の色合い */
  tone?: 'black' | 'alarm' | 'holy' | 'dim' | 'dusk' | 'white' | 'guide';
  /** ページが出たときの演出 */
  fx?: 'shake' | 'flash' | 'water' | 'fire';
  /** 話タイトルなど、中央に大きく出すページ */
  title?: boolean;
  lines: StoryLine[];
}

export interface StoryScene {
  id: string;
  pages: StoryPage[];
  /** この紙芝居で流す BGM（public/bgm/ の名前） */
  bgm?: string;
}

/** すごろくの1マス = 1チャプター。紙芝居（前）→ 戦闘 → 紙芝居（後） */
export interface Chapter {
  id: string;
  /** マスに出す番号と名前 */
  no: number;
  title: string;
  /** 戦闘の強さ（ステージ番号と同じ強さになる。5の倍数は強敵） */
  stage: number;
  enemy: string;
  /** 戦闘での敵の画像（public/units/ の下、拡張子なし） */
  sprite?: string;
  /** 群れの敵の数（HP がこの数に分かれる） */
  units?: number;
  /** ボスのギミック */
  boss?: import('../game/EnemyAI').BossKind;
  /** マスの絵（public/story/ の下、拡張子なし） */
  thumb?: string;
  /** 戦闘の前に流す紙芝居 */
  before: StoryPage[];
  /** 勝ったあとに流す紙芝居 */
  after: StoryPage[];
  /** エンドロールのあとに流す紙芝居（台本の「### エンドロールのあと」） */
  postCredits?: StoryPage[];
  /** 負けイベント：負けても話が進む（台本の「### 負けたあと」） */
  loseEvent?: boolean;
  /** BGM: 紙芝居（前・後）と戦闘（前半, 後半） */
  bgm?: { before?: string; after?: string; battle?: [string, string] };
}

export interface Episode {
  id: string;
  title: string;
  subtitle: string;
  prologue: StoryScene;
  chapters: Chapter[];
  /** マップのプロローグのマス（絵・見出し・説明） */
  prologueThumb?: string;
  prologueTitle?: string;
  prologueDesc?: string;
  /** クリアしたあと、次の話のマスに出す絵 */
  nextThumb?: string;
  /** マップ（チャプター選択）で流す曲。話ごとのメインテーマ */
  mapBgm?: string;
}
