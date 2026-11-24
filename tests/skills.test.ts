import { GameEngine } from '../src/game/GameEngine';
import { SKILLS, SKILL_BY_ID, TOTAL_SP, canUnlock, computeLoadout, stageStats, INITIAL_UNLOCKED, BASE_ALL_LOADOUT } from '../src/game/skills';
import { ELEMENTS, SPELL_KEYS } from '../src/game/elements';
import { interpretSpell } from '../src/interpreter/SpellInterpreter';
import { castNow } from './helpers';

function engineWith(unlocked: string[], stage = 1) {
  const e = new GameEngine(42, { loadout: computeLoadout(unlocked), stage });
  e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
  e.enemyAI.onIncoming = () => {};
  return e;
}

describe('スキルツリー - 定義', () => {
  it('中心はウォーターで、ほかのスキルはすべて中心までつながっている', () => {
    expect(SKILL_BY_ID.get('water')!.pos).toEqual({ x: 8, y: 8 });
    const reach = new Set(['water']);
    const onMap = SKILLS.filter((s) => !s.special);
    for (let i = 0; i < onMap.length; i++)
      for (const s of onMap) if (s.requiresAll ? s.requires.every((r) => reach.has(r)) : s.requires.some((r) => reach.has(r))) reach.add(s.id);
    expect(reach.size).toBe(onMap.length);
  });
  it('マス目の位置がかぶらない', () => {
    const keys = SKILLS.filter((s) => !s.special).map((s) => `${s.pos.x},${s.pos.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('スキルは104個。全部解放するのに308 SP', () => {
    expect(SKILLS).toHaveLength(104);
    expect(TOTAL_SP).toBe(308);
  });
  it('魔法はすべてツリーのどこかで覚えられる', () => {
    for (const k of SPELL_KEYS) expect(SKILL_BY_ID.get(k)?.kind, k).toBe('spell');
  });
  it('フィアト・ノクス（特別枠）は、ほかを全部解放したときだけ解放できる', () => {
    const others = SKILLS.filter((s) => !s.special).map((s) => s.id);
    const almost = new Set(others.slice(0, -1));
    expect(canUnlock('fiat_nox', almost, 999)).toMatchObject({ ok: false, reason: expect.stringMatching(/残り1個/) });
    expect(canUnlock('fiat_nox', new Set(others), 999).ok).toBe(true);
    expect(SKILLS.filter((s) => s.special).map((s) => s.id)).toEqual(['veni_vidi_vici', 'deus_ex_machina', 'fiat_nox']);
  });
  it('デウス・エクス・マキナ（特別枠）は、スキルを50個覚えると解放できる', () => {
    const others = SKILLS.filter((s) => !s.special).map((s) => s.id);
    expect(canUnlock('deus_ex_machina', new Set(others.slice(0, 49)), 99)).toMatchObject({ ok: false, reason: expect.stringMatching(/あと1個/) });
    expect(canUnlock('deus_ex_machina', new Set(others.slice(0, 50)), 99).ok).toBe(true);
  });
  it('合体魔法は両方の枝を覚えないと解放できない', () => {
    const u = new Set(['water', 'fire', 'fire_up', 'flare']);
    expect(canUnlock('steam', u, 99)).toMatchObject({ ok: false, reason: expect.stringMatching(/タイダル/) });
    u.add('wide_water'); u.add('long_wet'); u.add('tidal');
    expect(canUnlock('steam', u, 99).ok).toBe(true);
  });
  it('解放の条件: つながり・SP・二重解放', () => {
    const u = new Set(INITIAL_UNLOCKED);
    expect(canUnlock('fire', u, 1).ok).toBe(true);
    expect(canUnlock('flare', u, 99)).toMatchObject({ ok: false });
    expect(canUnlock('tidal', u, 99)).toMatchObject({ ok: false });
    expect(canUnlock('wide_water', u, 1)).toMatchObject({ ok: false, reason: expect.stringMatching(/SP/) });
    expect(canUnlock('water', u, 9)).toMatchObject({ ok: false, reason: '習得済み' });
  });
});

describe('スキルツリー - 戦闘への反映', () => {
  it('最初は移動とウォーターだけ。覚えていない魔法は不発（魔力も減らない）', () => {
    const e = engineWith(INITIAL_UNLOCKED);
    castNow(e, 'ライト ツー');
    expect(e.s.player.pos.x).toBe(6);
    const mana = e.s.mana.current;
    castNow(e, 'ファイア');
    expect(e.s.spells.at(-1)!.status).toBe('failed');
    expect(e.s.spells.at(-1)!.error).toMatch(/まだ覚えていない: ファイア/);
    expect(e.s.mana.current).toBeGreaterThanOrEqual(mana);
    for (const t of ['ガード', 'ヒール', 'プレディクト ウォーター', 'クイック ウォーター', 'オン アタック ウォーター']) {
      castNow(e, t);
      expect(e.s.spells.at(-1)!.status, t).toBe('failed');
    }
    castNow(e, 'ウォーター');
    expect(e.s.spells.at(-1)!.status).toBe('done');
  });

  it('ワイドウォーターで範囲が5×5になる', () => {
    const e = engineWith(['water', 'wide_water']);
    castNow(e, 'ウォーター');
    expect(e.s.attacks.find((a) => a.owner === 'player')!.cells).toHaveLength(25);
  });

  it('ファイア強化・ボルトプラス・ディープフリーズ・ロングウェット', () => {
    const lo = computeLoadout(['water', 'fire', 'fire_up', 'thunder', 'bolt_plus', 'shock_up', 'ice', 'deep_freeze', 'wide_water', 'long_wet']);
    expect(lo.fireDamage).toBe(40);
    expect(lo.thunderBolts).toBe(6);
    expect(lo.thunderWetMult).toBe(3);
    expect(lo.freezeMs).toBe(3500);
    expect(lo.wetMs).toBe(10_000);
    const e = engineWith([...lo.spells, 'fire_up', 'bolt_plus']);
    castNow(e, 'サンダー');
    expect(e.s.attacks.find((a) => a.owner === 'player')!.cells).toHaveLength(6);
  });

  it('上位魔法: タイダルは横3列を濡らし、フレアとブリザードは3×3', () => {
    const e = engineWith(['water', 'tidal', 'flare', 'blizzard']);
    e.s.enemy.pos = { x: 4, y: 4 };
    castNow(e, 'タイダル');
    const tidal = e.s.attacks.find((a) => a.element === 'tidal')!;
    expect(tidal.cells).toHaveLength(27);
    e.advance(1500);
    expect(e.s.wet.length).toBe(27);
    castNow(e, 'フレア');
    expect(e.s.attacks.find((a) => a.element === 'flare')!.cells).toHaveLength(9);
    e.advance(1500);
    castNow(e, 'ブリザード');
    e.advance(1500);
    expect(e.s.isFrozen('enemy')).toBe(true);
  });

  it('マナ上限アップ・マナ回復アップ', () => {
    const e = engineWith(['water', 'guard', 'heal', 'mana_max', 'predict', 'quick', 'mana_regen']);
    expect(e.s.mana.max).toBe(380);
    expect(e.s.mana.regenPerSec).toBe(11);
  });

  it('ステージが上がると敵が少しずつ強くなり、5の倍数は強敵', () => {
    expect(stageStats(1)).toEqual({ enemyHp: 80, enemyPower: 0.9, thinkMs: 3200, elite: false, tier: 0 }); // 1-1 だけ HP 80
    // 1ステージごとに HP+8%・攻撃+0.012・行動の間隔-20ms
    expect(stageStats(2)).toMatchObject({ enemyHp: 130, enemyPower: 0.91, thinkMs: 3180 });
    // 5の倍数は強敵（HP×1.12・攻撃×1.06・さらに速い）
    expect(stageStats(5)).toMatchObject({ elite: true, enemyHp: 177, enemyPower: 1, thinkMs: 2920 });
    expect(stageStats(6).enemyHp).toBeGreaterThan(stageStats(4).enemyHp);
    expect(stageStats(100).thinkMs).toBe(2000); // いちばん速くても 2秒（毎回 ±30% ゆらぐ）
    expect(engineWith(INITIAL_UNLOCKED, 3).s.enemy.maxHp).toBe(139);
  });
});

describe('補助魔法: パワー', () => {
  it('「パワー ファイア」で威力1.5倍、パワー強化で2倍', () => {
    const e = engineWith(['water', 'fire', 'boost']);
    castNow(e, 'パワー ファイア');
    expect(e.s.attacks.find((a) => a.owner === 'player')!.damage).toBe(45);
    const e2 = engineWith(['water', 'fire', 'boost', 'boost_up']);
    castNow(e2, 'パワー ファイア');
    expect(e2.s.attacks.find((a) => a.owner === 'player')!.damage).toBe(60);
  });

  it('覚えていなければ不発', () => {
    const e = engineWith(['water', 'fire']);
    castNow(e, 'パワー ファイア');
    expect(e.s.spells.at(-1)!.error).toMatch(/まだ覚えていない: パワー/);
  });

  it('パワーをつけると魔力と詠唱時間が増える', async () => {
    const { computeSpellCost } = await import('../src/game/ManaSystem');
    const { interpretSpell } = await import('../src/interpreter/SpellInterpreter');
    const plain = computeSpellCost('ファイア', interpretSpell('ファイア'));
    const boosted = computeSpellCost('パワー ファイア', interpretSpell('パワー ファイア'));
    expect(boosted.total).toBeGreaterThan(plain.total);
    expect(boosted.castTimeMs).toBeGreaterThan(plain.castTimeMs);
  });

  it('続けて唱えると、パワーをつけた側だけが強くなる', async () => {
    const { interpretSpell } = await import('../src/interpreter/SpellInterpreter');
    const s = interpretSpell('パワー ウォーター アンド サンダー');
    expect(s.actions.map((a) => a.type === 'ATTACK' && !!a.boost)).toEqual([true, false]);
  });
});

describe('魔法', () => {
  it('どの魔法も、名前で唱えると正しい魔法になり、盤面に着弾する', () => {
    for (const k of SPELL_KEYS.filter((k) => !ELEMENTS[k].effects || !('selfBuff' in ELEMENTS[k].effects!))) {
      const name = ELEMENTS[k].name;
      const sp = interpretSpell(name);
      expect(sp.actions[0], name).toMatchObject({ type: 'ATTACK', element: k });
      const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT });
      e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
      castNow(e, name);
      const atk = e.s.attacks.find((a) => a.owner === 'player');
      expect(atk, name).toBeDefined();
      expect(atk!.cells.length, name).toBeGreaterThan(0);
      expect(atk!.cells.every((c) => c.x >= 0 && c.x < 9 && c.y >= 0 && c.y < 9), name).toBe(true);
    }
  });

  it('長い呪文名は、スペースや「・」で区切っても、続けて言っても通じる', () => {
    for (const t of ['フィアト・ノクス', 'フィアト ノクス', 'フィアットノクス']) {
      expect(interpretSpell(t).actions, t).toEqual([expect.objectContaining({ type: 'ATTACK', element: 'fiat_nox' })]);
    }
    expect(interpretSpell('メメント・モリ').actions[0]).toMatchObject({ element: 'memento_mori' });
    // 「アポカリプス メメント モリ」は2つの魔法の連続詠唱になる
    expect(interpretSpell('アポカリプス メメント モリ').actions.map((a) => a.type === 'ATTACK' && a.element)).toEqual(['apocalypse', 'memento_mori']);
    expect(interpretSpell('クリプス ノヴァ').actions[0]).toMatchObject({ element: 'crypt_nova' });
    expect(interpretSpell('トール ジャッジメント').actions[0]).toMatchObject({ element: 'thor' });
    expect(interpretSpell('ジャッジメント').actions[0]).toMatchObject({ element: 'judgment' });
    expect(interpretSpell('サンダー ストーム').actions[0]).toMatchObject({ element: 'storm' });
  });

  it('真・最強魔法: 盤面すべてに999。詠唱が長く、魔力を大量に使う', async () => {
    const { computeSpellCost } = await import('../src/game/ManaSystem');
    const text = 'フィアト ノクス';
    const c = computeSpellCost(text, interpretSpell(text));
    expect(c.total).toBeGreaterThan(270);
    expect(c.total).toBeLessThanOrEqual(300); // 最初の最大魔力で撃てる
    expect(c.castTimeMs).toBeGreaterThan(3500);
    const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT, stage: 10 });
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    castNow(e, text);
    expect(e.s.attacks.find((a) => a.owner === 'player')!.cells).toHaveLength(81);
    e.advance(2000);
    expect(e.s.enemy.hp).toBe(0); // ステージ10の強敵でも一撃
    expect(e.s.phase).toBe('victory');
    expect(ELEMENTS.fiat_nox.damage).toBeGreaterThan(ELEMENTS.apocalypse.damage * 2 - 1);
  });

  it('メメント・モリは弱った敵に2.5倍', () => {
    const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT, stage: 30 });
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    castNow(e, 'メメント モリ');
    e.advance(2000);
    expect(e.s.enemy.maxHp - e.s.enemy.hp).toBe(45); // 元気なうちは45
    e.s.enemy.hp = Math.floor(e.s.enemy.maxHp * 0.4);
    const hp = e.s.enemy.hp;
    e.s.mana.current = e.s.mana.max;
    castNow(e, 'メメント モリ');
    e.advance(2000);
    expect(hp - e.s.enemy.hp).toBe(Math.round(45 * 2.5));
  });

  it('効果: 吸収・魔力破壊・結界貫通', () => {
    const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT });
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    e.enemyAI.onIncoming = () => {};
    e.s.player.hp = 50;
    castNow(e, 'ドレイン');
    e.advance(1500);
    expect(e.s.player.hp).toBeGreaterThan(50);
    e.enemyAI.nextThinkAt = 10000;
    castNow(e, 'ダークボルト');
    e.s.enemy.shield = { reduction: 0.4, until: e.s.time + 9999 };
    const hp = e.s.enemy.hp;
    e.advance(1500);
    expect(hp - e.s.enemy.hp).toBe(ELEMENTS.dark_bolt.damage); // 結界を無視
    expect(e.enemyAI.nextThinkAt).toBeGreaterThan(10000); // 詠唱妨害で遅れた
  });

  it('枝の強化: 加護で威力アップ、節約で魔力ダウン', async () => {
    const { computeSpellCost } = await import('../src/game/ManaSystem');
    const lo = computeLoadout(['water', 'fire', 'fire_dmg1', 'fire_dmg2', 'fire_eco']);
    expect(lo.branchDmg.fire).toBeCloseTo(1.3225);
    const plain = computeSpellCost('ファイア', interpretSpell('ファイア'), computeLoadout(['water', 'fire']));
    const eco = computeSpellCost('ファイア', interpretSpell('ファイア'), lo);
    expect(eco.total).toBeLessThan(plain.total);
    const e = engineWith(['water', 'fire', 'fire_dmg1', 'fire_dmg2']);
    castNow(e, 'ファイア');
    expect(e.s.attacks.find((a) => a.owner === 'player')!.damage).toBe(Math.round(30 * 1.3225));
  });

  it('ライフアップ・リジェネ・疾風詠唱', () => {
    const e = engineWith(['water', 'guard', 'hp_up', 'hp_up2', 'heal', 'heal_up', 'regen']);
    expect(e.s.player.maxHp).toBe(150);
    e.s.player.hp = 100;
    e.advance(4000);
    expect(e.s.player.hp).toBe(102);
    expect(computeLoadout(['swift']).castMult).toBe(0.85);
  });
});

describe('デウス・エクス・マキナ', () => {
  it('敵の今のHPを半分にし（結界も無視）、1回の戦闘で1度しか使えない', () => {
    const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT, stage: 5 });
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    e.s.enemy.hp = 201;
    e.s.enemy.shield = { reduction: 0.4, until: 999999 };
    castNow(e, 'デウス エクス マキナ');
    e.advance(2000);
    expect(e.s.enemy.hp).toBe(100);
    e.s.mana.current = e.s.mana.max;
    castNow(e, 'デウス・エクス・マキナ');
    expect(e.s.spells.at(-1)!.status).toBe('failed');
    expect(e.s.spells.at(-1)!.error).toMatch(/1度しか使えない/);
    e.advance(2000);
    expect(e.s.enemy.hp).toBe(100);
    // 次の戦闘ではまた使える
    e.reset();
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    castNow(e, 'デウス エクス マキナ');
    expect(e.s.spells.at(-1)!.status).toBe('done');
  });
});

describe('ウェニー・ウィディー・ウィキー', () => {
  it('スキル25個で解放。使うとこの戦闘のあいだ攻撃力1.5倍、1戦闘1回、次の戦闘では元に戻る', () => {
    const others = SKILLS.filter((s) => !s.special).map((s) => s.id);
    expect(canUnlock('veni_vidi_vici', new Set(others.slice(0, 24)), 99).ok).toBe(false);
    expect(canUnlock('veni_vidi_vici', new Set(others.slice(0, 25)), 99).ok).toBe(true);
    const e = new GameEngine(1, { loadout: BASE_ALL_LOADOUT });
    e.enemyAI.nextThinkAt = Number.POSITIVE_INFINITY;
    castNow(e, 'ウェニー ウィディー ウィキー');
    expect(e.s.attackBuff).toBe(1.5);
    expect(e.s.attacks.filter((a) => a.owner === 'player')).toHaveLength(0); // 攻撃はしない
    castNow(e, 'ファイア');
    expect(e.s.attacks.find((a) => a.owner === 'player')!.damage).toBe(45);
    castNow(e, 'ヴェニ ヴィディ ヴィキ');
    expect(e.s.spells.at(-1)!.error).toMatch(/1度しか使えない/);
    e.reset();
    expect(e.s.attackBuff).toBe(1);
  });
});
