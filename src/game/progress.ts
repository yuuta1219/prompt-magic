/**
 * 進み具合（SP・習得済みスキル・ステージ）。ブラウザの localStorage に保存する。
 * 保存できない環境（プライベートウィンドウなど）でも、その場では遊べる。
 */
import { INITIAL_UNLOCKED, SKILLS, SKILL_BY_ID, STAGE, canUnlock, spForWin } from './skills';

export interface Progress {
  sp: number;
  unlocked: string[];
  stage: number;
  wins: number;
  losses: number;
}

const KEY = 'prompt-magic.progress.v1';

/** 名前を変えたスキル（古い保存データを引き継ぐため） */
const RENAMED: Record<string, string> = { void_ragnarok: 'fiat_nox', vanitas: 'fiat_nox' };

export function newProgress(): Progress {
  return { sp: STAGE.SP_START, unlocked: [...INITIAL_UNLOCKED], stage: 1, wins: 0, losses: 0 };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    const unlocked = Array.isArray(p.unlocked)
      ? p.unlocked.map((id) => (typeof id === 'string' ? (RENAMED[id] ?? id) : id)).filter((id) => typeof id === 'string' && SKILL_BY_ID.has(id))
      : [];
    return {
      sp: Number.isFinite(p.sp) ? Math.max(0, Math.floor(p.sp!)) : STAGE.SP_START,
      unlocked: [...new Set([...INITIAL_UNLOCKED, ...unlocked])],
      stage: Number.isFinite(p.stage) ? Math.max(1, Math.floor(p.stage!)) : 1,
      wins: Number.isFinite(p.wins) ? p.wins! : 0,
      losses: Number.isFinite(p.losses) ? p.losses! : 0,
    };
  } catch {
    return newProgress();
  }
}

/**
 * 開発用: URL に ?unlockall を付けて開くと、スキルをすべて解放する（npm run dev のときだけ。本番ビルドでは無効）。
 * 一度解放したら URL から消すので、リロードしても何度も実行されない。
 */
export function applyDevGrant(p: Progress): Progress {
  if (!import.meta.env.DEV || typeof window === 'undefined') return p;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('unlockall')) return p;
  url.searchParams.delete('unlockall');
  window.history.replaceState(null, '', url.toString());
  const next = { ...p, unlocked: SKILLS.map((s) => s.id) };
  saveProgress(next);
  return next;
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 保存できなくても遊べる */
  }
}

/** 戦闘の結果を反映する（勝ち: SP+(4+ステージ/2)・次のステージへ / 負け: SP+1・同じステージ） */
export function applyResult(p: Progress, victory: boolean): Progress {
  return victory
    ? { ...p, sp: p.sp + spForWin(p.stage), stage: p.stage + 1, wins: p.wins + 1 }
    : { ...p, sp: p.sp + STAGE.SP_LOSE, losses: p.losses + 1 };
}

export function unlockSkill(p: Progress, id: string): Progress | string {
  const chk = canUnlock(id, new Set(p.unlocked), p.sp);
  if (!chk.ok) return chk.reason;
  return { ...p, sp: p.sp - SKILL_BY_ID.get(id)!.cost, unlocked: [...p.unlocked, id] };
}
