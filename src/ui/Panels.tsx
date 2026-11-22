import { useEffect, useRef } from 'react';
import type { BattleState } from '../game/BattleState';
import type { SpellEntry } from '../game/types';
import type { Action } from '../interpreter/schema';
import { describeTrigger } from '../game/HarnessEngine';
import { ELEMENTS } from '../game/elements';

const STATUS_JA: Record<SpellEntry['status'], string> = {
  interpreting: '解釈中',
  waiting_mana: '魔力待機',
  casting: '詠唱中',
  done: '発動',
  failed: '不発',
  cancelled: '取消',
};

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-h">
        <span>{title}</span>
        {right}
      </header>
      <div className="panel-b">{children}</div>
    </section>
  );
}

function fmtAction(a: Action): string {
  switch (a.type) {
    case 'MOVE':
      return `MOVE dir=${a.direction} dist=${a.distance ?? 'ランダム'}${a.avoidDanger ? ' 予兆回避' : ''}`;
    case 'ATTACK':
      return `ATTACK ${a.boost ? 'パワー ' : ''}${ELEMENTS[a.element].name}（${ELEMENTS[a.element].shapeLabel}） 照準=${a.target}${a.cell ? `(${a.cell.x},${a.cell.y})` : ''} 着弾${a.delayMs}ms`;
    case 'DEFEND':
      return `DEFEND ${Math.round(a.reduction * 100)}% ${a.durationMs}ms ${a.timing}`;
    case 'HEAL':
      return `HEAL +${a.amount}`;
    case 'NOOP':
      return `NOOP 「${a.reason}」`;
    case 'REGISTER_AUTOMATION':
      return `REGISTER_AUTOMATION 「${a.harness.name}」`;
  }
}

export function QueuePanel({ s, onCancel }: { s: BattleState; onCancel: (id: number) => void }) {
  const active = s.spells.filter((e) => ['interpreting', 'waiting_mana', 'casting'].includes(e.status));
  if (active.length === 0) return <div className="muted">待機中の詠唱なし</div>;
  return (
    <ul className="queue">
      {active.map((e) => {
        const castP = e.status === 'casting' && e.castStartAt !== undefined && e.castEndAt !== undefined
          ? Math.min(1, (s.time - e.castStartAt) / Math.max(1, e.castEndAt - e.castStartAt)) : 0;
        const manaP = e.status === 'waiting_mana' && e.cost ? Math.min(1, s.mana.current / e.cost.total) : 0;
        return (
          <li key={e.id} className={`q q-${e.status}`}>
            <div className="q-row">
              <span className={`badge b-${e.status}`}>{STATUS_JA[e.status]}</span>
              <span className="q-text">{e.text}</span>
              <button className="btn-mini" onClick={() => onCancel(e.id)}>取消</button>
            </div>
            {e.status === 'casting' && <div className="bar thin"><div className="fill cast" style={{ width: `${castP * 100}%` }} /></div>}
            {e.status === 'waiting_mana' && e.cost && (
              <div className="bar thin"><div className="fill mana" style={{ width: `${manaP * 100}%` }} /><span className="bar-label">{Math.floor(s.mana.current)}/{e.cost.total}</span></div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function InterpretationPanel({ entry }: { entry: SpellEntry | undefined }) {
  if (!entry) return <div className="muted">まだ詠唱していない</div>;
  return (
    <div className="interp">
      <div className="interp-src">
        「{entry.text}」
        <span className={`badge b-${entry.status}`}>{STATUS_JA[entry.status]}</span>
      </div>
      {entry.error && <div className="err">✖ {entry.error}</div>}
      {entry.spell && (
        <ol className="actions">
          {entry.spell.actions.map((a, i) => (
            <li key={i}><code>{fmtAction(a)}</code></li>
          ))}
        </ol>
      )}
      {entry.reasoning.length > 0 && (
        <ul className="reasoning">
          {entry.reasoning.map((r, i) => <li key={i}>💭 {r}</li>)}
        </ul>
      )}
    </div>
  );
}

export function CostPanel({ entry }: { entry: SpellEntry | undefined }) {
  const c = entry?.cost;
  if (!c) return <div className="muted">詠唱の解釈後に表示</div>;
  const rows: [string, string, number][] = [
    ['詠唱トークン', `${c.gameTokens} tok（冗長さ）`, c.tokenCost],
    ['複雑度', `${c.complexityPoints} pt（処理の高度さ）`, c.complexityCost],
    ['効果', '', c.effectCost],
    ['範囲', '', c.areaCost],
    ['自動化', '', c.automationCost],
  ];
  return (
    <div className="cost">
      <table>
        <tbody>
          {rows.map(([k, sub, v]) => (
            <tr key={k} className={v === 0 ? 'zero' : ''}>
              <th>{k}</th>
              <td className="sub">{sub}</td>
              <td className="num">{v}</td>
            </tr>
          ))}
          <tr className="total">
            <th>合計</th>
            <td className="sub">詠唱時間 {(c.castTimeMs / 1000).toFixed(2)}s</td>
            <td className="num">{c.total}</td>
          </tr>
        </tbody>
      </table>
      {c.notes.map((n, i) => <div key={i} className="note">※ {n}</div>)}
    </div>
  );
}

export function HarnessPanel({ s }: { s: BattleState }) {
  if (s.harnesses.length === 0)
    return <div className="muted">未登録。例:「敵が攻撃詠唱を開始したら、着弾予定マスを避けて隣接マスに移動する。ただし魔力が100以下なら実行しない」</div>;
  return (
    <>
      {s.harnesses.map((h) => {
        const cd = Math.max(0, h.spec.cooldownMs - (s.time - h.lastTriggeredAt));
        const exhausted = h.triggerCount >= h.spec.maxTriggers;
        return (
          <div key={h.id} className={`harness ${exhausted ? 'exhausted' : ''}`}>
            <div className="harness-name">⚙ {h.spec.name} <span className="muted">({h.triggerCount}/{h.spec.maxTriggers})</span></div>
            <div className="kv"><span>trigger</span><span>{describeTrigger(h.spec)}</span></div>
            <div className="kv"><span>conditions</span><span>{h.spec.conditions.length ? h.spec.conditions.map((c) => `${c.type} ${c.value}`).join(', ') : 'なし'}</span></div>
            <div className="kv"><span>actions</span><span>{h.spec.actions.map((a) => fmtAction(a)).join(' / ')}</span></div>
            <div className="kv"><span>cooldown</span><span>{(h.spec.cooldownMs / 1000).toFixed(1)}s {cd > 0 && Number.isFinite(cd) ? `（残り${(cd / 1000).toFixed(1)}s）` : '（待機OK）'}</span></div>
            <div className="kv"><span>manaCost</span><span>{h.triggerCost} / 回</span></div>
            <div className="harness-status">{h.lastStatus}</div>
          </div>
        );
      })}
    </>
  );
}

export function LogPanel({ s }: { s: BattleState }) {
  const ref = useRef<HTMLDivElement>(null);
  const logs = s.logger.all();
  const last = logs.length ? logs[logs.length - 1].id : 0;
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [last]);
  return (
    <div className="log" ref={ref}>
      {logs.map((l) => (
        <div key={l.id} className={`log-line k-${l.kind}`}>
          <span className="t">{(l.t / 1000).toFixed(1).padStart(5, ' ')}</span> {l.text}
        </div>
      ))}
    </div>
  );
}
