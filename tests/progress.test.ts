import { applyResult, newProgress, unlockSkill } from '../src/game/progress';

describe('進み具合', () => {
  it('最初は SP2・ウォーターだけ・ステージ1', () => {
    expect(newProgress()).toEqual({ sp: 2, unlocked: ['water'], stage: 1, wins: 0, losses: 0 });
  });
  it('勝つと SP+(4+ステージ/2) で次のステージ、負けると SP+1 で同じステージ', () => {
    const w = applyResult(newProgress(), true);
    expect(w).toMatchObject({ sp: 6, stage: 2, wins: 1 });
    const l = applyResult(w, false);
    expect(l).toMatchObject({ sp: 7, stage: 2, losses: 1 });
    expect(applyResult(l, true).sp).toBe(7 + 5); // ステージ2の勝利は +5
  });
  it('スキルを解放すると SP が減る。条件を満たさないと理由を返す', () => {
    const p = unlockSkill(newProgress(), 'fire');
    if (typeof p === 'string') throw new Error(p);
    expect(p.sp).toBe(1);
    expect(p.unlocked).toContain('fire');
    expect(unlockSkill(p, 'flare')).toMatch(/先に/);
    expect(unlockSkill(p, 'wide_water')).toMatch(/SP/);
  });
});
