import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine, lockedParts } from '../game/GameEngine';
import { interpretSpell } from '../interpreter/SpellInterpreter';
import { TICK_MS, SPELL_LIMITS } from '../game/constants';
import { Board } from './Board';
import { ElementGuide } from './ElementGuide';
import { SkillTree } from './SkillTree';
import { AfterOverlay, ChargeOverlay, ImpactOverlay, chargingUltimate, shakeClass, useImpact } from './Cinematic';
import { applyResult, newProgress, unlockSkill, type Progress } from '../game/progress';
import { ELEMENTS, type SpellKey } from '../game/elements';
import { computeLoadout, spForWin, STAGE } from '../game/skills';
import { useSpeech } from './useSpeech';
import { CastBanner, ChantPanel, type ChantFx } from './Chant';
import { CostPanel, InterpretationPanel, LogPanel, QueuePanel, Section } from './Panels';


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

/** どの戦闘をするか。chapter = ストーリーのチャプター（強さは固定）、free = 修練場（勝つたびに強くなる） */
export interface BattleSpec {
  kind: 'chapter' | 'free';
  stage: number;
  enemy: string;
  /** 画面に出す見出し（「チャプター1 粗大ゴミ」など） */
  label: string;
}

/** 戦闘画面。ストーリーのマップ（Game.tsx）から開く */
export function App({
  progress,
  setProgress: commitProgress,
  battle,
  onLeave,
}: {
  progress: Progress;
  setProgress: (p: Progress) => void;
  battle: BattleSpec;
  /** 戦闘画面を出る。won = 勝って「つづきへ」を押した */
  onLeave: (won: boolean) => void;
}) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const setProgress = (p: Progress) => {
    progressRef.current = p;
    commitProgress(p);
  };
  const loadout = useMemo(() => computeLoadout(progress.unlocked), [progress.unlocked]);
  const engine = useMemo(() => new GameEngine(undefined, { loadout: computeLoadout(progress.unlocked), stage: battle.stage }), []); // eslint-disable-line react-hooks/exhaustive-deps
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
    const spell = interpretSpell(t);
    const actions = spell.actions;
    const recognized = actions.some((a) => a.type !== 'NOOP');
    // まだ覚えていない魔法は、読めても不発になる
    const locked = lockedParts(spell, engine.s.loadout);
    const reason = !r.ok ? r.error : !recognized ? '呪文として読めなかった' : locked.length ? `まだ覚えていない: ${locked.join('・')}` : null;
    setChantFx(reason === null ? { id, text: t, ok: true, color: castColor(actions) } : { id, text: t, ok: false, reason });
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
  if (import.meta.env.DEV) Object.assign(window, { __cast: castText, __engine: engine });
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
    // 修練場は勝つたびに次のステージへ。チャプターはいつも同じ強さ
    engine.configure({ loadout: computeLoadout(p.unlocked), stage: battle.kind === 'free' ? p.stage : battle.stage });
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
    const p = progressRef.current;
    if (battle.kind === 'free') {
      setProgress(applyResult(p, win));
      setLastReward(win ? `+${spForWin(s.stage)} SP 獲得！ 次はステージ${s.stage + 1}` : `+${STAGE.SP_LOSE} SP 獲得（負けても少しだけ成長する）`);
    } else {
      // チャプターの戦闘は何度でも遊べる。SP はもらえるが、修練場のステージは進まない
      setProgress(win ? { ...p, sp: p.sp + spForWin(s.stage), wins: p.wins + 1 } : { ...p, sp: p.sp + STAGE.SP_LOSE, losses: p.losses + 1 });
      setLastReward(win ? `+${spForWin(s.stage)} SP 獲得！` : `+${STAGE.SP_LOSE} SP 獲得（負けても少しだけ成長する）`);
    }
  });
  const enemyName = battle.enemy;

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
            // 最初からやり直すときは、プロローグから
            setProgress(newProgress());
            onLeave(false);
          }}
        />
      )}
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
          <button onClick={() => { if (s.phase !== 'battle' || confirm('戦闘をやめてマップに戻る？')) onLeave(false); }}>🗺 マップ</button>
          <button className={drawer === 'guide' ? 'on' : ''} onClick={() => setDrawer((d) => (d === 'guide' ? null : 'guide'))}>📖 呪文の書</button>
          <button onClick={() => setPaused((p) => !p)}>{paused ? '▶ 再開' : '⏸ 一時停止'}</button>
          <button onClick={restart}>↻ 再戦</button>
          <button className={`tree-btn ${progress.sp > 0 ? 'has-sp' : ''}`} onClick={() => setTreeOpen(true)}>🌳 スキル（SP {progress.sp}）</button>
        </div>
      </header>
      <main className="arena">

        {/* 戦場: 左に敵と自分のHP、右に3Dの盤面 */}
        <div style={chantFx?.color ? ({ '--fxc': chantFx.color } as React.CSSProperties) : undefined} className={`battle-row bs-${chantFx ? (chantFx.ok ? 'fire' : 'fizzle') : speech.interim ? 'charging' : speech.listening ? 'idle' : 'off'}`}>
          {/* 左の列はまるごと詠唱の枠。上に敵、下に自分、そのあいだに大きな魔法陣（押すと音声 ON/OFF） */}
          <ChantPanel
            supported={speech.supported}
            listening={speech.listening}
            interim={speech.interim}
            error={speech.error}
            lastHeard={lastHeard}
            fx={chantFx}
            onToggle={() => (speech.listening ? speech.stop() : speech.start())}
            top={
              <>
        {/* 敵HUD */}
        <div className="hud hud-enemy">
          <div className="hud-name">✶ {enemyName} <span className="muted">{battle.kind === 'free' ? `修練場 ステージ${s.stage}` : battle.label}</span>{s.elite && <span className="elite-tag">★ 強敵</span>}</div>
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

              </>
            }
            bottom={
              <>
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

              </>
            }
          />
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
                  {s.phase === 'victory' && battle.kind === 'chapter' ? (
                    <button className="primary" onClick={() => onLeave(true)}>つづきへ ▶</button>
                  ) : (
                    <button onClick={restart}>{s.phase === 'victory' ? `次の戦闘へ（ステージ${progress.stage}）` : 'もう一度戦う'}</button>
                  )}
                  <button onClick={() => onLeave(false)}>🗺 マップへ</button>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* 右の列も同じ舞台の中。高さは盤面に合わせ、はみ出す分は中でスクロール */}
          <div className="side-wrap">
          <aside className="side">
            <Section title="詠唱キュー">
              <QueuePanel s={s} onCancel={(id) => engine.cancelSpell(id)} />
            </Section>
            <Section title="詠唱の解釈結果">
              <InterpretationPanel entry={lastEntry} />
            </Section>
            <Section title="魔力消費内訳">
              <CostPanel entry={lastEntry} />
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
        </div>

        {toast && <div className="toast">{toast}</div>}
      </main>

    </div>
  );
}

/** 発動したときに舞台が光る色（"r, g, b"）。攻撃なら最初の魔法の属性の色 */
function castColor(actions: ReturnType<typeof interpretSpell>['actions']): string {
  const atk = actions.find((a) => a.type === 'ATTACK');
  if (atk && atk.type === 'ATTACK' && atk.element in ELEMENTS) return ELEMENTS[atk.element as SpellKey].color;
  if (actions.some((a) => a.type === 'HEAL')) return '120, 255, 160';
  if (actions.some((a) => a.type === 'DEFEND')) return '79, 227, 255';
  if (actions.some((a) => a.type === 'MOVE')) return '190, 200, 255';
  return '255, 209, 102';
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
