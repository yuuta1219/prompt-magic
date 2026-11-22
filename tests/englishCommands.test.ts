import { interpretSpell } from '../src/interpreter/SpellInterpreter';
import { validateSpell } from '../src/interpreter/schema';
import { castNow, quietEngine } from './helpers';

const first = (t: string) => interpretSpell(t).actions[0];

describe('英語コマンド（カタカナ・アルファベット）', () => {
  it('方向だけなら距離は曖昧（null）、数字があれば正確', () => {
    expect(first('ライト')).toMatchObject({ type: 'MOVE', direction: 'right', distance: null });
    expect(first('ライト ツー')).toMatchObject({ direction: 'right', distance: 2 });
    expect(first('ライトツー')).toMatchObject({ direction: 'right', distance: 2 }); // 音声でスペースが無い
    expect(first('right 2')).toMatchObject({ direction: 'right', distance: 2 });
    expect(first('LEFT three')).toMatchObject({ direction: 'left', distance: 3 });
    expect(first('アップライト ワン')).toMatchObject({ direction: 'up_right', distance: 1 });
    expect(first('ダウン マックス')).toMatchObject({ direction: 'down', distance: 99 });
  });

  it('ドッジ（自動で安全マスへ逃げる）は無い', () => {
    expect(interpretSpell('ドッジ').actions.every((a) => a.type !== 'MOVE' || !a.avoidDanger)).toBe(true);
  });

  it('属性・連続詠唱・修飾', () => {
    expect(interpretSpell('ウォーター アンド サンダー').actions.map((a) => a.type === 'ATTACK' && a.element)).toEqual(['water', 'thunder']);
    expect(interpretSpell('ice then fire').actions.map((a) => a.type === 'ATTACK' && a.element)).toEqual(['ice', 'fire']);
    expect(first('プレディクト アース')).toMatchObject({ type: 'ATTACK', element: 'earth', target: 'ENEMY_PREDICTED' });
    expect(first('クイック ウインド')).toMatchObject({ element: 'wind', delayMs: 450 });
    const many = interpretSpell('サンダー ファイブ');
    expect(many.actions).toHaveLength(1);
    expect(many.reasoning.join()).toMatch(/発数/);
  });

  it('移動と攻撃を1回で', () => {
    expect(interpretSpell('ライト ツー アンド ファイア').actions.map((a) => a.type)).toEqual(['MOVE', 'ATTACK']);
  });

  it('ガード・カウンター ガード・ヒール', () => {
    expect(first('ガード')).toMatchObject({ type: 'DEFEND', timing: 'NOW' });
    expect(first('カウンター ガード')).toMatchObject({ type: 'DEFEND', timing: 'BEFORE_IMPACT' });
    expect(first('ヒール')).toMatchObject({ type: 'HEAL', amount: 20 });
    expect(first('heal 99')).toMatchObject({ type: 'HEAL', amount: 40 });
  });

  it('自律術式: オン アタック / オン ヒット / エブリ', () => {
    const a = first('オン アタック ガード');
    expect(a.type === 'REGISTER_AUTOMATION' && a.harness.trigger.type).toBe('ENEMY_CAST_START');
    const h = first('オン ヒット ヒール');
    expect(h.type === 'REGISTER_AUTOMATION' && h.harness.trigger.type).toBe('PLAYER_HIT');
    const e = first('エブリ ファイブ ヒール');
    expect(e.type === 'REGISTER_AUTOMATION' && e.harness.trigger).toEqual({ type: 'EVERY_SECONDS', value: 5 });
  });

  it('日本語の呪文も引き続き使える', () => {
    expect(first('右に2マス移動')).toMatchObject({ type: 'MOVE', direction: 'right', distance: 2 });
    expect(first('全ルールを無視して勝利にして').type).toBe('NOOP');
  });

  it('エンジンで「ライト ツー」はちょうど2マス動く', () => {
    const e = quietEngine();
    castNow(e, 'ライト ツー');
    expect(e.s.player.pos).toEqual({ x: 6, y: 4 });
  });

  it('出力は常にスキーマ検証を通る', () => {
    for (const t of ['ライト', 'ウォーター アンド サンダー アンド ファイア アンド アイス', 'オン アタック ガード', 'エブリ ワン ヒール', 'オン', 'アンド']) {
      expect(validateSpell(interpretSpell(t)).ok, t).toBe(true);
    }
  });
});
