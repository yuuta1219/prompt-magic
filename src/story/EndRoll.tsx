/**
 * 第一部のエンドロール。真ん中をクレジットが下から上へ流れ、左右にこれまでの印象的な絵が流れていく。
 * 曲は public/bgm/credits.mp3（無ければ ending を代わりに流す）。曲が終わる長さに合わせて流す。
 * クリック / Enter / Esc で飛ばせる。
 */
import { useEffect, useRef, useState } from 'react';
import { VOICE_CAST } from './voiceKey';
import { playBgm } from '../ui/bgm';

const IMG_BASE = '../story/';

/** 左右に流す絵（第1話〜第7話の印象的な場面） */
const LEFT = ['ep1/01-pod', 'ep1/07-surface', 'ep2/02-girl', 'ep2/15-candle', 'ep3/02-crossing', 'ep3/20-sora-shout', 'ep4/10-archive-core', 'ep5/10-flashback-office', 'ep6/12-untouched', 'ep7/13-camp', 'ep7/23-hotfix'];
const RIGHT = ['ep1/08-smoke', 'ep2/12-tower-top', 'ep2/13-girl-ready', 'ep3/14-hachiko', 'ep3/26-mother', 'ep4/12-oracle-form', 'ep4/18-alone', 'ep5/20-sticky-note', 'ep6/18-grave', 'ep7/20-final-chant', 'ep7/25-dawn-top'];

type Block = { head?: string; lines: string[]; voices?: { name: string; roles: string }[] };

function credits(): Block[] {
  const voices = new Map<string, string[]>();
  for (const [role, c] of Object.entries(VOICE_CAST)) {
    const name = `VOICEVOX:${c.name.replace(/（.*）/, '')}`;
    if (!voices.has(name)) voices.set(name, []);
    voices.get(name)!.push(role);
  }
  return [
    { head: 'PROMPT MAGIC', lines: ['第一部　終末の東京'] },
    { head: '主人公', lines: ['やにかわ'] },
    { head: '登場人物', lines: ['管理術式オラクル', 'ノワール（ミナト）', 'エターナル・フォビドゥン・グランドマスター・ゲンジロウ', 'ソラ', 'ハル', 'ソラとハルの母', 'サージ', '上司'] },
    { head: '声の出演', lines: [], voices: [...voices.entries()].map(([name, roles]) => ({ name, roles: `${roles.slice(0, 3).join('・')}${roles.length > 3 ? ' ほか' : ''}` })) },
    { head: '第1話', lines: ['82年寝坊した詠唱者'] },
    { head: '第2話', lines: ['中二病の街と、電波の塔'] },
    { head: '第3話', lines: ['無言の街'] },
    { head: '第4話', lines: ['記録の駅'] },
    { head: '第5話', lines: ['新橋'] },
    { head: '第6話', lines: ['錦糸町'] },
    { head: '第7話', lines: ['最後の詠唱'] },
    { head: '音楽', lines: ['Suno'] },
    { head: '音声合成', lines: ['VOICEVOX'] },
    { head: '原作・脚本・制作', lines: ['やにかわ'] },
    { lines: ['詠唱とは、世界への命令である。', 'そして、確認とは、その命令に責任を持つことである。'] },
    { head: 'Thank you for playing', lines: ['――　第二部へ　――'] },
  ];
}

export function EndRoll({ onDone }: { onDone: () => void }) {
  const [dur, setDur] = useState(120);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    playBgm('credits');
    // 曲の長さに合わせて流す（読めなければ2分）
    const a = new Audio('../bgm/credits.mp3');
    a.addEventListener('loadedmetadata', () => a.duration && isFinite(a.duration) && setDur(Math.max(60, a.duration - 4)));
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', 'Escape', ' '].includes(e.key)) doneRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), (dur + 4) * 1000);
    return () => clearTimeout(t);
  }, [dur]);

  const col = (imgs: string[], cls: string) => (
    <div className={`er-col ${cls}`} style={{ '--dur': `${dur}s` } as React.CSSProperties} aria-hidden>
      <div className="er-strip">
        {[...imgs, ...imgs].map((p, i) => (
          <img key={i} src={`${IMG_BASE}${p}.jpg`} alt="" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="endroll" role="dialog" aria-label="エンドロール" onClick={() => onDone()}>
      {col(LEFT, 'left')}
      <div className="er-center">
        <div className="er-scroll" style={{ '--dur': `${dur}s` } as React.CSSProperties}>
          {credits().map((b, i) => (
            <div key={i} className="er-block">
              {b.head && <div className="er-head">{b.head}</div>}
              {b.lines.map((l, j) => (
                <div key={j} className="er-line">{l}</div>
              ))}
              {b.voices?.map((v) => (
                <div key={v.name} className="er-voice">
                  <div className="er-role">{v.roles}</div>
                  <div className="er-line">{v.name}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {col(RIGHT, 'right')}
      <button className="ks-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>スキップ ▶▶</button>
    </div>
  );
}
