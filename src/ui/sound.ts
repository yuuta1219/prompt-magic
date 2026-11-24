/**
 * 戦闘中の効果音と、やにかわの魔法名の声。
 * 音の ON/OFF は紙芝居と同じ設定（localStorage の prompt-magic.sound）を使う。
 * ファイルは public/sfx/ と public/voice/spell/。ゲームは /play/ にあるのでひとつ上を見る。
 */
import spellVoices from './spellVoices.json';

const SFX_BASE = '../sfx/';
const SPELL_VOICE_BASE = '../voice/spell/';
const SOUND_KEY = 'prompt-magic.sound';
const HAS_SPELL_VOICE = new Set<string>(spellVoices as string[]);

export type Sfx =
  | 'chant' | 'glitch' | 'cast' | 'fizzle' | 'warn' | 'hurt' | 'move' | 'guard' | 'heal' | 'win' | 'lose' | 'ultimate'
  | `hit-${'flame' | 'meteor' | 'splash' | 'bolt' | 'ice' | 'icicle' | 'wind' | 'tornado' | 'earth' | 'rock' | 'holy' | 'dark' | 'steam'}`;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* 保存できなくてもよい */
  }
}

/** 同じ音が一瞬に何回も重なるとうるさいので、同じ音は少し間を空ける */
const lastPlayed = new Map<string, number>();

export function playSfx(name: Sfx, volume = 0.5): void {
  if (!soundOn()) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < 80) return;
  lastPlayed.set(name, now);
  const a = new Audio(`${SFX_BASE}${name}.mp3`);
  a.volume = volume;
  a.play().catch(() => {});
}

let voiceQueue: string[] = [];
let voicePlaying: HTMLAudioElement | null = null;
function nextVoice() {
  const key = voiceQueue.shift();
  if (!key) {
    voicePlaying = null;
    return;
  }
  const a = new Audio(`${SPELL_VOICE_BASE}${key}.mp3`);
  a.volume = 0.95;
  a.onended = nextVoice;
  a.onerror = nextVoice;
  voicePlaying = a;
  a.play().catch(nextVoice);
}

/** やにかわが魔法名を叫ぶ。続けて唱えたときは順番に（最大3つ）。新しく唱えたら前の声は止める */
export function saySpells(keys: string[]): void {
  if (!soundOn()) return;
  voicePlaying?.pause();
  voiceQueue = keys.filter((k) => HAS_SPELL_VOICE.has(k)).slice(0, 3);
  nextVoice();
}
