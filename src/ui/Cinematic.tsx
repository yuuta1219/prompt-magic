/**
 * 大魔法の全画面演出。魔法ごとに「使う部品」「タイトルの出方」「揺れ」「余韻」がぜんぶ違う。
 *
 * - 詠唱中（ChargeOverlay）: 上下に警告テープ、画面がだんだん暗くなり、呪文名が1文字ずつ浮かぶ
 * - 着弾（ImpactOverlay）: 魔法ごとの全画面演出
 * - 余韻（AfterOverlay）: 演出のあとも、しばらく画面に魔法の名残が残る（フィアト・ノクスは真っ暗なまま）
 *
 * 時間は実時間（CSS アニメーション）。勝利で戦闘が止まっても最後まで流れる。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleState } from '../game/BattleState';
import type { SpellEntry } from '../game/types';
import { ELEMENTS, type SpellKey } from '../game/elements';

type Layer = 'stars' | 'wave' | 'bubbles' | 'flames' | 'embers' | 'bolts' | 'frost' | 'cracks' | 'snow' | 'slashes' | 'dust' | 'heaven' | 'ash' | 'clock' | 'glitch' | 'gears' | 'motes';

interface Theme {
  title: string;
  sub: string;
  cls: string;
  layers: Layer[];
  shake: 'none' | 'light' | 'sharp' | 'heavy';
  /** 着弾演出の長さ・余韻の長さ (ms) */
  impactMs: number;
  afterMs: number;
}

export const CINEMATIC_THEMES: Record<string, Theme> = {
  fiat_nox: { title: 'Fiat nox.', sub: '― 闇あれ ―', cls: 'cin-nox', layers: ['stars'], shake: 'none', impactMs: 4600, afterMs: 7000 },
  deep_requiem: { title: 'DEEP BLUE REQUIEM', sub: '深海の鎮魂歌', cls: 'cin-water', layers: ['wave', 'bubbles'], shake: 'none', impactMs: 3000, afterMs: 4500 },
  catastrophe: { title: 'HELLFIRE CATASTROPHE', sub: '獄炎の大災厄', cls: 'cin-fire', layers: ['flames', 'embers'], shake: 'heavy', impactMs: 2800, afterMs: 4500 },
  thor: { title: 'THOR JUDGMENT', sub: '雷神の裁き', cls: 'cin-thunder', layers: ['bolts'], shake: 'sharp', impactMs: 2600, afterMs: 3500 },
  absolute_zero: { title: 'ABSOLUTE ZERO', sub: '絶対零度', cls: 'cin-ice', layers: ['frost', 'cracks', 'snow'], shake: 'none', impactMs: 3200, afterMs: 5500 },
  tempest: { title: 'TEMPEST OF ZEPHYR', sub: '西風の大嵐', cls: 'cin-wind', layers: ['slashes'], shake: 'none', impactMs: 2500, afterMs: 3500 },
  terra_end: { title: 'END OF THE EARTH', sub: '大地の終焉', cls: 'cin-earth', layers: ['cracks', 'dust'], shake: 'heavy', impactMs: 3000, afterMs: 4500 },
  sanctuary: { title: 'SACRED SANCTUARY', sub: '聖域の顕現', cls: 'cin-holy', layers: ['heaven', 'motes'], shake: 'none', impactMs: 3200, afterMs: 4500 },
  apocalypse: { title: 'APOCALYPSE', sub: '黙示録', cls: 'cin-apoc', layers: ['ash'], shake: 'heavy', impactMs: 3000, afterMs: 5000 },
  memento_mori: { title: 'Memento mori', sub: '死を想え', cls: 'cin-mori', layers: ['clock'], shake: 'none', impactMs: 3200, afterMs: 5000 },
  chaos: { title: 'CHAOS DISASTER', sub: '光と闇の混沌', cls: 'cin-chaos', layers: ['glitch'], shake: 'light', impactMs: 2800, afterMs: 3500 },
  deus_ex_machina: { title: 'DEUS EX MACHINA', sub: '機械仕掛けの神', cls: 'cin-deus', layers: ['gears', 'motes'], shake: 'none', impactMs: 3000, afterMs: 4000 },
  veni_vidi_vici: { title: 'VENI VIDI VICI', sub: '来た、見た、勝った', cls: 'cin-veni', layers: ['motes'], shake: 'none', impactMs: 2600, afterMs: 3000 },
};

/** 詠唱中の呪文に大魔法が入っていれば、その魔法の key */
export function chargingUltimate(entry: SpellEntry | undefined): string | null {
  if (!entry?.spell) return null;
  for (const a of entry.spell.actions) if (a.type === 'ATTACK' && a.element in CINEMATIC_THEMES) return a.element;
  return null;
}

export interface ImpactState {
  key: string;
  id: number;
  phase: 'impact' | 'after';
}

/** 新しく発生した演出を拾い、着弾 → 余韻 → 終わり、を実時間で進める */
export function useImpact(s: BattleState): ImpactState | null {
  const [active, setActive] = useState<ImpactState | null>(null);
  const seen = useRef<number>(0);
  const battle = useRef<number>(s.battleId);
  const last = s.cinematics[s.cinematics.length - 1];
  useEffect(() => {
    if (battle.current !== s.battleId) {
      battle.current = s.battleId;
      seen.current = 0;
    }
    if (!last || last.id <= seen.current || !(last.key in CINEMATIC_THEMES)) return;
    seen.current = last.id;
    const th = CINEMATIC_THEMES[last.key];
    setActive({ ...last, phase: 'impact' });
    const t1 = setTimeout(() => setActive((x) => (x?.id === last.id ? { ...x, phase: 'after' } : x)), th.impactMs);
    const t2 = setTimeout(() => setActive((x) => (x?.id === last.id ? null : x)), th.impactMs + th.afterMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [last?.id, s.battleId]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

export function shakeClass(impact: ImpactState | null): string {
  if (!impact || impact.phase !== 'impact') return '';
  const sh = CINEMATIC_THEMES[impact.key].shake;
  return sh === 'none' ? '' : `cin-shake-${sh}`;
}

function useScatter(n: number, seed: number) {
  return useMemo(() => {
    let x = (seed * 9301 + 49297) % 233280;
    const r = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: n }, () => ({ l: r() * 100, t: r() * 100, d: r(), s: 0.4 + r() * 1.4 }));
  }, [n, seed]);
}

function Scatter({ cls, n, seed }: { cls: string; n: number; seed: number }) {
  const items = useScatter(n, seed);
  return (
    <div className={`cin-scatter ${cls}`} aria-hidden>
      {items.map((p, i) => (
        <span key={i} style={{ left: `${p.l}%`, top: `${p.t}%`, animationDelay: `${(p.d * 1.2).toFixed(2)}s`, '--s': p.s } as React.CSSProperties} />
      ))}
    </div>
  );
}

function Lines({ cls, n }: { cls: string; n: number }) {
  return (
    <div className={`cin-lines ${cls}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

function LayerView({ layer, seed }: { layer: Layer; seed: number }) {
  switch (layer) {
    case 'stars': return <Scatter cls="l-stars" n={70} seed={seed} />;
    case 'bubbles': return <Scatter cls="l-bubbles" n={36} seed={seed} />;
    case 'embers': return <Scatter cls="l-embers" n={50} seed={seed} />;
    case 'snow': return <Scatter cls="l-snow" n={60} seed={seed} />;
    case 'dust': return <Scatter cls="l-dust" n={40} seed={seed} />;
    case 'ash': return <Scatter cls="l-ash" n={60} seed={seed} />;
    case 'motes': return <Scatter cls="l-motes" n={40} seed={seed} />;
    case 'bolts': return <Lines cls="l-bolts" n={5} />;
    case 'cracks': return <Lines cls="l-cracks" n={6} />;
    case 'slashes': return <Lines cls="l-slashes" n={3} />;
    case 'gears': return <Lines cls="l-gears" n={3} />;
    default: return <div className={`cin-layer l-${layer}`} aria-hidden />;
  }
}

function Title({ th }: { th: Theme }) {
  if (th.cls === 'cin-veni') {
    return (
      <div className="cin-title t-veni">
        {th.title.split(' ').map((w, i) => (
          <span key={w} style={{ animationDelay: `${0.25 + i * 0.45}s` }}>{w}</span>
        ))}
      </div>
    );
  }
  if (th.cls === 'cin-ice') {
    return (
      <div className="cin-title t-ice">
        {[...th.title].map((c, i) => (
          <span key={i} style={{ animationDelay: `${0.5 + i * 0.06}s` }}>{c === ' ' ? ' ' : c}</span>
        ))}
      </div>
    );
  }
  return <div className="cin-title" data-text={th.title}>{th.title}</div>;
}

export function ImpactOverlay({ impact }: { impact: ImpactState }) {
  const th = CINEMATIC_THEMES[impact.key];
  return (
    <div key={impact.id} className={`cin-impact ${th.cls}`} style={{ '--dur': `${th.impactMs}ms` } as React.CSSProperties} role="presentation">
      <div className="cin-bg" />
      {th.layers.map((l) => (
        <LayerView key={l} layer={l} seed={impact.id} />
      ))}
      <div className="cin-text">
        <Title th={th} />
        <div className="cin-sub">{th.sub}</div>
        <div className="cin-name">{ELEMENTS[impact.key as SpellKey]?.name}</div>
      </div>
    </div>
  );
}

/** 演出のあとの余韻（ゲーム画面の上に薄く残る。勝敗の表示よりは下） */
export function AfterOverlay({ impact }: { impact: ImpactState }) {
  const th = CINEMATIC_THEMES[impact.key];
  return (
    <div key={impact.id} className={`cin-after ${th.cls}`} style={{ '--dur': `${th.afterMs}ms` } as React.CSSProperties} role="presentation">
      <div className="cin-after-tint" />
      {th.layers.includes('embers') && <Scatter cls="l-embers slow" n={24} seed={impact.id + 1} />}
      {th.layers.includes('ash') && <Scatter cls="l-ash slow" n={30} seed={impact.id + 1} />}
      {th.layers.includes('snow') && <Scatter cls="l-snow slow" n={30} seed={impact.id + 1} />}
      {th.layers.includes('motes') && <Scatter cls="l-motes slow" n={20} seed={impact.id + 1} />}
      {th.layers.includes('dust') && <Scatter cls="l-dust slow" n={20} seed={impact.id + 1} />}
      {th.layers.includes('stars') && <Scatter cls="l-stars slow" n={14} seed={impact.id + 1} />}
    </div>
  );
}

export function ChargeOverlay({ keyName, progress }: { keyName: string; progress: number }) {
  const th = CINEMATIC_THEMES[keyName];
  const name = ELEMENTS[keyName as SpellKey]?.name ?? '';
  const shown = Math.max(1, Math.ceil(name.length * Math.min(1, progress * 1.15)));
  const tape = '⚠ 究極魔法 詠唱中 ⚠ ULTIMATE ⚠ '.repeat(8);
  return (
    <div className={`cin-charge ${th.cls}`} style={{ '--cp': progress } as React.CSSProperties} role="presentation">
      <div className="cin-charge-dim" />
      <div className="cin-charge-edge" />
      <div className="cin-tape top"><span>{tape}</span></div>
      <div className="cin-tape bottom"><span>{tape}</span></div>
      <div className="cin-chant">{name.slice(0, shown)}<span className="cin-caret">▍</span></div>
    </div>
  );
}
