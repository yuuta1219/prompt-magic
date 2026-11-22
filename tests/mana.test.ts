import { ManaPool, computeSpellCost, countGameTokens } from '../src/game/ManaSystem';
import { interpretSpell } from '../src/interpreter/SpellInterpreter';
import { MANA } from '../src/game/constants';

describe('ManaSystem', () => {
  it('ゲーム内トークン数は決定的', () => {
    expect(countGameTokens('右に移動')).toBe(2);
    expect(countGameTokens('右に2マス移動')).toBe(countGameTokens('右に2マス移動'));
    expect(countGameTokens('右に2マス移動')).toBe(4); // 右に / 2 / マス移動
    expect(countGameTokens('、。')).toBe(0);
  });

  it('初期値は最大300・毎秒8回復', () => {
    const m = new ManaPool();
    expect(m.max).toBe(300);
    expect(m.regenPerSec).toBe(8);
    m.spend(100);
    m.regen(1000);
    expect(m.current).toBeCloseTo(208);
    m.regen(60_000);
    expect(m.current).toBe(MANA.MAX);
  });

  it('魔力不足では消費できない', () => {
    const m = new ManaPool(300, 10);
    expect(m.spend(50)).toBe(false);
    expect(m.current).toBe(10);
    expect(m.timeUntil(50)).toBeCloseTo(5000);
  });

  it('冗長さと複雑さは別々に評価される', () => {
    const short = computeSpellCost('右に移動', interpretSpell('右に移動'));
    const verbose = '我が魂の盟約に従い、大いなる風の精霊よ、どうか私を右に移動させたまえ';
    const long = computeSpellCost(verbose, interpretSpell(verbose));
    // 長い詠唱はトークン分だけ高い。処理の複雑さは同じ
    expect(long.tokenCost).toBeGreaterThan(short.tokenCost);
    expect(long.complexityPoints).toBe(short.complexityPoints);
    // 短くても高度な処理（予兆回避）は複雑度が高い
    const smart = computeSpellCost('攻撃を避けて右へ移動', interpretSpell('攻撃を避けて右へ移動'));
    expect(smart.complexityPoints).toBeGreaterThan(short.complexityPoints);
  });

  it('予測攻撃・自動化はコストが上がり、威力や範囲の言葉ではコストは変わらない', () => {
    const basic = computeSpellCost('ファイア', interpretSpell('ファイア'));
    const predict = computeSpellCost('予測してファイア', interpretSpell('予測してファイア'));
    expect(predict.total).toBeGreaterThan(basic.total);
    const big = computeSpellCost('最大威力のファイア', interpretSpell('最大威力のファイア'));
    expect(big.effectCost).toBe(basic.effectCost);
    const water = computeSpellCost('ウォーター', interpretSpell('ウォーター'));
    expect(water.effectCost).not.toBe(basic.effectCost); // 属性ごとに効果コストが違う
    const auto = computeSpellCost('敵が攻撃してきたら右に移動', interpretSpell('敵が攻撃してきたら右に移動'));
    expect(auto.automationCost).toBeGreaterThan(0);
  });
});
