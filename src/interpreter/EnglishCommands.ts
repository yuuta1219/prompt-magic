/**
 * 英語コマンドの解釈（カタカナでもアルファベットでもよい）。
 *
 * 例: 「ライト ツー」「right 2」「ウォーターからのサンダー」「カウンター ガード」「オン アタック ガード」
 *
 * 音声入力は日本語モードで聞き取るので、英語の呪文はカタカナで届くことが多い。
 * スペースなしで続けて届く（「ライトツー」）こともあるので、辞書の最長一致で区切る。
 * 辞書に無い言葉が多いときは null を返し、日本語の解釈器に任せる。
 *
 * 曖昧さの方針は日本語と同じ: 「ライト」だけなら距離は null（エンジンが、実際に動けるマス数の中からランダムに選ぶ）。
 */
import type { Direction, Element, ExecutableAction, HarnessSpec, Spell } from './schema';
import { HARNESS, SPELL_LIMITS } from '../game/constants';
import { ELEMENTS, SPELL_KEYS } from '../game/elements';

type Tok =
  | { k: 'dir'; v: 'up' | 'down' | 'left' | 'right' }
  | { k: 'num'; v: number }
  | { k: 'max' }
  | { k: 'move' }
  | { k: 'el'; v: Element }
  | { k: 'attack' }
  | { k: 'predict' }
  | { k: 'quick' }
  | { k: 'boost' }
  | { k: 'slow' }
  | { k: 'guard' }
  | { k: 'counter' }
  | { k: 'heal' }
  | { k: 'and' }
  | { k: 'on' }
  | { k: 'every' }
  | { k: 'hit' };

/** [カタカナ・英単語, トークン]。英単語は小文字 */
const DICT: [string[], Tok][] = [
  [['アップ', 'フォワード', 'フロント', 'up', 'forward', 'front'], { k: 'dir', v: 'up' }],
  [['ダウン', 'バック', 'down', 'back'], { k: 'dir', v: 'down' }],
  [['レフト', 'left'], { k: 'dir', v: 'left' }],
  [['ライト', 'right'], { k: 'dir', v: 'right' }],
  [['ワン', 'one'], { k: 'num', v: 1 }],
  [['ツー', 'トゥー', 'トゥ', 'two'], { k: 'num', v: 2 }],
  [['スリー', 'three'], { k: 'num', v: 3 }],
  [['フォー', 'フォア', 'four'], { k: 'num', v: 4 }],
  [['ファイブ', 'ファイヴ', 'five'], { k: 'num', v: 5 }],
  [['シックス', 'six'], { k: 'num', v: 6 }],
  [['セブン', 'セヴン', 'seven'], { k: 'num', v: 7 }],
  [['エイト', 'eight'], { k: 'num', v: 8 }],
  [['ナイン', 'nine'], { k: 'num', v: 9 }],
  [['テン', 'ten'], { k: 'num', v: 10 }],
  [['マックス', 'エッジ', 'max', 'edge'], { k: 'max' }],
  [['ムーブ', 'ムーヴ', 'ステップ', 'ゴー', 'move', 'step', 'go'], { k: 'move' }],
  // 魔法の名前は elements.ts の words から自動で入る（下の SPELL_DICT）
  [['アタック', 'attack'], { k: 'attack' }],
  [['プレディクト', 'プレディクション', 'predict'], { k: 'predict' }],
  [['クイック', 'ファスト', 'quick', 'fast'], { k: 'quick' }],
  [['パワー', 'ブースト', 'power', 'boost'], { k: 'boost' }],
  [['スロー', 'slow'], { k: 'slow' }],
  [['ガード', 'シールド', 'バリア', 'プロテクト', 'guard', 'shield', 'barrier', 'protect'], { k: 'guard' }],
  [['カウンター', 'リアクト', 'counter', 'react'], { k: 'counter' }],
  [['ヒール', 'キュア', 'ケア', 'heal', 'cure'], { k: 'heal' }],
  [['アンド', 'ゼン', 'ネクスト', 'and', 'then', 'next', 'からの', 'から'], { k: 'and' }],
  [['オン', 'ウェン', 'ホエン', 'on', 'when'], { k: 'on' }],
  [['エブリ', 'エヴリ', 'every'], { k: 'every' }],
  [['ヒット', 'ダメージ', 'hit', 'damage'], { k: 'hit' }],
];

const ALL_DICT: [string[], Tok][] = [...DICT, ...SPELL_KEYS.map((k) => [ELEMENTS[k].words.map((w) => w.toLowerCase()), { k: 'el', v: k }] as [string[], Tok])];

const KATA_ENTRIES: [string, Tok][] = ALL_DICT.flatMap(([words, tok]) =>
  words.filter((w) => !/^[a-z]+$/.test(w)).map((w) => [w, tok] as [string, Tok]),
).sort((a, b) => b[0].length - a[0].length);
const WORD_MAP = new Map<string, Tok>(ALL_DICT.flatMap(([words, tok]) => words.filter((w) => /^[a-z]+$/.test(w)).map((w) => [w, tok] as [string, Tok])));

/** 無視してよい文字（区切り・助詞・単位） */
const IGNORABLE = /[\s、。,.!?・のにをへでとはがもてっマス秒]/;

/** 英語コマンドとして読めるならトークン列、日本語が多すぎるなら null */
export function tokenizeEnglish(raw: string): Tok[] | null {
  // 「アポカリプス・メメント・モリ」「ライト ツー」のように、カタカナの間のスペースや「・」は詰めて読む
  const t = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([\u30A0-\u30FF])[\s・]+(?=[\u30A0-\u30FF])/g, '$1');
  const toks: Tok[] = [];
  let noise = 0;
  let i = 0;
  outer: while (i < t.length) {
    const ch = t[i];
    if (/[0-9]/.test(ch)) {
      const m = t.slice(i).match(/^[0-9]+/)!;
      toks.push({ k: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      const w = t.slice(i).match(/^[a-z]+/)![0];
      const tok = WORD_MAP.get(w);
      if (tok) toks.push(tok);
      else noise += w.length;
      i += w.length;
      continue;
    }
    for (const [w, tok] of KATA_ENTRIES) {
      if (t.startsWith(w, i)) {
        toks.push(tok);
        i += w.length;
        continue outer;
      }
    }
    if (!IGNORABLE.test(ch)) noise++;
    i++;
  }
  const meaningful = toks.filter((x) => x.k !== 'num' && x.k !== 'and').length;
  if (meaningful === 0 || noise > 2) return null;
  return toks;
}

function splitSegments(toks: Tok[]): Tok[][] {
  const segs: Tok[][] = [[]];
  for (const x of toks) {
    if (x.k === 'and') segs.push([]);
    else segs[segs.length - 1].push(x);
  }
  return segs.filter((s) => s.length > 0);
}

const DIR_NAME = { up: 'アップ（前）', down: 'ダウン（後ろ）', left: 'レフト', right: 'ライト' } as const;

function parseSegment(seg: Tok[], why: string[]): ExecutableAction[] {
  const has = (k: Tok['k']) => seg.some((x) => x.k === k);
  const num = (seg.find((x) => x.k === 'num') as { v: number } | undefined)?.v ?? null;
  const dirs = seg.filter((x): x is Extract<Tok, { k: 'dir' }> => x.k === 'dir').map((x) => x.v);
  const out: { at: number; a: ExecutableAction }[] = [];
  const firstAt = (k: Tok['k']) => seg.findIndex((x) => x.k === k);

  // ---- 移動
  if (dirs.length > 0 || has('move')) {
    const vert = dirs.find((d) => d === 'up' || d === 'down');
    const hori = dirs.find((d) => d === 'left' || d === 'right');
    const dist: number | null = has('max') ? 99 : num;
    const at = Math.min(...(['dir', 'move'] as const).map(firstAt).filter((n) => n >= 0));
    if (!vert && !hori) {
      why.push('移動の方向が無い → ライト / レフト / アップ / ダウン で指示を');
      out.push({ at, a: { type: 'MOVE', direction: 'auto', distance: 1, avoidDanger: false } });
    } else {
      const direction = (vert && hori ? `${vert}_${hori}` : (vert ?? hori)) as Direction;
      const label = [vert, hori].filter(Boolean).map((d) => DIR_NAME[d!]).join('＋');
      if (dist === null) why.push(`${label}: 距離の指定なし → 動けるマス数の中からランダム（遠いほど詠唱が長い）`);
      else if (dist === 99) why.push(`${label}: マックス → 盤面の端まで`);
      else why.push(`${label}: ${dist}マスを指定`);
      out.push({ at, a: { type: 'MOVE', direction, distance: dist, avoidDanger: false } });
    }
  }

  // ---- 攻撃（属性ごとに1つ。出てきた順）
  const els = seg.filter((x): x is Extract<Tok, { k: 'el' }> => x.k === 'el');
  const seen = new Set<Element>();
  const attackEls: { at: number; el: Element }[] = [];
  seg.forEach((x, i) => {
    if (x.k === 'el' && !seen.has(x.v)) {
      seen.add(x.v);
      attackEls.push({ at: i, el: x.v });
    }
  });
  if (attackEls.length === 0 && has('attack')) {
    why.push('属性の指定なし → ファイア');
    attackEls.push({ at: firstAt('attack'), el: 'fire' });
  }
  if (attackEls.length > 0) {
    const target = has('predict') ? 'ENEMY_PREDICTED' : 'ENEMY_CURRENT';
    const delayMs = has('quick') ? 450 : has('slow') ? 1800 : 900;
    if (target === 'ENEMY_PREDICTED') why.push('プレディクト → 敵の逃げる先を予測（高コスト）');
    if (delayMs !== 900) why.push(delayMs < 900 ? 'クイック → 速く着弾' : 'スロー → 遅れて着弾');
    const boost = has('boost');
    if (boost) why.push(`パワー → ${attackEls.map((x) => ELEMENTS[x.el].name).join('・')}の威力アップ`);
    if (els.length > attackEls.length || (num !== null && dirs.length === 0 && !has('heal'))) {
      why.push('発数・威力・範囲は属性で決まる（言葉では変えられない）');
    }
    for (const { at, el } of attackEls) out.push({ at, a: { type: 'ATTACK', target, cell: null, element: el, delayMs, ...(boost ? { boost: true } : {}) } });
  }

  // ---- 防御
  if (has('guard') || has('counter')) {
    const before = has('counter');
    why.push(before ? 'カウンター ガード → 次の被弾の直前に自動で障壁' : 'ガード → すぐに障壁を展開');
    out.push({
      at: Math.min(...(['guard', 'counter'] as const).map(firstAt).filter((n) => n >= 0)),
      a: { type: 'DEFEND', reduction: 0.5, durationMs: before ? 1000 : 2500, timing: before ? 'BEFORE_IMPACT' : 'NOW' },
    });
  }

  // ---- 回復
  if (has('heal')) {
    let amount = dirs.length === 0 && num !== null ? num : 20;
    if (amount > SPELL_LIMITS.MAX_HEAL) why.push(`回復量は1回あたり上限${SPELL_LIMITS.MAX_HEAL}に制限`);
    amount = Math.max(1, Math.min(SPELL_LIMITS.MAX_HEAL, amount));
    out.push({ at: firstAt('heal'), a: { type: 'HEAL', amount } });
  }

  return out.sort((a, b) => a.at - b.at).map((x) => x.a);
}

function parseActions(toks: Tok[], why: string[], max: number): ExecutableAction[] {
  const actions = splitSegments(toks).flatMap((seg) => parseSegment(seg, why));
  if (actions.length > max) {
    why.push(`一度に実行できる命令は${max}つまで → 先頭${max}つのみ採用`);
    return actions.slice(0, max);
  }
  return actions;
}

/** 「オン アタック …」「オン ヒット …」「エブリ ファイブ …」→ 自律術式 */
function parseHarness(toks: Tok[], why: string[]): HarnessSpec | string | null {
  let trigger: HarnessSpec['trigger'] | null = null;
  let rest: Tok[] = toks;
  if (toks[0]?.k === 'on' && toks[1]?.k === 'attack') {
    trigger = { type: 'ENEMY_CAST_START', value: null };
    rest = toks.slice(2);
  } else if (toks[0]?.k === 'on' && toks[1]?.k === 'hit') {
    trigger = { type: 'PLAYER_HIT', value: null };
    rest = toks.slice(2);
  } else if (toks[0]?.k === 'every' && toks[1]?.k === 'num') {
    trigger = { type: 'EVERY_SECONDS', value: Math.max(2, toks[1].v) };
    rest = toks.slice(2);
  } else if (toks[0]?.k === 'on' || toks[0]?.k === 'every') {
    return '自律術式のきっかけが読み取れない（オン アタック / オン ヒット / エブリ ＋秒数）';
  } else return null;

  const actions = parseActions(rest, why, HARNESS.MAX_ACTIONS);
  if (actions.length === 0) return '自律術式で実行する行動が読み取れない';
  const label = { ENEMY_CAST_START: 'オン アタック（敵が攻撃を詠唱したら）', PLAYER_HIT: 'オン ヒット（被弾したら）', EVERY_SECONDS: `エブリ ${trigger.value}（${trigger.value}秒ごと）` }[
    trigger.type as 'ENEMY_CAST_START' | 'PLAYER_HIT' | 'EVERY_SECONDS'
  ];
  why.push(`自律術式: ${label} / クールダウン4秒 / 最大10回`);
  const names = { MOVE: 'Dodge', ATTACK: 'Strike', DEFEND: 'Guard', HEAL: 'Heal' } as const;
  return { name: `Auto ${names[actions[0].type]}`, trigger, conditions: [], actions, cooldownMs: 4000, maxTriggers: 10 };
}

/** 英語コマンドとして解釈できなければ null（日本語の解釈器に回す） */
export function interpretEnglish(raw: string): Spell | null {
  const toks = tokenizeEnglish(raw);
  if (!toks) return null;
  const why: string[] = [];
  const h = parseHarness(toks, why);
  if (typeof h === 'string') return { actions: [{ type: 'NOOP', reason: h }], reasoning: why };
  if (h) return { actions: [{ type: 'REGISTER_AUTOMATION', harness: h }], reasoning: why.slice(0, 8) };
  const actions = parseActions(toks, why, SPELL_LIMITS.MAX_ACTIONS);
  if (actions.length === 0) return null;
  const attacks = actions.filter((a) => a.type === 'ATTACK');
  if (attacks.length > 1) why.push(`連続詠唱: ${attacks.map((a) => a.type === 'ATTACK' && ELEMENTS[a.element].name).join(' → ')}（順番に着弾）`);
  return { actions, reasoning: [...new Set(why)].slice(0, 8) };
}
