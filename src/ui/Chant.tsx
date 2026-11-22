/**
 * 声で唱えているときの演出。
 *
 * - ChantPanel（右の列のいちばん上）: 話している間、魔法陣に魔力がたまっていく。
 *   聞き取った途中の言葉も魔法陣の下に出る。
 * - CastBanner（戦場の上）: 言葉が確定したら、唱えた呪文を大きく出して「発動」。読めなかったら「不発」。
 */
import { useRef, type ReactNode } from 'react';

export interface ChantFx {
  id: number;
  text: string;
  ok: boolean;
  reason?: string;
}

/** 話し始めてから魔力が満タンになるまでの時間 (ms) */
const FULL_CHARGE_MS = 1600;

export function ChantPanel({
  supported,
  listening,
  interim,
  error,
  lastHeard,
  fx,
  onToggle,
  top,
  bottom,
}: {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  lastHeard: string | null;
  fx: ChantFx | null;
  onToggle: () => void;
  /** 枠の上と下に入れるもの（敵と自分のHP） */
  top?: ReactNode;
  bottom?: ReactNode;
}) {
  // 話し始めた時刻を覚えて、話している長さでたまり具合を決める（画面は毎フレーム描き直される）
  const startedAt = useRef<number | null>(null);
  if (interim && startedAt.current === null) startedAt.current = performance.now();
  if (!interim) startedAt.current = null;
  const charge = startedAt.current === null ? 0 : Math.min(1, (performance.now() - startedAt.current) / FULL_CHARGE_MS + interim.length * 0.03);

  const state = fx ? (fx.ok ? 'fire' : 'fizzle') : interim ? 'charging' : listening ? 'idle' : 'off';
  const R = 52;
  const circ = 2 * Math.PI * R;

  if (!supported) {
    return (
      <section className="chant chant-off">
        {top}
        <span className="muted chant-middle">このブラウザは音声入力に対応していない（Chrome / Edge / Safari で使える）</span>
        {bottom}
      </section>
    );
  }
  return (
    <section className={`chant chant-${state}`} style={{ '--charge': charge } as React.CSSProperties} aria-label="詠唱">
      {top}
      <div className="chant-middle">
      {/* 魔法陣そのものが音声の ON/OFF ボタン */}
      <button className="chant-circle" onClick={onToggle} title="押すと音声入力の ON / OFF。ONの間はずっと聞き取り、話して少し間が空くと詠唱される">
        <svg viewBox="0 0 140 140" aria-hidden>
          <circle className="cc-base" cx="70" cy="70" r={R} />
          <circle className="cc-fill" cx="70" cy="70" r={R} strokeDasharray={circ} strokeDashoffset={circ * (1 - (state === 'fire' ? 1 : charge))} />
          <g className="cc-rune">
            <circle cx="70" cy="70" r="40" />
            <polygon points="70,32 103,89 37,89" />
            <polygon points="70,108 37,51 103,51" />
          </g>
          <circle className="cc-core" cx="70" cy="70" r={6 + charge * 14} />
        </svg>
        <span className="chant-mic">{listening ? '🎙 ON' : '🎙 OFF'}</span>
        {state === 'fire' && <span className="chant-burst" />}
      </button>
      <div className="chant-info">
        <div className="chant-text">
          {state === 'charging' && <span className="chant-heard">「{interim}」</span>}
          {state === 'fire' && <span className="chant-ok">発動！</span>}
          {state === 'fizzle' && <span className="chant-ng">不発… {fx?.reason}</span>}
          {state === 'idle' && <span>聞き取り中… 唱えると魔力がたまり、少し間を空けると発動</span>}
          {state === 'off' && (error ? <span className="bad">{error}</span> : <span className="muted">魔法陣を押すと音声 ON。呪文は声で唱える（音声はブラウザの音声認識で文字にする。Chrome では Google のサーバーに送られる）</span>)}
        </div>
        {lastHeard && !interim && <div className="muted heard-last">聞き取った候補（【】が使ったもの）: {lastHeard}</div>}
      </div>
      </div>
      {bottom}
    </section>
  );
}

/** 戦場の真ん中に出る「唱えた呪文」 */
export function CastBanner({ fx }: { fx: ChantFx }) {
  return (
    <div className={`cast-banner ${fx.ok ? 'ok' : 'ng'}`} role="status">
      <div className="cast-banner-text">{fx.text}</div>
      <div className="cast-banner-sub">{fx.ok ? '― 発動 ―' : '不発'}</div>
    </div>
  );
}
