/**
 * BGM。画面（マップ・紙芝居・戦闘）が変わっても1つの再生機で流し、曲が変わるときはクロスフェードする。
 * 曲は public/bgm/<名前>.mp3（無ければ何も鳴らない）。音の ON/OFF は効果音と同じ設定。
 *
 *   main        メインテーマ（すごろくマップ）
 *   underground 地下の紙芝居
 *   tension     緊張（ボスの前の紙芝居）
 *   battle-1    戦闘の前半（歌なし）
 *   battle-2    戦闘の後半（敵の HP 50% 以下・歌あり）
 *   boss        ボス戦
 *   ending      エンディング
 */
import { soundOn } from './sound';

export type BgmName = 'main' | 'underground' | 'tension' | 'battle-1' | 'battle-2' | 'boss' | 'ending';

const BASE = '../bgm/';
const VOLUME = 0.35;
const FADE_MS = 1500;

/** 音量を少しずつ変える。同じ要素に新しいフェードをかけたら、前のフェードは打ち切る */
const fadeToken = new WeakMap<HTMLAudioElement, number>();
function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const token = (fadeToken.get(a) ?? 0) + 1;
  fadeToken.set(a, token);
  const from = a.volume;
  const t0 = performance.now();
  const step = () => {
    if (fadeToken.get(a) !== token) return;
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** 作った BGM の要素ぜんぶ（止め忘れを防ぐため、いま流すべき1曲以外は必ず止める） */
const all = new Set<HTMLAudioElement>();
let cur: { name: BgmName; el: HTMLAudioElement } | null = null;

/** 同じ曲の別バージョン。切り替えるとき、前の曲が流れていた位置から続ける（前半を1分聞いていたら、後半も1分のところから） */
const SAME_SONG: BgmName[][] = [['battle-1', 'battle-2']];
const sameSong = (a: BgmName, b: BgmName) => SAME_SONG.some((g) => g.includes(a) && g.includes(b));

function retire(el: HTMLAudioElement, withFade: boolean) {
  const stop = () => {
    el.pause();
    all.delete(el);
  };
  if (withFade && !el.paused) fade(el, 0, FADE_MS, stop);
  else {
    fadeToken.set(el, (fadeToken.get(el) ?? 0) + 1); // 進行中のフェードを止める
    stop();
  }
}

/** 再生を始めて、フェードインする。始まるまでの間にほかの曲に替わっていたら、すぐ止める */
function start(el: HTMLAudioElement) {
  el.play()
    .then(() => {
      if (cur?.el !== el) return retire(el, false);
      fade(el, VOLUME, FADE_MS);
    })
    .catch(() => {});
}

/** 流す曲を決める（同じ曲なら続きから流しっぱなし）。null で止める */
export function playBgm(name: BgmName | null): void {
  if (!soundOn()) name = null;
  if (cur && cur.name === name) {
    // 自動再生が止められていた曲は、次の操作のときにもう一度試す
    if (cur.el.paused) start(cur.el);
    return;
  }
  const old = cur;
  cur = null;
  // 音を消したときは、フェードせずにすぐ全部止める
  for (const el of [...all]) retire(el, name !== null && el === old?.el);
  if (!name) return;
  const el = new Audio(`${BASE}${name}.mp3`);
  el.loop = true;
  el.volume = 0;
  if (old && sameSong(old.name, name)) {
    const t = old.el.currentTime;
    // 曲の長さが分かってから位置を合わせる（後半のほうが短ければ、頭に戻る）
    el.addEventListener('loadedmetadata', () => (el.currentTime = el.duration ? t % el.duration : t), { once: true });
  }
  all.add(el);
  cur = { name, el };
  start(el);
}

// 自動再生がブラウザに止められたとき（最初のプロローグなど）、最初のクリックで流しはじめる
if (typeof window !== 'undefined') {
  const retry = () => {
    if (cur?.el.paused) start(cur.el);
  };
  window.addEventListener('pointerdown', retry);
  window.addEventListener('keydown', retry);
}

// 開発中（npm run dev）にこのファイルが書き換わったら、古いほうの曲を止める（止めないと曲が重なる）
if (import.meta.hot) import.meta.hot.dispose(() => all.forEach((el) => el.pause()));
