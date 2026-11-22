import { interpretSpell } from '../src/interpreter/SpellInterpreter';
import { kanaKey, romajiToKata, hiraToKata } from '../src/interpreter/kana';

const el = (t: string) => interpretSpell(t).actions.map((a) => (a.type === 'ATTACK' ? a.element : a.type));

describe('音声の表記ゆれ', () => {
  it('かなのキー: 小さい字・伸ばす音・ッ・ヴ の違いを無視する', () => {
    expect(kanaKey('ウェニー')).toBe(kanaKey('ウエニ'));
    expect(kanaKey('ウィッキー')).toBe(kanaKey('ウイキ'));
    expect(kanaKey('ヴィディ')).toBe(kanaKey('ビデイ'));
    expect(hiraToKata('うぇにー')).toBe('ウェニー');
    expect(romajiToKata('wiki')).toBe('ウィキ');
  });

  it('ひらがなでもカタカナでも、表記がゆれても同じ呪文になる', () => {
    for (const t of ['ウェニー ウィディー ウィキー', 'うぇにー うぃでぃー うぃきー', 'ウエニー ウイディー ウイキー', 'ヴェニ ヴィディ ヴィキ', 'ベニー ビディー ビッキー', 'ウェニー ウィディー wiki', 'ウェイニー ビーディ ウィーキー']) {
      expect(el(t), t).toEqual(['veni_vidi_vici']);
    }
    expect(el('ふぁいあ')).toEqual(['fire']);
    expect(el('さんだー')).toEqual(['thunder']);
    expect(el('でうす えくす まきな')).toEqual(['deus_ex_machina']);
    expect(el('ふぃあと のくす')).toEqual(['fiat_nox']);
  });

  it('よく化ける漢字を読みに戻す（メメント森 → メメント・モリ）', () => {
    expect(el('メメント森')).toEqual(['memento_mori']);
    expect(el('めめんと 森')).toEqual(['memento_mori']);
  });

  it('呪文名に近ければ、聞き間違いでも発動する。関係ない言葉は不発', () => {
    expect(el('ウェニーウィデーウィキー')).toEqual(['veni_vidi_vici']);
    expect(el('今日の晩ごはん')).toEqual(['NOOP']);
    expect(el('こんにちは')).toEqual(['NOOP']);
  });

  it('移動コマンドもひらがなで通じる', () => {
    expect(interpretSpell('らいと つー').actions[0]).toMatchObject({ type: 'MOVE', direction: 'right', distance: 2 });
  });
});
