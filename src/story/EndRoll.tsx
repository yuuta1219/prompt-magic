/**
 * 第一部のエンドロール。真ん中をクレジットが下から上へ流れ、左右にこれまでの印象的な絵が流れていく。
 * 曲は public/bgm/credits.mp3（無ければ ending を代わりに流す）。曲が終わる長さに合わせて流す。
 * 飛ばすのは「スキップ」ボタンだけ（うっかりクリックで終わらないように）。
 * 背景は夜明け前の空：オーロラがゆらぎ、ナノマシンの光の粒が立ちのぼる。
 */
import { useEffect, useRef, useState } from 'react';
import { VOICE_CAST } from './voiceKey';
import { playBgm } from '../ui/bgm';

const IMG_BASE = '../story/';

/** ゆっくり一枚ずつ浮かぶ絵（左右交互に）。全部は出さず、物語の節目だけ */
const SHOTS = ['ep1/08-smoke', 'ep2/15-candle', 'ep3/26-mother', 'ep5/20-sticky-note', 'ep6/18-grave', 'ep7/13-camp', 'ep7/25-dawn-top'];

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
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), (dur + 4) * 1000);
    return () => clearTimeout(t);
  }, [dur]);

  // 絵は一枚ずつ、左右交互に、ゆっくりフェードしながら少しずつ寄っていく
  const per = dur / SHOTS.length;
  const shots = SHOTS.map((p, i) => (
    <img
      key={p}
      className={`er-shot ${i % 2 === 0 ? 'left' : 'right'}`}
      src={`${IMG_BASE}${p}.jpg`}
      alt=""
      style={{ animationDelay: `${i * per}s`, animationDuration: `${per + 2}s` } as React.CSSProperties}
    />
  ));

  return (
    <div className="endroll" role="dialog" aria-label="エンドロール" style={{ '--dur': `${dur}s` } as React.CSSProperties}>
      <div className="er-sky" aria-hidden>
        <div className="er-aurora" />
        <div className="er-moon big" />
        <div className="er-moon small" />
        <div className="er-motes">
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 14}s`, animationDuration: `${12 + (i % 7) * 2}s` } as React.CSSProperties} />
          ))}
        </div>
        <div className="er-city" />
      </div>
      <div className="er-shots" aria-hidden>{shots}</div>
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
      <button className="ks-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>スキップ ▶▶</button>
    </div>
  );
}
