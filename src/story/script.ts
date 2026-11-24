/**
 * 台本テキスト（src/story/ep1.txt など）を、紙芝居のデータに変える。
 * 台本は人がそのまま書き換えられる形にしてある。書き方:
 *
 *   # 第1話「話の名前」
 *   ## プロローグ
 *   ## チャプター1「タイトル」（敵: 敵の名前）
 *   ### 戦闘の前 / ### 勝ったあと（負けイベントは ### 負けたあと）
 *   --- ページ1（絵:01-pod / 色:alarm / 演出:shake）   ← 絵なし・色・演出は省略できる
 *   名前「セリフ」          ← 行の最後の 」 までがセリフ
 *   【中央】文字            ← 画面の真ん中に出る（全部が【中央】のページは話タイトルの扱い）
 *   【効果音】カチッ。      ← 名前なしで出る。言葉によって効果音が鳴る
 */
import type { StoryLine, StoryPage } from './types';

export interface ParsedChapter {
  no: number;
  title: string;
  enemy: string;
  before: StoryPage[];
  after: StoryPage[];
  /** 負けイベント（「### 負けたあと」がある）。戦闘に負けても話が進む */
  loseEvent?: boolean;
  /** エンドロールのあとに流す紙芝居（「### エンドロールのあと」） */
  postCredits: StoryPage[];
}

export interface ParsedScript {
  title: string;
  subtitle: string;
  prologue: StoryPage[];
  chapters: ParsedChapter[];
}

const TONES = ['black', 'alarm', 'holy', 'dim', 'dusk', 'white', 'guide'] as const;
const FXS = ['shake', 'flash', 'water', 'fire'] as const;

/** 【効果音】の言葉から鳴らす音を決める */
export function sfxFor(text: string): StoryLine['sfx'] {
  if (/カチッ/.test(text)) return 'lighter';
  if (/バシャ|ザバ/.test(text)) return 'splash';
  if (/ゴゴゴ/.test(text)) return 'rumble';
  if (/ガコン|ガシャ/.test(text)) return 'clank';
  return undefined;
}

function parseMeta(meta: string): Omit<StoryPage, 'lines'> {
  const page: Omit<StoryPage, 'lines'> = {};
  // 区切りは「 / 」（前後に空白）。絵の名前の中の / （ep2/01-ruins など）では区切らない
  for (const part of meta.split(/\s+\/\s+/).map((x) => x.trim())) {
    const [k, v] = part.split(':').map((x) => x?.trim());
    if (k === '絵' && v) page.img = v.includes('/') ? v : `ep1/${v}`;
    if (k === '色' && (TONES as readonly string[]).includes(v)) page.tone = v as StoryPage['tone'];
    if (k === '演出' && (FXS as readonly string[]).includes(v)) page.fx = v as StoryPage['fx'];
  }
  return page;
}

function parseLine(raw: string): StoryLine | null {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith('【中央】')) return { text: line.slice(4).trim() };
  if (line.startsWith('【効果音】')) {
    const text = line.slice(5).trim();
    return { who: '', text, sfx: sfxFor(text) };
  }
  const open = line.indexOf('「');
  const close = line.lastIndexOf('」');
  if (open > 0 && close > open) return { who: line.slice(0, open).trim(), text: line.slice(open + 1, close) };
  // カギかっこが無い行は、ナレーションの扱い
  return { who: 'ナレーション', text: line };
}

export function parseScript(text: string): ParsedScript {
  const out: ParsedScript = { title: '', subtitle: '', prologue: [], chapters: [] };
  let target: StoryPage[] | null = null;
  let page: StoryPage | null = null;
  const finishPage = () => {
    if (page && target && page.lines.length) {
      // 全部が【中央】のページは、話タイトルとして大きく出す
      if (page.lines.every((l) => l.who === undefined) && page.tone === 'black') page.title = true;
      target.push(page);
    }
    page = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#\s+(.+?)「(.+)」/)) && !line.startsWith('##')) {
      out.title = m[1].trim();
      out.subtitle = m[2].trim();
    } else if (/^##\s+プロローグ/.test(line)) {
      finishPage();
      target = out.prologue;
    } else if ((m = line.match(/^##\s+チャプター(\d+)「(.+)」(?:（敵[:：]\s*(.+?)）)?/))) {
      finishPage();
      out.chapters.push({ no: Number(m[1]), title: m[2].trim(), enemy: (m[3] ?? '').trim(), before: [], after: [], postCredits: [] });
      target = out.chapters[out.chapters.length - 1].before;
    } else if (/^###\s+戦闘の前/.test(line)) {
      finishPage();
      target = out.chapters[out.chapters.length - 1]?.before ?? null;
    } else if (/^###\s+勝ったあと/.test(line)) {
      finishPage();
      target = out.chapters[out.chapters.length - 1]?.after ?? null;
    } else if (/^###\s+エンドロールのあと/.test(line)) {
      finishPage();
      target = out.chapters[out.chapters.length - 1]?.postCredits ?? null;
    } else if (/^###\s+負けたあと/.test(line)) {
      finishPage();
      const ch = out.chapters[out.chapters.length - 1];
      if (ch) ch.loseEvent = true;
      target = ch?.after ?? null;
    } else if ((m = line.match(/^---\s*ページ\d*\s*(?:[（(](.*)[)）])?/))) {
      finishPage();
      page = { ...parseMeta(m[1] ?? ''), lines: [] };
    } else if (page) {
      const l = parseLine(line);
      if (l) (page as StoryPage).lines.push(l);
    }
  }
  finishPage();
  return out;
}
