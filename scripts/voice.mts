/**
 * 台本のセリフを VOICEVOX で音声にする。
 *   1. VOICEVOX エンジンを起動しておく（http://127.0.0.1:50021）
 *   2. node --experimental-strip-types scripts/voice.mts
 * public/voice/<キー>.mp3 を作り、src/story/voices.json に一覧を書く。すでにあるセリフは作り直さない。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseScript } from '../src/story/script.ts';
import { VOICE_CAST, speakable, voiceKey } from '../src/story/voiceKey.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/voice');
const URL_BASE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const SCRIPTS = ['src/story/ep1.txt'];

mkdirSync(OUT, { recursive: true });
const want = new Map<string, { who: string; text: string }>();
for (const f of SCRIPTS) {
  const sc = parseScript(readFileSync(join(ROOT, f), 'utf8'));
  const pages = [...sc.prologue, ...sc.chapters.flatMap((c) => [...c.before, ...c.after])];
  for (const p of pages)
    for (const l of p.lines) {
      // 話タイトル（【中央】）はナレーションが読む。効果音・遊び方は声なし
      const who = l.who === undefined ? 'ナレーション' : l.who;
      if (!VOICE_CAST[who]) continue;
      want.set(voiceKey(who, l.text), { who, text: l.text });
    }
}

let made = 0;
for (const [key, { who, text }] of want) {
  const mp3 = join(OUT, `${key}.mp3`);
  if (existsSync(mp3)) continue;
  const c = VOICE_CAST[who];
  const q = await fetch(`${URL_BASE}/audio_query?speaker=${c.speaker}&text=${encodeURIComponent(speakable(text))}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query に失敗: ${who}「${text}」 ${q.status}`);
  const query = await q.json();
  query.speedScale = c.speed ?? 1;
  query.pitchScale = c.pitch ?? 0;
  query.intonationScale = c.intonation ?? 1;
  query.prePhonemeLength = 0.05;
  query.postPhonemeLength = 0.15;
  const r = await fetch(`${URL_BASE}/synthesis?speaker=${c.speaker}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
  if (!r.ok) throw new Error(`synthesis に失敗: ${who}「${text}」 ${r.status}`);
  const wav = join(OUT, `${key}.wav`);
  writeFileSync(wav, Buffer.from(await r.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3]);
  unlinkSync(wav);
  made++;
  console.log(`作った: ${who}「${text}」`);
}

// 台本から消えたセリフの音声は消す
for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !want.has(f.replace('.mp3', ''))) unlinkSync(join(OUT, f));
writeFileSync(join(ROOT, 'src/story/voices.json'), JSON.stringify([...want.keys()].sort(), null, 0) + '\n');
console.log(`完了: 新しく ${made} 本 / 全部で ${want.size} 本`);
