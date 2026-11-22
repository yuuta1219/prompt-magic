/**
 * 声で唱えているときの演出。
 *
 * - ChantPanel（右の列のいちばん上）: 話している間、魔法陣に魔力がたまっていく。
 *   聞き取った途中の言葉も魔法陣の下に出る。
 * - CastBanner（戦場の上）: 言葉が確定したら、唱えた呪文を大きく出して「発動」。読めなかったら「不発」。
 */
import { useRef } from 'react';

export interface ChantFx {
  id: number;
  text: string;
  ok: boolean;
  reason?: string;
}

/** 話し始めてから魔力が満タンになるまでの時間 (ms) */
const FULL_CHARGE_MS = 1600;

export function ChantPanel({
  listening,
  interim,
  fx,
  mana,
  manaMax,
}: {
  listening: boolean;
  interim: string;
  fx: ChantFx | null;
  mana: number;
  manaMax: number;
}) {
  // 話し始めた時刻を覚えて、話している長さでたまり具合を決める（画面は毎フレーム描き直される）
  const startedAt = useRef<number | null>(null);
  if (interim && startedAt.current === null) startedAt.current = performance.now();
  if (!interim) startedAt.current = null;
  const charge = startedAt.current === null ? 0 : Math.min(1, (performance.now() - startedAt.current) / FULL_CHARGE_MS + interim.length * 0.03);

  const state = fx ? (fx.ok ? 'fire' : 'fizzle') : interim ? 'charging' : listening ? 'idle' : 'off';
  const R = 52;
  const circ = 2 * Math.PI * R;

  return (
    <section className={`chant chant-${state}`} style={{ '--charge': charge } as React.CSSProperties} aria-label="詠唱">
      <div className="chant-circle" aria-hidden>
        <svg viewBox="0 0 140 140">
          <circle className="cc-base" cx="70" cy="70" r={R} />
          <circle className="cc-fill" cx="70" cy="70" r={R} strokeDasharray={circ} strokeDashoffset={circ * (1 - (state === 'fire' ? 1 : charge))} />
          <g className="cc-rune">
            <circle cx="70" cy="70" r="40" />
            <polygon points="70,32 103,89 37,89" />
            <polygon points="70,108 37,51 103,51" />
          </g>
          <circle className="cc-core" cx="70" cy="70" r={6 + charge * 14} />
        </svg>
        {state === 'fire' && <div className="chant-burst" />}
      </div>
      <div className="chant-text">
        {state === 'charging' && <span className="chant-heard">「{interim}」</span>}
        {state === 'fire' && <span className="chant-ok">発動！</span>}
        {state === 'fizzle' && <span className="chant-ng">不発… {fx?.reason}</span>}
        {state === 'idle' && <span className="muted">唱えると魔力がたまる</span>}
        {state === 'off' && <span className="muted">🎙 を ON にすると唱えられる</span>}
      </div>
      <div className="chant-mana">
        <div className="chant-mana-fill" style={{ width: `${Math.max(0, Math.min(1, mana / manaMax)) * 100}%` }} />
        <span>魔力 {Math.floor(mana)}/{manaMax}</span>
      </div>
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
