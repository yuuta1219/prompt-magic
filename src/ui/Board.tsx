import { GRID_SIZE } from '../game/constants';
import { ELEMENTS } from '../game/elements';
import type { BattleState } from '../game/BattleState';
import type { Side } from '../game/types';
import { Vfx } from './Vfx';

interface CellInfo {
  danger: { progress: number; owner: Side; element: string; remainMs: number } | null;
  fx: { element: string; hit: boolean; id: number } | null;
}

/** 戦闘キャラの画像（public/units/）。ゲームは /play/ にあるのでひとつ上 */
const UNIT_BASE = '../units/';
/** 読み込めなかった画像（そのときは丸いカプセルで代わりに出す） */
const brokenSprites = new Set<string>();

export function Board({ s, side, sprite }: { s: BattleState; side: Side; sprite?: string }) {
  const me = side === 'player' ? s.player : s.enemy;
  // 敵側は群れの全員を描く（先頭がリーダー。結界・凍結はリーダーだけ）
  const units = side === 'player' ? [s.player] : s.foes();
  const many = side === 'enemy' && s.units > 1;
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
    for (const c of f.cells) cells[c.y][c.x].fx = { element: f.element, hit: f.hit, id: f.id };
  }

  const shielded = me.shield !== null;
  const ward = side === 'player' && s.reactiveWard !== null;

  return (
    <div className={`board board-${side}`} aria-label={side === 'player' ? 'プレイヤーフィールド' : '敵フィールド'}>
      {cells.map((row, y) =>
        row.map((cell, x) => {
          const who = units.findIndex((u) => u.pos.x === x && u.pos.y === y);
          const here = who !== -1;
          const unit = units[who];
          const lead = who === 0;
          const cls = ['cell'];
          if (here) cls.push('occupied', `occ-${side}`);
          if (side === 'enemy' && s.isWet({ x, y })) cls.push('wet');
          if (cell.danger) cls.push('danger', `owner-${cell.danger.owner}`, `el-${cell.danger.element}`);
          if (cell.fx) cls.push('fx', `el-${cell.fx.element}`, cell.fx.hit ? 'fx-hit' : '');
          const colorOf = (el: string) => (el in ELEMENTS ? ELEMENTS[el as keyof typeof ELEMENTS].color : undefined);
          const elc = cell.danger?.owner === 'player' ? colorOf(cell.danger.element) : cell.fx ? colorOf(cell.fx.element) : undefined;
          const style = cell.danger || elc ? ({ ...(cell.danger ? { '--p': cell.danger.progress } : {}), ...(elc ? { '--elc': elc } : {}) } as React.CSSProperties) : undefined;
          return (
            <div key={`${x}-${y}`} className={cls.join(' ')} style={style} title={`(${x},${y})`}>
              {cell.danger && cell.danger.progress > 0.55 && !here && (
                <span className="countdown"><span>{(cell.danger.remainMs / 1000).toFixed(1)}</span></span>
              )}
              {cell.fx && <Vfx key={cell.fx.id} element={cell.fx.element} />}
              {here && (
                // 立ち絵（盤面を傾けても、キャラだけはカメラの方を向いて立つ）
                <div className="unit-stand">
                  {sprite && !brokenSprites.has(sprite) ? (
                    <>
                      {/* 立ち絵に filter を付けると 3D の中で絵が切れるので、光や氷は別の部品を重ねて出す */}
                      <span className={`sprite-aura aura-${side} ${lead && shielded ? 'shielded' : ''} ${ward ? 'warded' : ''}`} />
                      <img
                        className={`unit-sprite unit-${side}`}
                        src={`${UNIT_BASE}${sprite}.png`}
                        alt=""
                        draggable={false}
                        onError={() => brokenSprites.add(sprite)}
                      />
                      {lead && s.isFrozen(side) && <span className="sprite-ice" />}
                    </>
                  ) : (
                    <div className={`unit unit-${side} ${lead && shielded ? 'shielded' : ''} ${ward ? 'warded' : ''} ${lead && s.isFrozen(side) ? 'frozen' : ''}`}>
                      {side === 'player' ? '◆' : '✶'}
                    </div>
                  )}
                  {/* 群れの敵は、1体ずつ頭の上に小さな HP バー */}
                  {many && unit && (
                    <span className="unit-hp" aria-label={`HP ${unit.hp}/${unit.maxHp}`}>
                      <span style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
