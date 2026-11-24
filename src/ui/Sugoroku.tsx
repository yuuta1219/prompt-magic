/**
 * すごろくのマップ。プロローグ → チャプター1〜5 → 次の話（準備中）を、くねくねした道でつなぐ。
 * マスを押すと下にそのチャプターの説明が出て、「はじめる」で紙芝居 → 戦闘へ。
 */
import { useState } from 'react';
import type { Chapter, Episode } from '../story/types';
import { chapterOpen, episodeCleared } from '../story';
import type { Progress } from '../game/progress';
import { stageStats } from '../game/skills';

const IMG_BASE = '../story/';

/** マスの位置（マップの幅・高さに対する %）。プロローグ, 1〜5, 次の話 */
const POS = [
  { x: 9, y: 74 },
  { x: 24, y: 46 },
  { x: 39, y: 70 },
  { x: 54, y: 40 },
  { x: 69, y: 66 },
  { x: 83, y: 34 },
  { x: 94, y: 70 },
];

type NodeKind = { k: 'prologue' } | { k: 'chapter'; c: Chapter; idx: number } | { k: 'next' };

export function Sugoroku({
  episode,
  progress,
  focus,
  onPrologue,
  onChapter,
  onFree,
  onTree,
  episodes,
  epIdx,
  onEpisode,
  onBack,
}: {
  episode: Episode;
  progress: Progress;
  focus?: string;
  onPrologue: () => void;
  onChapter: (c: Chapter) => void;
  onFree: () => void;
  onTree: () => void;
  /** 話を切り替える（話のタブと「次の話」のマス） */
  episodes: { title: string; open: boolean }[];
  epIdx: number;
  onEpisode: (idx: number) => void;
  /** マップ（話を選ぶ画面）に戻る */
  onBack: () => void;
}) {
  const done = progress.story;
  const cleared = episodeCleared(episode, done);
  const nodes: NodeKind[] = [{ k: 'prologue' }, ...episode.chapters.map((c, idx) => ({ k: 'chapter' as const, c, idx })), { k: 'next' }];
  // いま進むべきマス（まだクリアしていない最初のチャプター）
  const currentIdx = episode.chapters.findIndex((c) => !done.includes(c.id));
  const here = currentIdx === -1 ? nodes.length - 1 : currentIdx + 1;
  const [sel, setSel] = useState<number>(() => {
    const f = nodes.findIndex((n) => n.k === 'chapter' && n.c.id === focus);
    return f >= 0 ? f : Math.min(here, nodes.length - 2);
  });

  const stateOf = (n: NodeKind): 'done' | 'open' | 'locked' => {
    if (n.k === 'prologue') return done.includes(episode.prologue.id) ? 'done' : 'open';
    if (n.k === 'next') return cleared && episodes[epIdx + 1]?.open ? 'open' : 'locked';
    if (done.includes(n.c.id)) return 'done';
    return chapterOpen(episode, n.idx, done) ? 'open' : 'locked';
  };

  // 道（マスの中心どうしを、ゆるいカーブでつなぐ）。いまいるマスまでの道は金色に光らせる
  const road = (until: number) =>
    `M ${POS[0].x} ${POS[0].y} ` +
    POS.slice(1, until + 1)
      .map((p, i) => {
        const a = POS[i];
        const mx = (a.x + p.x) / 2;
        return `C ${mx} ${a.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(' ');

  const nextTitle = episodes[epIdx + 1]?.title ?? '次の話';
  /** 修練場は第1話をクリアしたら開く（第2話以降を見ているなら、第1話はクリア済み） */
  const freeOpen = epIdx > 0 || cleared;
  const selNode = nodes[sel];
  const selState = stateOf(selNode);
  /** マスの絵（まだ開いていないマスは絵なし） */
  const thumbOf = (n: NodeKind): string | undefined => (n.k === 'chapter' ? n.c.thumb : n.k === 'prologue' ? episode.prologueThumb : episode.nextThumb);
  const selThumb = selState === 'locked' ? undefined : thumbOf(selNode);

  return (
    <div className="map">
      <header className="map-h">
        <button className="map-back" onClick={onBack}>← マップ</button>
        <div className="map-ep">
          <span className="map-ep-no">{episode.title}</span>
          <span className="map-ep-name">{episode.subtitle}</span>
        </div>
        <div className="map-actions">
          <span className="map-sp">SP <b>{progress.sp}</b></span>
          <button className={progress.sp > 0 ? 'has-sp' : ''} onClick={onTree}>🌳 スキル</button>
          <button disabled={!freeOpen} onClick={onFree} title={freeOpen ? '勝つたびに強くなる敵と戦い続ける' : '第1話をクリアすると開く'}>
            ⚔ 修練場{freeOpen ? `（ステージ${Math.max(progress.stage, 6)}）` : '🔒'}
          </button>
        </div>
      </header>

      <div className="map-board">
        {/* 選んだマスの絵を、盤の背景にうっすら出す（選び直すたびにふわっと入れ替わる） */}
        {selThumb && <div key={selThumb} className="map-bg" style={{ backgroundImage: `url(${IMG_BASE}${selThumb}.jpg)` }} aria-hidden />}
        <svg className="map-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={road(POS.length - 1)} className="road-base" />
          {here > 0 && <path d={road(here)} className="road-lit" />}
        </svg>
        {nodes.map((n, i) => {
          const st = stateOf(n);
          const thumb = thumbOf(n);
          const boss = n.k === 'chapter' && stageStats(n.c.stage).elite;
          return (
            <button
              key={i}
              className={`map-node st-${st} ${i === here ? 'here' : ''} ${i === sel ? 'sel' : ''} ${boss ? 'boss' : ''} k-${n.k}`}
              style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}
              onClick={() => setSel(i)}
            >
              <span className="mn-img" style={st !== 'locked' && thumb ? { backgroundImage: `url(${IMG_BASE}${thumb}.jpg)` } : undefined} />
              <span className="mn-no">{n.k === 'prologue' ? 'P' : n.k === 'next' ? '▶' : n.c.no}</span>
              {st === 'done' && <span className="mn-check">✔</span>}
              {boss && <span className="mn-boss">BOSS</span>}
              <span className="mn-title">{n.k === 'prologue' ? 'プロローグ' : n.k === 'next' ? nextTitle : st === 'locked' ? '？？？' : n.c.title}</span>
              {i === here && <span className="mn-token" aria-label="いまいる場所" />}
            </button>
          );
        })}
      </div>

      <section className="map-panel">
        {selNode.k === 'prologue' && (
          <>
            <div className="mp-kicker">プロローグ</div>
            <div className="mp-title">{episode.prologueTitle ?? episode.subtitle}</div>
            <p className="mp-desc">{episode.prologueDesc}</p>
            <button className="mp-go" onClick={onPrologue}>{selState === 'done' ? '📜 もう一度見る' : '▶ はじめる'}</button>
          </>
        )}
        {selNode.k === 'chapter' && (
          <>
            <div className="mp-kicker">チャプター{selNode.c.no}{stageStats(selNode.c.stage).elite ? '・強敵' : ''}</div>
            <div className="mp-title">{selState === 'locked' ? '？？？' : selNode.c.title}</div>
            {selState === 'locked' ? (
              <p className="mp-desc">前のチャプターをクリアすると開く。</p>
            ) : (
              <>
                <p className="mp-desc">敵: {selNode.c.enemy}（HP {stageStats(selNode.c.stage).enemyHp}）</p>
                <button className="mp-go" onClick={() => onChapter(selNode.c)}>{selState === 'done' ? '↻ もう一度あそぶ' : '▶ はじめる'}</button>
              </>
            )}
          </>
        )}
        {selNode.k === 'next' && (
          <>
            <div className="mp-kicker">{nextTitle}</div>
            {episodes[epIdx + 1] ? (
              <>
                <div className="mp-title">{selState === 'open' ? '― 次の話へ ―' : '？？？'}</div>
                <p className="mp-desc">{selState === 'open' ? 'つづきの物語へ進む。' : `${episode.title}をクリアすると開く。`}</p>
                {selState === 'open' && <button className="mp-go" onClick={() => onEpisode(epIdx + 1)}>▶ 次の話へ</button>}
              </>
            ) : (
              <>
                <div className="mp-title">― 準備中 ―</div>
                <p className="mp-desc">{cleared ? 'この先の物語は、まだ書かれていない。それまでは修練場で腕をみがこう。' : `${episode.title}をクリアすると、続きが見えてくる。`}</p>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
