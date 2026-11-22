/**
 * 紙芝居。全画面に絵を出して、セリフを1行ずつ送る。
 * クリック / Enter / Space で次へ。「スキップ」で場面ごと飛ばす。
 */
import { useEffect, useRef, useState } from 'react';
import type { StoryScene } from './types';

/** ゲームは /play/ にあるので、public/story/ はひとつ上 */
const IMG_BASE = '../story/';
const TYPE_MS = 28;

export function Kamishibai({ scene, onDone }: { scene: StoryScene; onDone: () => void }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});
  const page = scene.pages[pageIdx];
  const line = page.lines[lineIdx];
  const typing = typed < line.text.length;

  // 1文字ずつ出す
  useEffect(() => {
    setTyped(0);
    const t = setInterval(() => setTyped((n) => (n >= line.text.length ? n : n + 1)), TYPE_MS);
    return () => clearInterval(t);
  }, [pageIdx, lineIdx, line.text]);

  const next = () => {
    if (typing) return setTyped(line.text.length);
    if (lineIdx + 1 < page.lines.length) return setLineIdx(lineIdx + 1);
    if (pageIdx + 1 < scene.pages.length) {
      setPageIdx(pageIdx + 1);
      setLineIdx(0);
      return;
    }
    onDone();
  };
  const nextRef = useRef(next);
  nextRef.current = next;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        doneRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const img = page.img && !brokenImg[page.img] ? `${IMG_BASE}${page.img}.jpg` : null;

  return (
    <div className={`ks ks-${page.tone ?? 'plain'}`} role="dialog" aria-label="ストーリー" onClick={next}>
      {img && (
        <img
          // 同じ絵が続くあいだは、ゆっくり寄るアニメーションを続ける
          key={page.img}
          className="ks-img"
          src={img}
          alt=""
          onError={() => setBrokenImg((b) => ({ ...b, [page.img!]: true }))}
        />
      )}
      <div className="ks-tint" />
      {page.fx && <div key={`fx-${pageIdx}`} className={`ks-fx ks-fx-${page.fx}`} />}

      {page.title ? (
        <div className="ks-title" key={`t-${pageIdx}`}>
          {page.lines.slice(0, lineIdx + 1).map((l, i) => (
            <div key={i} className={i === 0 ? 'big' : 'small'}>{i === lineIdx ? l.text.slice(0, typed) : l.text}</div>
          ))}
        </div>
      ) : (
        <div className={`ks-box ${line.who === undefined ? 'narr' : ''}`}>
          {line.who ? <div className="ks-who">{line.who}</div> : null}
          <div className={`ks-text ${line.who === '' ? 'sfx' : ''}`}>
            {line.text.slice(0, typed)}
            {!typing && <span className="ks-next">▼</span>}
          </div>
        </div>
      )}

      <button
        className="ks-skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        スキップ ▶▶
      </button>
      <div className="ks-hint">クリック / Enter で次へ</div>
    </div>
  );
}
