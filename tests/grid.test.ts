import { GridSystem } from '../src/game/GridSystem';

describe('GridSystem', () => {
  it('盤面は9x9', () => {
    expect(GridSystem.size).toBe(9);
    expect(GridSystem.inBounds({ x: 8, y: 8 })).toBe(true);
    expect(GridSystem.inBounds({ x: 9, y: 0 })).toBe(false);
  });
  it('端までの最大歩数', () => {
    expect(GridSystem.maxSteps({ x: 4, y: 4 }, 'right')).toBe(4);
    expect(GridSystem.maxSteps({ x: 8, y: 4 }, 'right')).toBe(0);
    expect(GridSystem.maxSteps({ x: 4, y: 4 }, 'up_left')).toBe(4);
  });
  it('攻撃形状は盤面内に収まる', () => {
    expect(GridSystem.shapeCells({ x: 0, y: 0 }, 'square3')).toHaveLength(4);
    expect(GridSystem.shapeCells({ x: 4, y: 4 }, 'cross')).toHaveLength(5);
    expect(GridSystem.shapeCells({ x: 4, y: 4 }, 'row')).toHaveLength(9);
  });
});
