import { GRID_SIZE } from './constants';
import type { Direction, Shape } from '../interpreter/schema';
import type { Vec } from './types';

/** 盤面に関する純粋関数群。各フィールドは独立した 9x9 座標 (0..8) を持つ。 */
export const GridSystem = {
  size: GRID_SIZE,

  inBounds(p: Vec): boolean {
    return p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE;
  },

  clamp(p: Vec): Vec {
    return {
      x: Math.max(0, Math.min(GRID_SIZE - 1, p.x)),
      y: Math.max(0, Math.min(GRID_SIZE - 1, p.y)),
    };
  },

  /** 方向ベクトル。up = 敵フィールド側（画面上方向） */
  dirVec(d: Exclude<Direction, 'auto'>): Vec {
    switch (d) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
      case 'up_left': return { x: -1, y: -1 };
      case 'up_right': return { x: 1, y: -1 };
      case 'down_left': return { x: -1, y: 1 };
      case 'down_right': return { x: 1, y: 1 };
    }
  },

  /** 指定方向に何マスまで進めるか（盤面端まで） */
  maxSteps(from: Vec, d: Exclude<Direction, 'auto'>): number {
    const v = GridSystem.dirVec(d);
    let n = 0;
    let p = { ...from };
    for (;;) {
      p = { x: p.x + v.x, y: p.y + v.y };
      if (!GridSystem.inBounds(p)) return n;
      n++;
    }
  },

  step(from: Vec, d: Exclude<Direction, 'auto'>, n: number): Vec {
    const v = GridSystem.dirVec(d);
    return { x: from.x + v.x * n, y: from.y + v.y * n };
  },

  /** 攻撃形状 → 影響マス（盤面内のみ） */
  shapeCells(center: Vec, shape: Shape): Vec[] {
    const out: Vec[] = [];
    const add = (x: number, y: number) => {
      const p = { x, y };
      if (GridSystem.inBounds(p)) out.push(p);
    };
    switch (shape) {
      case 'single':
        add(center.x, center.y);
        break;
      case 'cross':
        add(center.x, center.y);
        add(center.x + 1, center.y);
        add(center.x - 1, center.y);
        add(center.x, center.y + 1);
        add(center.x, center.y - 1);
        break;
      case 'square3':
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(center.x + dx, center.y + dy);
        break;
      case 'row':
        for (let x = 0; x < GRID_SIZE; x++) add(x, center.y);
        break;
      case 'column':
        for (let y = 0; y < GRID_SIZE; y++) add(center.x, y);
        break;
    }
    return out;
  },

  /** 形状の最大マス数（範囲コスト計算用。盤面端で欠けても同じコスト） */
  shapeSize(shape: Shape): number {
    return { single: 1, cross: 5, square3: 9, row: GRID_SIZE, column: GRID_SIZE }[shape];
  },

  contains(cells: Vec[], p: Vec): boolean {
    return cells.some((c) => c.x === p.x && c.y === p.y);
  },

  manhattan(a: Vec, b: Vec): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  },

  neighbors8(p: Vec): Vec[] {
    const out: Vec[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (GridSystem.inBounds(q)) out.push(q);
      }
    return out;
  },
};
