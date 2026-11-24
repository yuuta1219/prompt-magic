/**
 * 第一部のエンドロール。真ん中をクレジットが下から上へ流れ、左右にこれまでの印象的な絵が流れていく。
 * 曲は public/bgm/credits.mp3（無ければ ending を代わりに流す）。曲が終わる長さに合わせて流す。
 * 飛ばすのは「スキップ」ボタンだけ（うっかりクリックで終わらないように）。
 * 背景は夜明け前の空：オーロラがゆらぎ、ナノマシンの光の粒が立ちのぼる。
 */
import { useEffect, useRef, useState } from 'react';
import { VOICE_CAST } from './voiceKey';
import { bgmNow, playBgm } from '../ui/bgm';
import { playSfx } from '../ui/sound';

const IMG_BASE = '../story/';

/** ゆっくり一枚ずつ浮かぶ絵（左右交互に）。全部は出さず、物語の節目だけ */
const SHOTS = ['ep1/08-smoke', 'ep2/15-candle', 'ep3/26-mother', 'ep5/20-sticky-note', 'ep6/18-grave', 'ep7/13-camp', 'ep7/25-dawn-top'];

/** 歌詞（Then I'll Keep Walking On）。秒は曲の中の位置。英語の下に日本語の訳 */
const LYRICS: { at: number; en: string; ja: string }[] = [
  { at: 7.0, en: 'I slept beyond the end of the world', ja: '眠りの向こうで、世界は変わって' },
  { at: 14.0, en: 'Words became magic, prayers turned to light', ja: '言葉は魔法に、祈りは光に' },
  { at: 20.1, en: 'A sticky note that said "fix it later"', ja: '「あとで直す」と書いた付箋を' },
  { at: 26.2, en: 'Still folded tight inside my pocket', ja: 'ポケットの中で、握りしめてた' },
  { at: 31.6, en: 'Say the word, this time not alone', ja: '唱えよう、今度はひとりじゃなくて' },
  { at: 38.5, en: 'Turn the voices lost into the dawn', ja: '届かなかった声を、朝に変えて' },
  { at: 44.6, en: 'Check it twice, again, with my own hands', ja: '確かめよう、何度でも、この手で' },
  { at: 51.9, en: "Every word I speak, I'll stand behind", ja: '唱えた言葉に、責任を' },
  { at: 56.6, en: "One more smoke, then I'll keep walking on", ja: '一服したら、また歩き出そう' },
];
const LYRIC_END = 64;

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
  // 曲の再生位置に合わせて、いまの歌詞を出す
  const [line, setLine] = useState(-1);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      const now = bgmNow();
      const t = now?.name === 'credits' ? now.time : (performance.now() - t0) / 1000;
      let i = -1;
      for (let k = 0; k < LYRICS.length; k++) if (t >= LYRICS[k].at) i = k;
      if (t >= LYRIC_END) i = -1;
      setLine(i);
    }, 200);
    return () => clearInterval(id);
  }, []);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    playBgm('credits');
    // 曲の長さに合わせて流す（読めなければ2分）
    const a = new Audio('../bgm/credits.mp3');
    a.addEventListener('loadedmetadata', () => a.duration && isFinite(a.duration) && setDur(Math.max(60, a.duration - 4)));
  }, []);

  // 曲が終わったら、少し余韻 → 画面がジジジと乱れる → 月の場面へ
  const [phase, setPhase] = useState<'roll' | 'after' | 'glitch'>('roll');
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('after');
      playBgm(null);
    }, (dur + 4) * 1000);
    const t2 = setTimeout(() => {
      setPhase('glitch');
      playSfx('glitch', 0.6);
    }, (dur + 8) * 1000);
    const t3 = setTimeout(() => doneRef.current(), (dur + 10.2) * 1000);
    return () => [t1, t2, t3].forEach(clearTimeout);
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
    <div className={`endroll ph-${phase}`} role="dialog" aria-label="エンドロール" style={{ '--dur': `${dur}s` } as React.CSSProperties}>
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
      <div className="er-lyrics" aria-live="off">
        {line >= 0 && (
          <div key={line} className="er-lyric">
            <div className="en">{LYRICS[line].en}</div>
            <div className="ja">{LYRICS[line].ja}</div>
          </div>
        )}
      </div>
      {phase === 'glitch' && (
        <div className="er-glitch" aria-hidden>
          <div className="g-noise" />
          <div className="g-bar b1" />
          <div className="g-bar b2" />
          <div className="g-bar b3" />
        </div>
      )}
      <button className="ks-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>スキップ ▶▶</button>
    </div>
  );
}
