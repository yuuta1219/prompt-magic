/**
 * /play/ のいちばん外側。画面の切り替えだけを受け持つ。
 *
 *   はじめて → プロローグ（紙芝居）→ すごろくマップ
 *   マップでチャプターを選ぶ → 紙芝居（前）→ 戦闘 → 勝ったら紙芝居（後）→ マップ（次のマスが開く）
 *   第1話をクリアすると、修練場（勝つたびに強くなるエンドレス）が開く
 */
import { useEffect, useRef, useState } from 'react';
import { App, type BattleSpec } from './App';
import { Sugoroku } from './Sugoroku';
import { SkillTree } from './SkillTree';
import { Kamishibai } from '../story/Kamishibai';
import { EPISODES, chapterAfter, chapterBefore } from '../story';
import type { Chapter, StoryScene } from '../story/types';
import { applyDevGrant, loadProgress, markStorySeen, newProgress, saveProgress, unlockSkill, type Progress } from '../game/progress';

/** 修練場はステージ6から（ステージ1〜5は第1話で戦うので） */
export const FREE_FIRST_STAGE = 6;

type Screen =
  | { k: 'map'; focus?: string }
  | { k: 'story'; scene: StoryScene; then: () => void }
  | { k: 'battle'; spec: BattleSpec; chapter?: Chapter; id: number };

export function Game() {
  const [progress, setProgressState] = useState<Progress>(() => applyDevGrant(loadProgress()));
  const progressRef = useRef(progress);
  const setProgress = (p: Progress) => {
    progressRef.current = p;
    setProgressState(p);
    saveProgress(p);
  };
  const ep = EPISODES[0];
  const battleId = useRef(0);
  const [treeOpen, setTreeOpen] = useState(false);

  const toMap = (focus?: string) => setScreen({ k: 'map', focus });
  const playPrologue = () =>
    setScreen({
      k: 'story',
      scene: ep.prologue,
      then: () => {
        setProgress(markStorySeen(progressRef.current, ep.prologue.id));
        toMap(ep.chapters[0].id);
      },
    });
  const [screen, setScreen] = useState<Screen>(() => ({ k: 'map' }));
  // はじめて開いたときは、マップより先にプロローグ
  useEffect(() => {
    if (!progressRef.current.story.includes(ep.prologue.id)) playPrologue();
  }, [progress.story.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const startChapter = (c: Chapter) =>
    setScreen({
      k: 'story',
      scene: chapterBefore(c),
      then: () => setScreen({ k: 'battle', chapter: c, id: ++battleId.current, spec: { kind: 'chapter', stage: c.stage, enemy: c.enemy, enemySprite: c.sprite, label: `チャプター${c.no} ${c.title}` } }),
    });

  const startFree = () => {
    const p = progressRef.current;
    if (p.stage < FREE_FIRST_STAGE) setProgress({ ...p, stage: FREE_FIRST_STAGE });
    const stage = Math.max(p.stage, FREE_FIRST_STAGE);
    setScreen({ k: 'battle', id: ++battleId.current, spec: { kind: 'free', stage, enemy: '古代術式体', enemySprite: 'ancient', label: '修練場' } });
  };

  const leaveBattle = (won: boolean) => {
    if (screen.k !== 'battle') return;
    const c = screen.chapter;
    if (!won || !c) return toMap(c?.id);
    // 勝ったら、紙芝居を見る前にクリアを記録しておく（途中で閉じても進み具合は残る）
    setProgress(markStorySeen(progressRef.current, c.id));
    const idx = ep.chapters.indexOf(c);
    const next = ep.chapters[idx + 1]?.id ?? 'ep-next';
    const after = chapterAfter(c);
    if (after) setScreen({ k: 'story', scene: after, then: () => toMap(next) });
    else toMap(next);
  };

  if (screen.k === 'story') return <Kamishibai key={screen.scene.id} scene={screen.scene} onDone={screen.then} />;

  if (screen.k === 'battle')
    return <App key={screen.id} progress={progress} setProgress={setProgress} battle={screen.spec} onLeave={leaveBattle} />;

  return (
    <>
      <Sugoroku
        episode={ep}
        progress={progress}
        focus={screen.focus}
        onPrologue={playPrologue}
        onChapter={startChapter}
        onFree={startFree}
        onTree={() => setTreeOpen(true)}
      />
      {treeOpen && (
        <SkillTree
          progress={progress}
          inBattle={false}
          onClose={() => setTreeOpen(false)}
          onUnlock={(id) => {
            const r = unlockSkill(progressRef.current, id);
            if (typeof r === 'string') return r;
            setProgress(r);
            return null;
          }}
          onReset={() => {
            setProgress(newProgress());
            setTreeOpen(false);
          }}
        />
      )}
    </>
  );
}
