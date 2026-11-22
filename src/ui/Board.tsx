import { GRID_SIZE } from '../game/constants';
import { ELEMENTS } from '../game/elements';
import type { BattleState } from '../game/BattleState';
import type { Side } from '../game/types';

interface CellInfo {
  danger: { progress: number; owner: Side; element: string; remainMs: number } | null;
  fx: { element: string; hit: boolean } | null;
}

export function Board({ s, side }: { s: BattleState; side: Side }) {
  const me = side === 'player' ? s.player : s.enemy;
  const cells: CellInfo[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ danger: null, fx: null })),
  );

  for (const a of s.attacks) {
    if (a.field !== side) continue;
    const total = a.resolveAt - a.createdAt;
    const progress = total > 0 ? Math.min(1, (s.time - a.createdAt) / total) : 1;
    for (const c of a.cells) {
      const cur = cells[c.y][c.x].danger;
      if (!cur || cur.progress < progress) {
        cells[c.y][c.x].danger = { progress, owner: a.owner, element: a.element, remainMs: a.resolveAt - s.time };
      }
    }
  }
  for (const f of s.fx) {
    if (f.field !== side) continue;
    for (const c of f.cells) cells[c.y][c.x].fx = { element: f.element, hit: f.hit };
  }

  const shielded = me.shield !== null;
  const ward = side === 'player' && s.reactiveWard !== null;

  return (
    <div className={`board board-${side}`} aria-label={side === 'player' ? 'プレイヤーフィールド' : '敵フィールド'}>
      {cells.map((row, y) =>
        row.map((cell, x) => {
          const here = me.pos.x === x && me.pos.y === y;
          const cls = ['cell'];
          if (side === 'enemy' && s.isWet({ x, y })) cls.push('wet');
          if (cell.danger) cls.push('danger', `owner-${cell.danger.owner}`, `el-${cell.danger.element}`);
          if (cell.fx) cls.push('fx', `el-${cell.fx.element}`, cell.fx.hit ? 'fx-hit' : '');
          const colorOf = (el: string) => (el in ELEMENTS ? ELEMENTS[el as keyof typeof ELEMENTS].color : undefined);
          const elc = cell.danger?.owner === 'player' ? colorOf(cell.danger.element) : cell.fx ? colorOf(cell.fx.element) : undefined;
          const style = cell.danger || elc ? ({ ...(cell.danger ? { '--p': cell.danger.progress } : {}), ...(elc ? { '--elc': elc } : {}) } as React.CSSProperties) : undefined;
          return (
            <div key={`${x}-${y}`} className={cls.join(' ')} style={style} title={`(${x},${y})`}>
              {cell.danger && cell.danger.progress > 0.55 && !here && (
                <span className="countdown">{(cell.danger.remainMs / 1000).toFixed(1)}</span>
              )}
              {here && (
                <div className={`unit unit-${side} ${shielded ? 'shielded' : ''} ${ward ? 'warded' : ''} ${s.isFrozen(side) ? 'frozen' : ''}`}>
                  {side === 'player' ? '◆' : '✶'}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
