/**
 * 音声入力（ブラウザの Web Speech API）。ONにしている間ずっと聞き取り続ける方式。
 *
 * - 話して少し間が空くと、そこまでの言葉が「確定」して onFinal に渡される（= 1回の詠唱）
 * - ブラウザは無音が続くと勝手に認識を止めるので、ONの間は自動で再開する
 *
 * 注意: Chrome では音声が Google のサーバーに送られて文字に変換される。
 * Firefox は未対応。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API は TypeScript の標準型に含まれていないので、使う分だけ定義する
interface SpeechAlt {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlt;
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_JA: Record<string, string> = {
  'not-allowed': 'マイクの使用が許可されていない（ブラウザの設定を確認）',
  'service-not-allowed': 'このブラウザでは音声認識が使えない',
  'audio-capture': 'マイクが見つからない',
  network: '音声認識サービスに接続できない',
};
/** これが出たら自動再開しない（何度やっても失敗する種類） */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

export function useSpeech(onFinal: (text: string) => void) {
  const supported = getCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failStreak = useRef(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const begin = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current || !wantRef.current) return;
    const rec = new Ctor();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    let delivered = 0; // 何番目の結果まで詠唱に回したか
    rec.onresult = (e) => {
      failStreak.current = 0;
      let mid = '';
      for (let i = delivered; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal && i === delivered) {
          delivered++;
          const text = r[0].transcript.trim();
          if (text) onFinalRef.current(text);
        } else if (!r.isFinal) mid += r[0].transcript;
      }
      setInterim(mid);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return; // 無音は普通のこと
      setError(ERROR_JA[e.error] ?? `音声認識エラー: ${e.error}`);
      if (FATAL.has(e.error)) wantRef.current = false;
      else failStreak.current++;
    };
    rec.onend = () => {
      recRef.current = null;
      setInterim('');
      if (!wantRef.current) {
        setListening(false);
        return;
      }
      // ONのままなら再開。失敗が続くときは間隔をあける
      const wait = Math.min(5000, 150 * 2 ** failStreak.current);
      restartTimer.current = setTimeout(begin, wait);
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(`音声認識を開始できない: ${(err as Error).message}`);
      wantRef.current = false;
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    wantRef.current = true;
    failStreak.current = 0;
    setError(null);
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wantRef.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      recRef.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
