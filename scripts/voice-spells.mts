/**
 * 戦闘で魔法を唱えたときに、やにかわが魔法名を叫ぶ声を作る（VOICEVOX）。
 *   node --experimental-strip-types scripts/voice-spells.mts
 * public/voice/spell/<魔法のキー>.mp3 を作る。ふつうの魔法は「けだるげ」、究極魔法は「つよつよ」で叫ぶ。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ELEMENTS, SPELL_KEYS } from '../src/game/elements.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/voice/spell');
const URL_BASE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const FORCE = process.argv.includes('--force');
mkdirSync(OUT, { recursive: true });

/** 魔法のほかに声をつけるコマンド */
const COMMANDS: Record<string, string> = { guard: 'ガード', heal: 'ヒール' };
const items: { key: string; text: string; ult: boolean }[] = [
  ...SPELL_KEYS.map((k) => ({ key: k, text: ELEMENTS[k].name.replace(/・/g, ''), ult: !!ELEMENTS[k].ultimate })),
  ...Object.entries(COMMANDS).map(([key, text]) => ({ key, text, ult: false })),
];

for (const it of items) {
  const mp3 = join(OUT, `${it.key}.mp3`);
  if (existsSync(mp3) && !FORCE) continue;
  const speaker = it.ult ? 114 : 116; // あんこもん つよつよ / けだるげ
  const q = await (await fetch(`${URL_BASE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(`${it.text}！`)}`, { method: 'POST' })).json();
  q.speedScale = it.ult ? 1.0 : 1.15;
  q.intonationScale = it.ult ? 1.4 : 1.2;
  q.volumeScale = 1.2;
  q.prePhonemeLength = 0.02;
  q.postPhonemeLength = 0.1;
  const r = await fetch(`${URL_BASE}/synthesis?speaker=${speaker}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  const wav = join(OUT, `${it.key}.wav`);
  writeFileSync(wav, Buffer.from(await r.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3]);
  unlinkSync(wav);
  console.log(`作った: ${it.key}「${it.text}」`);
}
writeFileSync(join(ROOT, 'src/ui/spellVoices.json'), JSON.stringify(items.map((i) => i.key).sort()) + '\n');
console.log(`完了: ${items.length} 本`);
