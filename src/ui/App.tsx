import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { interpretSpell } from '../interpreter/SpellInterpreter';
import { TICK_MS, SPELL_LIMITS } from '../game/constants';
import { Board } from './Board';
import { ElementGuide } from './ElementGuide';
import { SkillTree } from './SkillTree';
import { AfterOverlay, ChargeOverlay, ImpactOverlay, chargingUltimate, shakeClass, useImpact } from './Cinematic';
import { applyDevGrant, applyResult, loadProgress, newProgress, saveProgress, unlockSkill, type Progress } from '../game/progress';
import { computeLoadout, spForWin, STAGE } from '../game/skills';
import { useSpeech } from './useSpeech';
import { CastBanner, ChantPanel, type ChantFx } from './Chant';
import { CostPanel, HarnessPanel, InterpretationPanel, LogPanel, QueuePanel, Section } from './Panels';


const HISTORY_KEY = 'prompt-magic.history';

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
}
function saveHistory(h: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)));
  } catch {
    /* 保存できなくても遊べる */
  }
}

export function App() {
  const [progress, setProgressState] = useState<Progress>(() => applyDevGrant(loadProgress()));
  const progressRef = useRef(progress);
  const setProgress = (p: Progress) => {
    progressRef.current = p;
    setProgressState(p);
    saveProgress(p);
  };
  const loadout = useMemo(() => computeLoadout(progress.unlocked), [progress.unlocked]);
  const engine = useMemo(() => new GameEngine(undefined, { loadout: computeLoadout(progress.unlocked), stage: progress.stage }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [treeOpen, setTreeOpen] = useState(false);
  const treeOpenRef = useRef(treeOpen);
  treeOpenRef.current = treeOpen;
  /** 報酬を渡し済みの戦闘（同じ戦闘で二重に SP を渡さない） */
  const rewardedBattle = useRef<number | null>(null);
  const [lastReward, setLastReward] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  /** 左右の情報パネルはボタンで開く引き出しにする（戦闘画面を大きく見せるため） */
  const [drawer, setDrawer] = useState<'guide' | null>(null);
  /** 唱えた結果の演出（発動 / 不発） */
  const [chantFx, setChantFx] = useState<ChantFx | null>(null);
  const chantId = useRef(0);
  const drawerRef = useRef(drawer);
  drawerRef.current = drawer;
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  speedRef.current = speed;
  pausedRef.current = paused;

  // ---- 固定タイムステップのゲームループ（描画とシミュレーションを分離）
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(250, t - last); // タブ非表示から戻ったときに一気に進めない
      last = t;
      if (!pausedRef.current && !treeOpenRef.current) {
        acc += dt * speedRef.current;
        while (acc >= TICK_MS) {
          engine.step();
          acc -= TICK_MS;
        }
      }
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2500);
  };

  const castText = (raw: string) => {
    const t = raw.trim().slice(0, SPELL_LIMITS.MAX_INPUT_CHARS);
    if (!t) return;
    const r = engine.cast(t);
    const id = ++chantId.current;
    const recognized = interpretSpell(t).actions.some((a) => a.type !== 'NOOP');
    setChantFx(r.ok && recognized ? { id, text: t, ok: true } : { id, text: t, ok: false, reason: r.ok ? '呪文として読めなかった' : r.error });
    setTimeout(() => setChantFx((x) => (x?.id === id ? null : x)), 1900);
    if (!r.ok) {
      flash(r.error);
      return;
    }
    setHistory((h) => {
      const next = [t, ...h.filter((x) => x !== t)].slice(0, 30);
      saveHistory(next);
      return next;
    });
  };
  // 開発中だけ: コンソールから window.__cast('ファイア') で唱えたことにできる（音声なしで演出を確かめる用）
  if (import.meta.env.DEV) (window as unknown as { __cast?: (t: string) => void }).__cast = castText;
  // ---- 呪文は音声だけで唱える（文字の入力欄は無い）。ONの間ずっと聞き取る
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const speech = useSpeech((heard, alternatives) => {
    // 認識の候補の中から、呪文として読めるもの（不発にならないもの）を選ぶ
    const best = alternatives.find((t) => interpretSpell(t).actions.some((a) => a.type !== 'NOOP')) ?? heard;
    // 原因を調べられるように、音声認識が出した候補をすべて表示する
    setLastHeard(alternatives.map((t) => (t === best ? `【${t}】` : t)).join(' ／ '));
    engine.s.log('ai', `聞き取り候補: ${alternatives.map((t) => `「${t}」`).join(' ')}`);
    castText(best);
  });

  const restart = () => {
    const p = progressRef.current;
    engine.configure({ loadout: computeLoadout(p.unlocked), stage: p.stage });
    engine.reset();
    setLastReward(null);
  };

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 引き出しが開いていたら、まず閉じる
      if (drawerRef.current) setDrawer(null);
      else setPaused((p) => !p);
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const s = engine.s;
  const impact = useImpact(s);
  // 戦闘が終わったら一度だけ SP を渡す
  useEffect(() => {
    if (s.phase === 'battle' || rewardedBattle.current === s.battleId) return;
    rewardedBattle.current = s.battleId;
    const win = s.phase === 'victory';
    setProgress(applyResult(progressRef.current, win));
    setLastReward(win ? `+${spForWin(s.stage)} SP 獲得！ 次はステージ${s.stage + 1}` : `+${STAGE.SP_LOSE} SP 獲得（負けても少しだけ成長する）`);
  });
  const lastEntry = [...s.spells].reverse().find((e) => e.status !== 'interpreting') ?? s.spells[s.spells.length - 1];
  const enemyCast = s.attacks.filter((a) => a.owner === 'enemy').sort((a, b) => a.resolveAt - b.resolveAt)[0];
  const casting = engine.casting;
  const chargeKey = chargingUltimate(casting);

  return (
    <div className={`app ${shakeClass(impact)}`}>
      {impact?.phase === 'impact' && <ImpactOverlay impact={impact} />}
      {impact?.phase === 'after' && <AfterOverlay impact={impact} />}
      {impact?.phase !== 'impact' && chargeKey && casting?.castStartAt !== undefined && casting.castEndAt !== undefined && (
        <ChargeOverlay keyName={chargeKey} progress={Math.min(1, (s.time - casting.castStartAt) / Math.max(1, casting.castEndAt - casting.castStartAt))} />
      )}
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(null)} />}
      <div className={`drawer drawer-left ${drawer === 'guide' ? 'open' : ''}`} aria-hidden={drawer !== 'guide'}>
        <button className="drawer-close" onClick={() => setDrawer(null)}>✕ 閉じる</button>
        <ElementGuide loadout={loadout} />
      </div>
      {treeOpen && (
        <SkillTree
          progress={progress}
          inBattle={s.phase === 'battle'}
          onClose={() => setTreeOpen(false)}
          onUnlock={(id) => {
            const r = unlockSkill(progressRef.current, id);
            if (typeof r === 'string') return r;
            setProgress(r);
            engine.applyLoadoutNow(computeLoadout(r.unlocked));
            return null;
          }}
          onReset={() => {
            const p = newProgress();
            setProgress(p);
            engine.configure({ loadout: computeLoadout(p.unlocked), stage: p.stage });
            engine.reset();
            setLastReward(null);
          }}
        />
      )}
      <main className="arena">
        <header className="title-bar">
          <h1>PROMPT MAGIC</h1>
          <span className="subtitle">— 詠唱とは、世界への命令である —</span>
          <div className="controls">
            <label>
              速度
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
              </select>
            </label>
            <button className={drawer === 'guide' ? 'on' : ''} onClick={() => setDrawer((d) => (d === 'guide' ? null : 'guide'))}>📖 呪文の書</button>
            <button onClick={() => setPaused((p) => !p)}>{paused ? '▶ 再開' : '⏸ 一時停止'}</button>
            <button onClick={restart}>↻ 再戦</button>
            <button className={`tree-btn ${progress.sp > 0 ? 'has-sp' : ''}`} onClick={() => setTreeOpen(true)}>🌳 スキル（SP {progress.sp}）</button>
          </div>
        </header>

        {/* 敵HUD */}
        <div className="hud hud-enemy">
          <div className="hud-name">✶ 古代術式体 <span className="muted">ステージ{s.stage}</span>{s.elite && <span className="elite-tag">★ 強敵</span>}</div>
          <Bar value={s.enemy.hp} max={s.enemy.maxHp} kind="hp-enemy" label={`HP ${s.enemy.hp}/${s.enemy.maxHp}`} />
          <Bar value={s.enemyMana.current} max={s.enemyMana.max} kind="mana thin-mana" label={`魔力 ${Math.floor(s.enemyMana.current)}/${s.enemyMana.max}`} />
          <div className="enemy-cast">
            {enemyCast ? (
              <span className="casting-warn">⚠ 詠唱中「{enemyCast.label}」 着弾まで {Math.max(0, (enemyCast.resolveAt - s.time) / 1000).toFixed(1)}s</span>
            ) : (
              <span className="muted">
                {s.isFrozen('enemy') ? `❄ 凍結中 あと${((s.enemy.frozenUntil - s.time) / 1000).toFixed(1)}秒` : s.enemy.shield ? '🛡 防御結界' : '次の行動を思考中…'}
                {engine.enemyAI.enraged ? ' ／ 暴走状態' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="fields">
          {/* 3D の床。プレイヤーの後ろ上から見下ろす（奥が敵、手前が自分） */}
          <div className="stage3d">
            <Board s={s} side="enemy" />
            <div className="rift">
              <span>— 境界 —</span>
            </div>
            <Board s={s} side="player" />
          </div>
          {chantFx && <CastBanner key={chantFx.id} fx={chantFx} />}
          {paused && <div className="overlay"><div className="overlay-box">一時停止中<br /><small>Esc で再開</small></div></div>}
          {s.phase !== 'battle' && impact?.phase !== 'impact' && (
            <div className="overlay">
              <div className={`overlay-box ${s.phase}`}>
                <div className="result">{s.phase === 'victory' ? 'VICTORY' : 'DEFEAT'}</div>
                <div className="muted">戦闘時間 {(s.time / 1000).toFixed(1)}秒</div>
                {lastReward && <div className="reward">{lastReward}</div>}
                <div className="overlay-actions">
                  <button onClick={() => setTreeOpen(true)}>🌳 スキルツリー（SP {progress.sp}）</button>
                  <button onClick={restart}>{s.phase === 'victory' ? `次の戦闘へ（ステージ${progress.stage}）` : 'もう一度戦う'}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* プレイヤーHUD */}
        <div className="hud hud-player">
          <div className="hud-row">
            <div className="hud-name">◆ 詠唱者 <span className="muted">YOU</span></div>
            <div className="status-icons">
              {s.player.shield && <span className="chip shield">🛡 障壁 {Math.round(s.player.shield.reduction * 100)}% {((s.player.shield.until - s.time) / 1000).toFixed(1)}s</span>}
              {s.reactiveWard && <span className="chip ward">✧ 反応障壁 待機</span>}
              {s.attackBuff > 1 && <span className="chip ward">⚔ 攻撃力×{s.attackBuff}</span>}
              {s.harnesses.map((h) => <span key={h.id} className="chip harness-chip">⚙ {h.spec.name}</span>)}
            </div>
          </div>
          <Bar value={s.player.hp} max={s.player.maxHp} kind="hp-player" label={`HP ${s.player.hp}/${s.player.maxHp}`} />
          <Bar value={s.mana.current} max={s.mana.max} kind="mana" label={`魔力 ${Math.floor(s.mana.current)}/${s.mana.max}（+${s.mana.regenPerSec}/秒）`} />
          {/* 詠唱バーは常に場所を取っておく（出たり消えたりで画面がずれないように） */}
          {casting && casting.castStartAt !== undefined && casting.castEndAt !== undefined ? (
            <Bar value={s.time - casting.castStartAt} max={Math.max(1, casting.castEndAt - casting.castStartAt)} kind="cast" label={`詠唱中: ${casting.text}`} />
          ) : (
            <Bar value={0} max={1} kind="cast idle" label="詠唱なし" />
          )}
        </div>

        <div className="voice-row">
          {speech.supported ? (
            <>
              <button
                className={`mic-btn ${speech.listening ? 'on' : ''}`}
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                title="ONの間はずっと聞き取る。話して少し間が空くと詠唱される"
              >
                🎙 音声 {speech.listening ? 'ON' : 'OFF'}
              </button>
              <div className="voice-text">
                {speech.listening ? (
                  speech.interim ? <span className="heard-now">「{speech.interim}」</span> : <span>聞き取り中… 呪文を唱えて、少し間を空けると発動</span>
                ) : speech.error ? (
                  <span className="bad">{speech.error}</span>
                ) : (
                  <span className="muted">呪文は声で唱える。🎙 を押して ON にしよう（音声はブラウザの音声認識で文字にする。Chrome では Google のサーバーに送られる）</span>
                )}
                {lastHeard && !speech.interim && <div className="muted heard-last">聞き取った候補（【】が使ったもの）: {lastHeard}</div>}
              </div>
            </>
          ) : (
            <span className="muted">このブラウザは音声入力に対応していない（Chrome / Edge / Safari で使える）</span>
          )}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </main>

      <aside className="side">
        <ChantPanel listening={speech.listening} interim={speech.interim} fx={chantFx} mana={s.mana.current} manaMax={s.mana.max} />
        <Section title="詠唱キュー">
          <QueuePanel s={s} onCancel={(id) => engine.cancelSpell(id)} />
        </Section>
        <Section title="詠唱の解釈結果">
          <InterpretationPanel entry={lastEntry} />
        </Section>
        <Section title="魔力消費内訳">
          <CostPanel entry={lastEntry} />
        </Section>
        <Section title="自律術式（ハーネス）">
          <HarnessPanel s={s} />
        </Section>
        <Section title="戦闘ログ">
          <LogPanel s={s} />
        </Section>
        <Section title="詠唱履歴" right={history.length > 0 ? <button className="btn-mini" onClick={() => { setHistory([]); saveHistory([]); }}>消去</button> : undefined}>
          {history.length === 0 ? (
            <div className="muted">唱えた呪文がここに残る</div>
          ) : (
            <ul className="history">
              {history.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </Section>
      </aside>
    </div>
  );
}

function Bar({ value, max, kind, label }: { value: number; max: number; kind: string; label: string }) {
  const p = Math.max(0, Math.min(1, value / max));
  return (
    <div className={`bar ${kind}`}>
      <div className="fill" style={{ width: `${p * 100}%` }} />
      <span className="bar-label">{label}</span>
    </div>
  );
}
