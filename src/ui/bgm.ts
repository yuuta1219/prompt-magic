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

function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

let cur: { name: BgmName; el: HTMLAudioElement } | null = null;

/** 流す曲を決める（同じ曲なら続きから流しっぱなし）。null で止める */
export function playBgm(name: BgmName | null): void {
  if (!soundOn()) name = null;
  if (cur?.name === name) {
    // 自動再生が止められていた曲は、次の操作のときにもう一度試す
    if (cur && cur.el.paused) cur.el.play().then(() => fade(cur!.el, VOLUME, FADE_MS)).catch(() => {});
    return;
  }
  const old = cur;
  if (old) fade(old.el, 0, FADE_MS, () => old.el.pause());
  cur = null;
  if (!name) return;
  const el = new Audio(`${BASE}${name}.mp3`);
  el.loop = true;
  el.volume = 0;
  el.play().then(() => fade(el, VOLUME, FADE_MS)).catch(() => {});
  cur = { name, el };
}

// 自動再生がブラウザに止められたとき（最初のプロローグなど）、最初のクリックで流しはじめる
if (typeof window !== 'undefined') {
  const retry = () => {
    if (cur?.el.paused) cur.el.play().then(() => fade(cur!.el, VOLUME, FADE_MS)).catch(() => {});
  };
  window.addEventListener('pointerdown', retry);
  window.addEventListener('keydown', retry);
}
