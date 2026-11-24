/**
 * 戦闘の BGM。前半は歌なしの曲、敵の HP が半分を切ったら歌ありのアップテンポな曲へ、なめらかに切り替える。
 *
 * 曲は public/bgm/ に置く（無ければ何も鳴らない）:
 *   battle-1.mp3 … 前半（歌なし）
 *   battle-2.mp3 … 敵の HP 50% 以下（英語の歌あり・アップテンポ）
 * 音の ON/OFF は効果音と同じ設定。
 */
import { soundOn } from './sound';

const BASE = '../bgm/';
const VOLUME = 0.35;
const FADE_MS = 1500;

type Track = 'battle-1' | 'battle-2';

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

export class BattleBgm {
  private cur: { track: Track; el: HTMLAudioElement } | null = null;

  /** 流す曲を決める（同じ曲なら何もしない）。null で止める */
  play(track: Track | null): void {
    if (!soundOn()) track = null;
    if (this.cur?.track === track) return;
    const old = this.cur;
    if (old) fade(old.el, 0, FADE_MS, () => old.el.pause());
    this.cur = null;
    if (!track) return;
    const el = new Audio(`${BASE}${track}.mp3`);
    el.loop = true;
    el.volume = 0;
    el.play().then(() => fade(el, VOLUME, FADE_MS)).catch(() => {});
    this.cur = { track, el };
  }

  stop(): void {
    this.play(null);
  }
}
