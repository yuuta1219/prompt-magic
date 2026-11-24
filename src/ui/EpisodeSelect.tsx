/**
 * 話を選ぶ画面（ワールドマップ）。第1話〜第7話を、東京の地図の上の場所として並べる。
 * 選ぶと、その話のすごろくマップ（チャプター選択）が開く。
 */
import { useState } from 'react';
import type { Episode } from '../story/types';
import type { Progress } from '../game/progress';
import { tweetUrl } from './share';

const IMG_BASE = '../story/';

/** 地図の上の場所（%）。地下 → 芝 → 渋谷 → 東京駅 → 新橋 → 錦糸町 → スカイツリー */
const SPOTS = [
  { x: 34, y: 84, place: '地下' },
  { x: 46, y: 62, place: '芝公園' },
  { x: 16, y: 44, place: '渋谷' },
  { x: 50, y: 22, place: '東京駅' },
  { x: 66, y: 56, place: '新橋' },
  { x: 80, y: 32, place: '錦糸町' },
  { x: 91, y: 12, place: '押上' },
];

export function EpisodeSelect({
  episodes,
  progress,
  current,
  onPick,
  onTree,
  onFree,
  freeOpen,
}: {
  episodes: { ep: Episode; open: boolean; cleared: boolean }[];
  progress: Progress;
  current: number;
  onPick: (idx: number) => void;
  onTree: () => void;
  onFree: () => void;
  freeOpen: boolean;
}) {
  const [sel, setSel] = useState(current);
  const s = episodes[sel];
  const done = (e: Episode) => e.chapters.filter((c) => progress.story.includes(c.id)).length;
  const thumb = (e: Episode) => e.nextThumb ?? e.prologueThumb;
  // 道は、開いている話まで光らせる
  const lastOpen = episodes.reduce((n, e, i) => (e.open ? i : n), 0);
  const road = (until: number) =>
    `M ${SPOTS[0].x} ${SPOTS[0].y} ` +
    SPOTS.slice(1, until + 1)
      .map((p, i) => {
        const a = SPOTS[i];
        return `Q ${(a.x + p.x) / 2} ${Math.min(a.y, p.y) - 8}, ${p.x} ${p.y}`;
      })
      .join(' ');

  return (
    <div className="map world">
      <header className="map-h">
        <a className="map-logo" href="../">PROMPT MAGIC</a>
        <div className="map-ep">
          <span className="map-ep-no">第一部</span>
          <span className="map-ep-name">終末の東京</span>
        </div>
        <div className="map-actions">
          <span className="map-sp">SP <b>{progress.sp}</b></span>
          <button className={progress.sp > 0 ? 'has-sp' : ''} onClick={onTree}>🌳 スキル</button>
          <button disabled={!freeOpen} onClick={onFree} title={freeOpen ? '勝つたびに強くなる敵と戦い続ける' : '第1話をクリアすると開く'}>
            ⚔ 修練場{freeOpen ? '' : '🔒'}
          </button>
        </div>
      </header>

      <div className="map-board world-board">
        {s.open && thumb(s.ep) && <div key={sel} className="map-bg" style={{ backgroundImage: `url(${IMG_BASE}${thumb(s.ep)}.jpg)` }} aria-hidden />}
        <svg className="map-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={road(SPOTS.length - 1)} className="road-base" />
          {lastOpen > 0 && <path d={road(lastOpen)} className="road-lit" />}
        </svg>
        {episodes.map((e, i) => (
          <button
            key={e.ep.id}
            className={`world-spot ${e.open ? (e.cleared ? 'st-done' : 'st-open') : 'st-locked'} ${i === sel ? 'sel' : ''} ${i === current ? 'here' : ''}`}
            style={{ left: `${SPOTS[i].x}%`, top: `${SPOTS[i].y}%` }}
            onClick={() => setSel(i)}
            onDoubleClick={() => e.open && onPick(i)}
          >
            <span className="ws-pin" style={e.open && thumb(e.ep) ? { backgroundImage: `url(${IMG_BASE}${thumb(e.ep)}.jpg)` } : undefined} />
            <span className="ws-no">{i + 1}</span>
            {e.cleared && <span className="mn-check">✔</span>}
            <span className="ws-label">
              <span className="ws-place">{SPOTS[i].place}</span>
              <span className="ws-title">{e.open ? e.ep.subtitle : '？？？'}</span>
            </span>
          </button>
        ))}
      </div>

      <section className="map-panel">
        <div className="mp-kicker">{s.ep.title}　{SPOTS[sel].place}</div>
        <div className="mp-title">{s.open ? s.ep.subtitle : '？？？'}</div>
        <p className="mp-desc">
          {s.open ? `チャプター ${done(s.ep)} / ${s.ep.chapters.length} クリア` : `${episodes[sel - 1]?.ep.title ?? ''}をクリアすると開く。`}
        </p>
        {s.cleared && (
          <a className="mp-share" href={tweetUrl(sel + 1, s.ep.subtitle)} target="_blank" rel="noopener noreferrer">
            𝕏 クリアをポスト
          </a>
        )}
        {s.open && (
          <button className="mp-go" onClick={() => onPick(sel)}>
            {s.cleared ? '↻ もう一度あそぶ' : done(s.ep) > 0 ? '▶ つづきから' : '▶ はじめる'}
          </button>
        )}
      </section>
    </div>
  );
}
