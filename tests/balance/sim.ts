/**
 * 戦闘バランスのシミュレーション。
 *   node --experimental-strip-types scripts/balance.mts [試行回数]
 *
 * ストーリーどおりに進んだプレイヤー（そのステージまでに手に入る SP でスキルを覚えた状態）を、
 * 「ふつう」「うまい」の2種類のボットで戦わせ、ステージごとの勝率と残りHPを出す。
 *
 * ボットは声で遊ぶ人をまねる：
 *   - 話してから認識されるまでの遅れ（ふつう 2.2秒・うまい 1.3秒）
 *   - 敵の攻撃予告に気づいて避ける確率（ふつう 65%・うまい 92%）
 *   - 聞き間違いで唱えそこねる確率（ふつう 20%・うまい 8%）
 *   - 唱える魔法（ふつう：覚えた中でいちばん強い単発の魔法／うまい：濡らし→雷などの組み合わせ・究極魔法も使う）
 */
import { GameEngine } from '../../src/game/GameEngine';
import { GRID_SIZE } from '../../src/game/constants';
import { ELEMENTS, type SpellKey } from '../../src/game/elements';
import type { BossKind } from '../../src/game/EnemyAI';
import { INITIAL_UNLOCKED, SKILLS, STAGE, STAGE_RULES, canUnlock, computeLoadout, spForWin, stageStats } from '../../src/game/skills';

type Bot = { name: string; latency: number; dodge: number; combo: boolean; ult: boolean; gap: number; miss: number };
const BOTS: Bot[] = [
  { name: 'ふつう', latency: 2400, dodge: 0.6, combo: false, ult: false, gap: 1200, miss: 0.2 },
  { name: 'うまい', latency: 1400, dodge: 0.9, combo: true, ult: true, gap: 400, miss: 0.08 },
];

/** そのステージに来るまでにもらえる SP で、スキルを安い順に覚えていく（魔法と強化を優先） */
function unlockedAt(stage: number): string[] {
  let sp = STAGE.SP_START;
  for (let s = 1; s < stage; s++) sp += spForWin(s);
  const have = new Set(INITIAL_UNLOCKED);
  const rank = (k: string) => (k === 'spell' ? 0 : k === 'passive' ? 1 : k === 'support' ? 2 : 3);
  for (;;) {
    const cand = SKILLS.filter((d) => canUnlock(d.id, have, sp).ok).sort((a, b) => a.cost - b.cost || rank(a.kind) - rank(b.kind));
    if (!cand.length) break;
    have.add(cand[0].id);
    sp -= cand[0].cost;
  }
  return [...have];
}

const dirWord: Record<string, string> = { right: 'ライト', left: 'レフト', up: 'アップ', down: 'ダウン' };
const numWord = ['', 'ワン', 'ツー', 'スリー', 'フォー', 'ファイブ', 'シックス', 'セブン', 'エイト'];

function dangerCells(e: GameEngine): Set<string> {
  const s = e.s;
  const out = new Set<string>();
  for (const a of s.attacks) if (a.owner === 'enemy') for (const c of a.cells) out.add(`${c.x},${c.y}`);
  return out;
}

/** 危ないマスから、いちばん近い安全なマスへの移動の呪文 */
function escapeChant(e: GameEngine): string | null {
  const s = e.s;
  const bad = dangerCells(e);
  const { x, y } = s.player.pos;
  if (!bad.has(`${x},${y}`)) return null;
  let best: { d: number; text: string } | null = null;
  for (const [dx, dy, w] of [[1, 0, 'right'], [-1, 0, 'left'], [0, -1, 'up'], [0, 1, 'down']] as const)
    for (let n = 1; n < GRID_SIZE; n++) {
      const nx = x + dx * n, ny = y + dy * n;
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) break;
      if (!bad.has(`${nx},${ny}`)) {
        if (!best || n < best.d) best = { d: n, text: `${dirWord[w]} ${numWord[n]}` };
        break;
      }
    }
  return best?.text ?? null;
}

function attackChant(e: GameEngine, bot: Bot, spells: Set<SpellKey>, step: number): string {
  const s = e.s;
  const has = (k: SpellKey) => spells.has(k);
  const mana = s.mana.current;
  if (bot.ult) {
    const ults = [...spells].filter((k) => ELEMENTS[k].ultimate && !ELEMENTS[k].oncePerBattle).sort((a, b) => ELEMENTS[b].damage - ELEMENTS[a].damage);
    if (ults.length && mana >= ELEMENTS[ults[0]].cost + 15) return ELEMENTS[ults[0]].name;
  }
  if (bot.combo && has('water') && has('thunder') && step % 2 === 0) return 'ウォーター アンド サンダー';
  const single = [...spells].filter((k) => !ELEMENTS[k].ultimate && !ELEMENTS[k].oncePerBattle && ELEMENTS[k].damage > 0);
  const affordable = single.filter((k) => ELEMENTS[k].cost + 10 <= mana);
  const pool = affordable.length ? affordable : single;
  pool.sort((a, b) => ELEMENTS[b].damage - ELEMENTS[a].damage);
  return ELEMENTS[pool[0] ?? 'water'].name;
}

function fight(stage: number, bot: Bot, seed: number, extra: { units?: number; boss?: BossKind } = {}) {
  const unlocked = unlockedAt(stage);
  const lo = computeLoadout(unlocked);
  const e = new GameEngine(seed, { loadout: lo, stage, ...extra });
  e.reset();
  let rnd = seed * 7919 + 1;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  const seen = new Set<number>();
  let busyUntil = 0;
  let step = 0;
  const pending: { at: number; text: string }[] = [];
  for (let t = 0; t < 240_000 && e.s.phase === 'battle'; t += 50) {
    const s = e.s;
    // 新しい攻撃予告に気づく
    for (const a of s.attacks)
      if (a.owner === 'enemy' && !seen.has(a.id)) {
        seen.add(a.id);
        if (rand() < bot.dodge) pending.push({ at: s.time + bot.latency, text: '__escape__' });
      }
    // 聞き取りが終わった呪文を唱える
    for (let i = pending.length - 1; i >= 0; i--)
      if (pending[i].at <= s.time) {
        const p = pending.splice(i, 1)[0];
        const esc = p.text === '__escape__';
        const text = esc ? escapeChant(e) : p.text;
        // 避けるときは、魔力待ちの呪文を取り消してから（画面を見ていれば分かる）
        if (esc && text) for (const x of s.spells) if (x.status === 'waiting_mana') e.cancelSpell(x.id);
        // 音声認識の聞き間違いで、うまく唱えられないことがある
        if (text && rand() >= bot.miss) e.cast(text);
      }
    // ひまなら攻撃を唱えはじめる
    const myBusy = s.spells.some((x) => ['waiting_mana', 'casting', 'interpreting', 'queued'].includes(x.status as string));
    if (!myBusy && s.time >= busyUntil && !pending.length) {
      const text = attackChant(e, bot, lo.spells, step);
      // 魔力が足りないうちは唱えない（魔力のバーを見て待つ）
      const need = text.includes('アンド') ? 70 : (Object.values(ELEMENTS).find((x) => x.name === text)?.cost ?? 30) + 10;
      if (s.mana.current < need) { e.advance(50); continue; }
      step++;
      pending.push({ at: s.time + bot.latency, text });
      busyUntil = s.time + bot.latency + bot.gap;
    }
    e.advance(50);
  }
  const s = e.s;
  return { win: s.phase === 'victory', hp: s.player.hp / s.player.maxHp, time: s.time / 1000, skills: unlocked.length };
}

export function report(N = 30) {
  if (process.env.RULES) Object.assign(STAGE_RULES, JSON.parse(process.env.RULES));
const STAGES: [number, { units?: number; boss?: BossKind }][] = [
  [1, {}], [3, {}], [5, { boss: 'cerberus' }], [6, { units: 3 }], [8, {}], [10, { boss: 'tower' }], [11, { units: 3 }], [13, {}], [15, { boss: 'moderator' }],
  [18, {}], [19, { units: 2, boss: 'chimera' }], [20, { boss: 'stationmaster' }], [23, {}], [25, { boss: 'ghost' }],
  [26, { units: 4 }], [28, { units: 3 }], [29, { units: 3 }], [30, { boss: 'aegis' }], [31, {}], [34, { units: 5 }], [35, { boss: 'oracle-final' }],
];
console.log(`ステージ\t強さ(HP/攻撃)\tスキル数\t` + BOTS.map((b) => `${b.name}:勝率\t残HP\t秒`).join('\t'));
for (const [st, extra] of STAGES) {
  const ss = stageStats(st);
  const row = [`${st}${ss.elite ? '★' : ''}${extra.boss ?? ''}${extra.units ? 'x' + extra.units : ''}`, `${ss.enemyHp}/${ss.enemyPower}`];
  let skills = 0;
  for (const bot of BOTS) {
    const rs = Array.from({ length: N }, (_, i) => fight(st, bot, 1000 + i, extra));
    skills = rs[0].skills;
    const wins = rs.filter((r) => r.win);
    row.push(`${Math.round((wins.length / N) * 100)}%`, wins.length ? `${Math.round((wins.reduce((a, r) => a + r.hp, 0) / wins.length) * 100)}%` : '-', `${Math.round(rs.reduce((a, r) => a + r.time, 0) / N)}`);
  }
  row.splice(2, 0, String(skills));
  console.log(row.join('\t'));
}
}
