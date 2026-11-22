import { useEffect, useRef, useState } from 'react';
import { SKILLS, SKILL_BY_ID, TOTAL_SP, TREE_SIZE, canUnlock, spForWin, specialRemaining, stageStats, type SkillDef } from '../game/skills';
import { ELEMENTS, type SpellKey } from '../game/elements';
import type { Progress } from '../game/progress';

const KIND_JA = { spell: '魔法', command: 'コマンド', passive: '強化', support: '補助魔法' } as const;
const CELL = 68; // ノードの間隔(px)
const N = TREE_SIZE;

/** スキルツリー画面（全画面のオーバーレイ） */
export function SkillTree({
  progress,
  onUnlock,
  onClose,
  onReset,
  inBattle,
}: {
  progress: Progress;
  onUnlock: (id: string) => string | null;
  onClose: () => void;
  onReset: () => void;
  inBattle: boolean;
}) {
  const unlocked = new Set(progress.unlocked);
  const [selected, setSelected] = useState<string>('water');
  const [msg, setMsg] = useState<string | null>(null);
  const sel = SKILL_BY_ID.get(selected)!;
  const chk = canUnlock(selected, unlocked, progress.sp);
  const spent = SKILLS.filter((s) => unlocked.has(s.id)).reduce((n, s) => n + s.cost, 0);
  const next = stageStats(progress.stage);

  const reachable = (s: SkillDef) => (s.requiresAll ? s.requires.every((r) => unlocked.has(r)) : s.requires.some((r) => unlocked.has(r)));
  const state = (s: SkillDef) => (unlocked.has(s.id) ? 'got' : canUnlock(s.id, unlocked, progress.sp).ok ? 'can' : reachable(s) ? 'near' : 'far');
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 開いたときは中心（ウォーター）が見えるようにする
    const el = mapRef.current;
    if (el) el.scrollTo({ left: (N * CELL - el.clientWidth) / 2, top: (N * CELL - el.clientHeight) / 2 });
  }, []);
  const spell = sel.kind === 'spell' && sel.id in ELEMENTS ? ELEMENTS[sel.id as SpellKey] : null;
  const c = (p: { x: number; y: number }) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });

  return (
    <div className="tree-overlay" role="dialog" aria-label="スキルツリー">
      <div className="tree-box">
        <header className="tree-h">
          <span className="tree-title">スキルツリー</span>
          <span className="tree-sp">SP <b>{progress.sp}</b></span>
          <span className="muted">
            ステージ{progress.stage}{next.elite ? '・強敵' : ''}（敵HP {next.enemyHp}）／ {progress.wins}勝 {progress.losses}敗 ／ 習得 {spent}/{TOTAL_SP} SP
          </span>
          <button className="tree-close" onClick={onClose}>{inBattle ? '閉じて戦闘に戻る' : '閉じる'}</button>
        </header>
        <div className="tree-main">
          <div className="tree-scroll" ref={mapRef}>
          <div className="tree-map" style={{ width: CELL * N, height: CELL * N }}>
            <svg width={CELL * N} height={CELL * N} className="tree-lines" aria-hidden>
              {SKILLS.filter((s) => !s.special).flatMap((s) =>
                s.requires.map((r) => {
                  const a = c(s.pos);
                  const b = c(SKILL_BY_ID.get(r)!.pos);
                  const lit = unlocked.has(s.id) && unlocked.has(r);
                  return <line key={`${s.id}-${r}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${lit ? 'lit' : unlocked.has(r) ? 'open' : ''} ${s.requiresAll ? 'both' : ''}`} />;
                }),
              )}
            </svg>
            {SKILLS.filter((s) => !s.special).map((s) => (
              <button
                key={s.id}
                className={`node n-${state(s)} br-${s.branch} k-${s.kind} ${selected === s.id ? 'sel' : ''} ${s.kind === 'spell' && (ELEMENTS as Record<string, { ultimate?: boolean }>)[s.id]?.ultimate ? 'ult' : ''}`}
                style={{ left: s.pos.x * CELL + 5, top: s.pos.y * CELL + 5, width: CELL - 10, height: CELL - 10 }}
                onClick={() => { setSelected(s.id); setMsg(null); }}
                title={s.desc}
              >
                <span className="node-name">{s.name}</span>
                {!unlocked.has(s.id) && <span className="node-cost">{s.cost}SP</span>}
              </button>
            ))}
          </div>
          </div>
          <aside className="tree-detail">
            <div className={`td-kind br-${sel.branch}`}>{KIND_JA[sel.kind]}</div>
            <div className="td-name">{sel.special && !unlocked.has(sel.id) && !chk.ok ? '？？？' : sel.name}</div>
            {sel.incantation && <div className="td-inc">唱え方: <code>{sel.incantation}</code></div>}
            <p className="td-desc">{sel.desc}</p>
            {spell && (
              <div className="td-spell">
                <div>形: {spell.shapeLabel} ／ 威力 {spell.damage} ／ 魔力 約{Math.round(spell.cost + 12)}</div>
                <div className="muted">{spell.summary}</div>
                <div className="muted">{spell.combo}</div>
              </div>
            )}
            {sel.special && <div className="muted">前提: {sel.needCount ? `スキルを${sel.needCount}個覚える` : 'ほかのスキルをすべて解放'}</div>}
            {sel.requires.length > 0 && <div className="muted">前提: {sel.requires.map((r) => SKILL_BY_ID.get(r)!.name).join(sel.requiresAll ? ' ＋ ' : ' / ')}{sel.requiresAll ? '（両方）' : ''}</div>}
            {unlocked.has(sel.id) ? (
              <div className="good">✔ 習得済み</div>
            ) : (
              <button
                className="td-unlock"
                disabled={!chk.ok}
                onClick={() => setMsg(onUnlock(sel.id) ?? `「${sel.name}」を覚えた！`)}
              >
                {sel.cost} SP で解放
              </button>
            )}
            {!chk.ok && !unlocked.has(sel.id) && <div className="warn">{chk.reason}</div>}
            {msg && <div className="note">{msg}</div>}
            <div className="td-legend">
              <div><span className="lg got" /> 習得済み</div>
              <div><span className="lg can" /> 今すぐ解放できる</div>
              <div><span className="lg near" /> SPが足りない</div>
              <div><span className="lg far" /> 前のスキルが必要</div>
            </div>
            <div className="muted td-rule">勝利で +{spForWin(progress.stage)} SP（ステージが進むほど増える）、敗北でも +1 SP。移動はいつでも使える。スクロールでツリー全体を見られる。</div>
            <button className="btn-mini td-reset" onClick={() => { if (confirm('進み具合（SP・スキル・ステージ）を最初に戻す？')) onReset(); }}>
              最初からやり直す
            </button>
          </aside>
        </div>
        <footer className="special-dock">
          {SKILLS.filter((s) => s.special).map((s) => {
            const rest = specialRemaining(s, unlocked);
            return (
              <button key={s.id} className={`special-slot n-${state(s)} ${selected === s.id ? 'sel' : ''}`} onClick={() => { setSelected(s.id); setMsg(null); }}>
                <span className="special-h">✦ 特別枠</span>
                <span className="special-name">{unlocked.has(s.id) || rest === 0 ? s.name : '？？？'}</span>
                <span className="muted">{unlocked.has(s.id) ? '習得済み' : rest === 0 ? `${s.cost} SP` : `あと${rest}個`}</span>
              </button>
            );
          })}
        </footer>
      </div>
    </div>
  );
}
