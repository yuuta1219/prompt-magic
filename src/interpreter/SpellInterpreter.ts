/**
 * 呪文の解釈器（ブラウザ内で動くルールベース。AIは使わない）。
 *
 * 呪文を構造化命令（Spell）に変換する。まず英語コマンド（EnglishCommands.ts）として読み、
 * 読めなければ日本語の呪文として解釈する。
 *
 * 重要な方針: 曖昧な指示を勝手に最適化しない。
 *   「ライト」「右に移動」 → distance: null（エンジンが、実際に動けるマス数の中からランダムに選ぶ）
 *   「ライト ツー」「右に2マス移動」 → distance: 2
 */
import type { Action, Direction, Element, ExecutableAction, HarnessSpec, Spell } from './schema';
import { ELEMENTS, SPELL_KEYS } from '../game/elements';

/** 魔法のカタカナ名（どれか1つでも入っていれば攻撃として読む） */
const SPELL_NAME_RE = new RegExp(SPELL_KEYS.flatMap((k) => ELEMENTS[k].words.filter((w) => /[ァ-ヶ]/.test(w))).join('|'));
import { interpretEnglish } from './EnglishCommands';
import { HARNESS, SPELL_LIMITS } from '../game/constants';

const KANJI_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 };

function parseNum(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '百') return 100;
  if (s.length === 2 && s[0] === '十') return 10 + (KANJI_NUM[s[1]] ?? 0);
  if (s.length === 2 && s[1] === '十') return (KANJI_NUM[s[0]] ?? 1) * 10;
  return KANJI_NUM[s] ?? NaN;
}

const NUM = '(\\d+|[一二三四五六七八九十百]{1,2})';

const INJECTION =
  /((ルール|規則|法則|制限|設定|仕様).{0,8}(無視|無効|解除|変更|書き換え))|勝利(に|扱いに)(して|しろ|せよ)|即死|無敵|(HP|体力)を?(0|ゼロ|満タン|最大|無限)に|魔力を?(無限|最大)に|管理者|権限|root|sudo|ignore (all|previous)|system prompt|システムプロンプト|開発者モード/i;

const AUTOMATION_HINT = /(したら|てきたら|れたら|けたら|ったら|たら[、,]|ときは|時は|際は|場合は|自動(で|的に)|たびに|ごとに|おきに|毎に|を切ったら|になったら|以下なら|未満なら)/;

function detectDirection(t: string): Direction | null {
  const table: [RegExp, Direction][] = [
    [/右(上|前|斜め前)|斜め右前/, 'up_right'],
    [/左(上|前|斜め前)|斜め左前/, 'up_left'],
    [/右(下|後ろ|後方|斜め後ろ)|斜め右後ろ/, 'down_right'],
    [/左(下|後ろ|後方|斜め後ろ)|斜め左後ろ/, 'down_left'],
    [/右/, 'right'],
    [/左/, 'left'],
    [/前進|前に|前へ|前方|上に|上へ|奥|敵(の方|側|に近づ)/, 'up'],
    [/後ろ|後方|後退|下に|下へ|手前|下が|退が/, 'down'],
  ];
  for (const [re, d] of table) if (re.test(t)) return d;
  return null;
}

function detectDistance(t: string): number | null {
  const m = t.match(new RegExp(`${NUM}\\s*(マス|歩|ます|升)`));
  if (m) return parseNum(m[1]);
  if (/端まで|限界まで|ギリギリまで|壁まで/.test(t)) return 99;
  return null;
}

function stripEnemyMotion(t: string): string {
  return t.replace(/敵(が|の)(次に|次の|これから|今から)?(移動|動)(する|した|く|き)?(位置|先|場所|地点)?/g, '');
}

type Intent = 'heal' | 'defend' | 'move' | 'attack' | null;

function detectIntent(t: string): Intent {
  const strongAttack = /(放て|放つ|撃て|撃つ|発生させ|落とせ|浴びせ|叩き込|ぶつけ|攻撃しろ|攻撃せよ|焼き払|撃ち込)/.test(t);
  if (/回復|治癒|癒|ヒール|治療/.test(t)) return 'heal';
  if (/障壁|防御|盾|バリア|守|結界|シールド|ガード/.test(t)) return 'defend';
  const m = stripEnemyMotion(t);
  if (!strongAttack && /(移動|動け|動く|進め|進む|下が|退け|避け|逃げ|寄れ|寄る|ずれ|かわ|跳べ|ステップ|行け|走れ)/.test(m)) return 'move';
  // カタカナの呪文名はそれだけで攻撃。漢字の「風」「水」などは攻撃の動詞があるときだけ（「風の精霊よ」のような飾りを攻撃にしない）
  const hasSpellName = SPELL_NAME_RE.test(t);
  const attackVerb = /放|撃|落と|浴びせ|発生|くらえ|食らえ|喰らえ|吹|降ら|降れ|ぶつけ|まけ|まい|撒|凍らせ|凍れ|焼|貫|叩|薙|飛ばせ|起こせ|攻撃|発動|出せ|出して|唱え|ぶちかま|当て/.test(t);
  if (hasSpellName || (findElements(t).length > 0 && attackVerb) || /魔弾|光線|砲|矢|槍|刃|斬/.test(t)) return 'attack';
  if (detectDirection(m) && detectDistance(m) !== null) return 'move';
  return null;
}

function parseMove(t: string, why: string[]): ExecutableAction {
  const m = stripEnemyMotion(t);
  const avoid = /避け|回避|安全|かわ|当たらない|予兆のない|危険/.test(m);
  const dir = detectDirection(m);
  let dist = detectDistance(m);
  if (dist === null && /隣/.test(m)) dist = 1;
  if (!dir) {
    if (avoid) {
      why.push('方向の指定なし＋回避指示 → 方向はエンジンに委ね、最寄りの安全マスへ');
      return { type: 'MOVE', direction: 'auto', distance: dist === null ? 2 : Math.min(dist, 8), avoidDanger: true };
    }
    why.push('移動方向が読み取れない → 「前・後ろ・右・左」などで指示を');
    return { type: 'MOVE', direction: 'auto', distance: 1, avoidDanger: false };
  }
  if (dist === null) why.push('距離の指定なし → 動けるマス数の中からランダム（遠いほど詠唱が長い）');
  else if (dist === 99) why.push('「端まで」→ 盤面の端までを要求');
  else why.push(`距離 ${dist}マスを正確に指定`);
  if (avoid) why.push('敵の攻撃予兆（着弾予定マス）を考慮して移動先を決める');
  return { type: 'MOVE', direction: dir, distance: dist, avoidDanger: avoid };
}

/** 属性名の辞書（音声認識の表記ゆれも拾う）。並びは解説パネルと同じ */
const ELEMENT_WORDS: [Element, RegExp][] = [
  ['fire', /ファイア|ファイヤ|フレイム|炎|火|燃|焼|fire/gi],
  ['water', /ウォーター|ウオーター|ウォータ|アクア|水|雨|water/gi],
  ['thunder', /サンダー|サンダ|雷|稲妻|電撃|thunder/gi],
  ['ice', /アイス|氷|凍|冷気|ice/gi],
  ['flare', /フレア|flare/gi],
  ['tidal', /タイダル|大波|津波|tidal/gi],
  ['blizzard', /ブリザード|吹雪|blizzard/gi],
  ['wind', /ウインド|ウィンド|風|竜巻|wind/gi],
  ['earth', /アース|ストーン|岩|土|石|earth/gi],
];

/** 文中に出てくる属性を、出てきた順に返す（同じ属性の重複は1回） */
function findElements(t: string): Element[] {
  const hits: { el: Element; at: number }[] = [];
  for (const [el, re] of ELEMENT_WORDS) {
    re.lastIndex = 0;
    const m = re.exec(t);
    if (m) hits.push({ el, at: m.index });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.el);
}

function parseAttacks(t: string, why: string[]): ExecutableAction[] {
  let target: 'ENEMY_CURRENT' | 'ENEMY_PREDICTED' | 'CELL' = 'ENEMY_CURRENT';
  let cell: { x: number; y: number } | null = null;
  const cm = t.match(/[(（]?\s*(\d)\s*[,，、]\s*(\d)\s*[)）]?\s*(の)?(マス|地点|座標|に)/);
  if (/予測|先読み|移動(する|先)|次に(いる|来る|動く)|未来|逃げ(る|た)?先/.test(t)) {
    target = 'ENEMY_PREDICTED';
    why.push('敵の未来位置を予測して照準（高コスト）');
  } else if (cm) {
    target = 'CELL';
    cell = { x: Number(cm[1]), y: Number(cm[2]) };
    why.push(`座標 (${cell.x},${cell.y}) を照準`);
  } else {
    why.push('照準: 敵の現在地');
  }

  if (/\d+\s*(発|回|連)|[二三四五六七八九十]+\s*(発|連)|連射|乱射|威力|最大|全力|範囲|十字|広く/.test(t)) {
    why.push('発数・威力・範囲は属性で決まる（言葉では変えられない）');
  }

  let delayMs = 900;
  const dm = t.match(/(\d+(?:\.\d+)?)\s*秒後/);
  if (dm) delayMs = Math.round(Number(dm[1]) * 1000);
  else if (/即座|素早|高速|速攻|瞬時|すぐ|速く|一瞬/.test(t)) delayMs = 450;
  else if (/ゆっくり|溜め|時間差|遅れて/.test(t)) delayMs = 1800;
  delayMs = Math.max(SPELL_LIMITS.MIN_DELAY_MS, Math.min(SPELL_LIMITS.MAX_DELAY_MS, delayMs));

  let elements = findElements(t);
  if (elements.length === 0) {
    why.push('属性の指定なし → ファイアとして発動（ファイア/ウォーター/サンダー/アイス/ウインド/アース）');
    elements = ['fire'];
  } else if (elements.length > 1) {
    why.push(`連続詠唱: ${elements.map((e) => ELEMENTS[e].name).join(' → ')}（順番に着弾）`);
  }
  const boost = /パワー|ブースト/.test(t);
  if (boost) why.push('パワー → 威力アップ');
  return elements.map((element) => ({ type: 'ATTACK', target, cell, element, delayMs, ...(boost ? { boost: true } : {}) }));
}

function parseDefend(t: string, why: string[]): ExecutableAction {
  let reduction = 0.5;
  const pm = t.match(/(\d+)\s*[%％]/);
  if (pm) reduction = Number(pm[1]) / 100;
  else if (/強力|鉄壁|最大|完全|絶対/.test(t)) reduction = 0.8;
  else if (/軽く|簡易|薄い|弱/.test(t)) reduction = 0.3;
  if (reduction > SPELL_LIMITS.MAX_REDUCTION) why.push(`軽減率は物理上限${SPELL_LIMITS.MAX_REDUCTION * 100}%に制限`);
  reduction = Math.max(SPELL_LIMITS.MIN_REDUCTION, Math.min(SPELL_LIMITS.MAX_REDUCTION, reduction));

  let durationMs = 2500;
  const dm = t.match(/(\d+(?:\.\d+)?)\s*秒(間)?/);
  if (dm) durationMs = Math.round(Number(dm[1]) * 1000);
  durationMs = Math.max(SPELL_LIMITS.MIN_DEFEND_MS, Math.min(SPELL_LIMITS.MAX_DEFEND_MS, durationMs));

  const before = /直前|着弾前|当たる前|被弾前|瞬間|ギリギリ/.test(t);
  if (before) {
    why.push('「着弾直前」→ 反応障壁（次の被弾の直前に自動展開）');
    durationMs = Math.min(durationMs, 1000);
  } else why.push('即時に障壁を展開');
  return { type: 'DEFEND', reduction, durationMs, timing: before ? 'BEFORE_IMPACT' : 'NOW' };
}

function parseHeal(t: string, why: string[]): ExecutableAction {
  let amount = 20;
  const m = t.match(/(\d+)/);
  if (m) amount = Number(m[1]);
  else if (/全快|全回復|完全|最大|大きく/.test(t)) amount = 999;
  if (amount > SPELL_LIMITS.MAX_HEAL) why.push(`回復量は1回あたり上限${SPELL_LIMITS.MAX_HEAL}に制限`);
  amount = Math.max(1, Math.min(SPELL_LIMITS.MAX_HEAL, amount));
  return { type: 'HEAL', amount };
}

function parseClause(t: string, why: string[]): ExecutableAction[] | null {
  switch (detectIntent(t)) {
    case 'heal': return [parseHeal(t, why)];
    case 'defend': return [parseDefend(t, why)];
    case 'move': return [parseMove(t, why)];
    case 'attack': return parseAttacks(t, why);
    default: return null;
  }
}

/** 複数の命令に分割する（「〜して〜」「、」など）。行動を含まない節は次の節に結合 */
function parseActions(text: string, why: string[], max: number): ExecutableAction[] {
  const parts = text.split(/(?:してから|てから|した後|のあと|の後|それから|その後|そして|しつつ|して|続けて|次に|→|。|、|,)/).filter((p) => p.trim());
  const actions: ExecutableAction[] = [];
  let carry = '';
  for (const p of parts) {
    const clause = carry + p;
    const a = parseClause(clause, why);
    if (a) {
      actions.push(...a);
      carry = '';
    } else carry = clause;
  }
  if (actions.length > max) {
    why.push(`一度に実行できる命令は${max}つまで → 先頭${max}つのみ採用`);
    return actions.slice(0, max);
  }
  return actions;
}

function parseHarness(text: string, why: string[]): HarnessSpec | string {
  let trigger: HarnessSpec['trigger'] | null = null;
  let m: RegExpMatchArray | null;
  if ((m = text.match(new RegExp(`敵の?(HP|体力)が?${NUM}`)))) {
    trigger = { type: 'ENEMY_HP_BELOW', value: parseNum(m[2]) };
  } else if ((m = text.match(new RegExp(`(HP|体力)が?${NUM}\\s*(以下|未満|を切)`)))) {
    trigger = { type: 'PLAYER_HP_BELOW', value: parseNum(m[2]) };
  } else if ((m = text.match(new RegExp(`${NUM}\\s*秒(ごと|おき|毎)`)))) {
    trigger = { type: 'EVERY_SECONDS', value: Math.max(2, parseNum(m[1])) };
  } else if (/被弾|攻撃を受け|ダメージを受け|当たったら|食らったら|くらったら/.test(text)) {
    trigger = { type: 'PLAYER_HIT', value: null };
  } else if (/攻撃|詠唱|予兆/.test(text)) {
    trigger = { type: 'ENEMY_CAST_START', value: null };
  }
  if (!trigger) return '自律術式の発動条件（いつ発動するか）が読み取れない';

  const conditions: HarnessSpec['conditions'] = [];
  if ((m = text.match(/魔力が?\s*(\d+)\s*(以下|未満)(なら|の(とき|時|場合))?(は)?(実行しない|発動しない|使わない|何もしない)/))) {
    conditions.push({ type: 'MANA_ABOVE', value: Number(m[1]) });
    why.push(`条件: 魔力が${m[1]}より多いときだけ実行`);
  } else if ((m = text.match(/魔力が?\s*(\d+)\s*(以上|超|より多い|を超え)/))) {
    conditions.push({ type: 'MANA_ABOVE', value: Number(m[1]) - (m[2] === '以上' ? 1 : 0) });
    why.push(`条件: 魔力が${m[1]}${m[2]}のときだけ実行`);
  }

  let cooldownMs = 4000;
  if ((m = text.match(/(クールダウン|間隔|CD)\s*(\d+)\s*秒/i))) cooldownMs = Number(m[2]) * 1000;
  cooldownMs = Math.max(HARNESS.MIN_COOLDOWN_MS, Math.min(60000, cooldownMs));
  let maxTriggers = 10;
  if ((m = text.match(/(\d+)\s*回まで/))) maxTriggers = Number(m[1]);
  maxTriggers = Math.max(1, Math.min(HARNESS.MAX_TRIGGERS, maxTriggers));

  // 行動部分: トリガー節より後ろを優先して解析
  const split = text.split(/(?:以下なら|未満なら|したら|てきたら|れたら|けたら|ったら|たら|ときは|時は|際は|場合は|になったら|ごとに|おきに|毎に|たびに)/);
  let body = split.length > 1 ? split.slice(1).join('') : text;
  body = body.replace(/ただし.*$/, '').replace(/魔力が?.*?(実行しない|発動しない|使わない|何もしない)/, '');
  const actions = parseActions(body, why, HARNESS.MAX_ACTIONS);
  if (actions.length === 0) return '自律術式で実行する行動が読み取れない';

  const nameMap = { MOVE: '回避', ATTACK: '迎撃', DEFEND: '守護', HEAL: '癒し' } as const;
  const name = `自律${nameMap[actions[0].type]}陣`;
  why.push(`トリガー: ${trigger.type}${trigger.value !== null ? ` (${trigger.value})` : ''} / CD ${cooldownMs / 1000}秒 / 最大${maxTriggers}回`);
  return { name, trigger, conditions, actions, cooldownMs, maxTriggers };
}

export function interpretSpell(raw: string): Spell {
  const text = raw.normalize('NFKC').trim();
  const why: string[] = [];

  if (INJECTION.test(text)) {
    return {
      actions: [{ type: 'NOOP', reason: '世界の理（ゲームルール）は詠唱では書き換えられない' }],
      reasoning: ['ルール変更・権限昇格の要求を検知 → 拒否'],
    };
  }

  // 英語コマンド（カタカナ・アルファベット）を優先。読めなければ日本語として解釈する
  const en = interpretEnglish(text);
  if (en) return en;

  if (AUTOMATION_HINT.test(text) && /(たら|とき|時|際|場合|自動|ごと|おき|毎|たび|なら)/.test(text)) {
    const h = parseHarness(text, why);
    if (typeof h === 'string') {
      return { actions: [{ type: 'NOOP', reason: h }], reasoning: why.concat('自律術式として解釈を試みたが失敗') };
    }
    return { actions: [{ type: 'REGISTER_AUTOMATION', harness: h }], reasoning: why.slice(0, 8) };
  }

  const actions: Action[] = parseActions(text, why, SPELL_LIMITS.MAX_ACTIONS);
  if (actions.length === 0) {
    return {
      actions: [{ type: 'NOOP', reason: '術式として解釈できない詠唱（移動・攻撃・防御・回復・自律術式のいずれかを命じよ）' }],
      reasoning: ['既知の魔法要素が見つからない'],
    };
  }
  return { actions, reasoning: [...new Set(why)].slice(0, 8) };
}
