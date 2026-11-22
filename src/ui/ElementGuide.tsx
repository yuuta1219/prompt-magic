import { ELEMENTS, ELEMENT_ORDER, ELEMENT_RULES } from '../game/elements';
import type { CommandKey, Loadout } from '../game/skills';

/** [唱え方, 説明, 必要なスキル（無ければ最初から使える）] */
const COMMANDS: [string, string, CommandKey?][] = [
  ['ライト', 'ライト / レフト / アップ / ダウン に、動けるマス数の中からランダム'],
  ['ライト ツー', '数字をつけると正確にそのマス数'],
  ['', '詠唱時間: マス数指定は1マス0.1秒、ランダムは1マス0.5秒'],
  ['ライト マックス', '盤面の端まで'],
  ['アップライト', '斜め（アップ / ダウン ＋ ライト / レフト）'],
  ['ガード', 'すぐに障壁（50%軽減）', 'guard'],
  ['カウンター ガード', '次に当たる直前に自動で障壁', 'counter'],
  ['ヒール', 'HPを20回復。10MPでHP1（ヒール テン なども可。上限40）', 'heal'],
  ['プレディクト ウォーター', '敵の逃げる先を予測して撃つ', 'predict'],
  ['クイック ウォーター', '速く着弾（スロー で遅く）', 'quick'],
  ['パワー ファイア', '補助魔法: その攻撃の威力アップ（1.5倍）', 'boost'],
  ['オン アタック ガード', '自律術式: 敵が攻撃を詠唱したら自動で行動', 'auto'],
  ['オン ヒット ヒール', '自律術式: 被弾したら（エブリ ファイブ で5秒ごと）', 'auto'],
];

/** 属性魔法の解説（盤面の横に常に表示する） */
export function ElementGuide({ loadout }: { loadout: Loadout }) {
  return (
    <aside className="guide" aria-label="属性魔法の解説">
      <header className="guide-h">呪文の書</header>
      <div className="cmd">
        <div className="guide-tips-h">コマンド（声で唱える）</div>
        <table>
          <tbody>
            {COMMANDS.map(([cmd, desc, need]) => (
              <tr key={cmd || desc} className={need && !loadout.commands.has(need) ? 'locked' : ''}>
                <th>
                  {cmd && <span className="cmd-btn">{cmd}</span>}
                </th>
                <td className={cmd ? '' : 'cmd-note'}>{need && !loadout.commands.has(need) ? '🔒 ' : ''}{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted">続けて唱えるときは「アンド」「からの」でつなぐ</div>
      </div>
      <div className="guide-tips-h">覚えた魔法（{loadout.spells.size}/{ELEMENT_ORDER.length}）</div>
      <p className="guide-lead">
        攻撃の<b>形と威力は属性で決まる</b>。言葉で変えられるのは<b>狙う場所</b>（今いる場所・逃げる先・座標）と<b>タイミング</b>だけ。
        発数や威力の指定はできない。
      </p>
      <ul className="guide-list">
        {ELEMENT_ORDER.filter((k) => loadout.spells.has(k)).map((k) => {
          const d = ELEMENTS[k];
          const locked = false;
          return (
            <li key={k} className={`guide-card ${locked ? 'locked' : ''} ${d.ultimate ? 'ultimate' : ''}`} style={{ '--ec': `rgb(${d.color})` } as React.CSSProperties}>
              <span className="guide-name">{d.name}</span>
              {locked && <span className="lock-tag">🔒 スキルツリーで解放</span>}
              <div className="guide-body">
                <div className="mini" aria-hidden>
                  {d.pattern.flat().map((v, i) => (
                    <span key={i} className={v === 1 ? 'on' : v === 2 ? 'rand' : i === 12 ? 'aim' : ''} />
                  ))}
                </div>
                <div className="guide-text">
                  <div className="guide-shape">
                    {d.ultimate ? '★ ' : ''}{d.shapeLabel} <span className="muted">威力 {d.damage}</span>
                  </div>
                  <div className="guide-sum">{d.summary}</div>
                </div>
              </div>
              <div className="guide-combo">✦ {d.combo}</div>
            </li>
          );
        })}
      </ul>
      <div className="guide-tips">
        <div className="guide-tips-h">コンボの例</div>
        <div>
          <b>ウォーター → サンダー</b>: 濡れたマスに雷が集まり、ダメージ{ELEMENT_RULES.THUNDER_WET_MULTIPLIER}倍
        </div>
        <div>
          <b>アイス → ファイア</b>: 凍って動けない敵に確実に当てて、融解{ELEMENT_RULES.MELT_MULTIPLIER}倍
        </div>
        <div>
          <b>ウインド / アース</b>: 敵の逃げ方を読んで、横と縦を使い分ける
        </div>
        <div className="muted">「ウォーター アンド サンダー」のように続けて唱えると、順番に着弾する</div>
      </div>
    </aside>
  );
}
