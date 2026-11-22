import { VOICE_CAST } from './voiceKey';

/** 声の出どころの表示（VOICEVOX の規約で、使ったキャラの名前を出す必要がある） */
export const VOICE_CREDIT = `音声: ${[...new Set(Object.values(VOICE_CAST).map((c) => `VOICEVOX:${c.name.replace(/（.*）/, '')}`))].join(' / ')}`;
