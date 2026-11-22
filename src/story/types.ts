/** ストーリー（紙芝居）のデータの形 */

export interface StoryLine {
  /** 話している人。空文字なら効果音、省略ならナレーションの中央表示 */
  who?: string;
  text: string;
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
  /** このステージの戦闘の前に流す */
  before?: number;
  /** このステージに勝ったあとに流す */
  afterWin?: number;
  pages: StoryPage[];
}

export interface Episode {
  id: string;
  title: string;
  subtitle: string;
  stages: number[];
  /** ステージごとの敵の名前 */
  enemies: Record<number, string>;
  scenes: StoryScene[];
}
