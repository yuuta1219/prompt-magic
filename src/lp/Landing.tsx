/**
 * ルート（/）の紹介ページ。ゲーム本体は /play/。
 * 魔法の名前や数はゲームのデータ（elements.ts / skills.ts）から読むので、増やしてもここは書き換えなくてよい。
 */
import { ELEMENTS, SPELL_KEYS, type SpellKey } from '../game/elements';
import { SKILLS } from '../game/skills';

const PLAY_URL = 'play/';
const BASIC: SpellKey[] = ['water', 'fire', 'thunder', 'ice', 'wind', 'earth'];
const ULTIMATES = SPELL_KEYS.filter((k) => ELEMENTS[k].ultimate && k !== 'fiat_nox');

const CHANTS = [
  { say: 'ファイア', what: '敵のいるマスを焼く' },
  { say: 'ウォーター アンド サンダー', what: '濡らしてから雷。濡れたマスの雷は2倍' },
  { say: 'ライト ツー', what: '右へ2マス、すばやく移動' },
  { say: 'ガード', what: 'すぐに障壁を張る' },
  { say: 'パワー メテオ', what: '威力を上げた隕石を落とす' },
];

function MagicCircle() {
  return (
    <svg className="lp-circle" viewBox="0 0 200 200" aria-hidden>
      <circle cx="100" cy="100" r="94" className="c1" />
      <circle cx="100" cy="100" r="80" className="c2" />
      <g className="rune">
        <polygon points="100,28 162,136 38,136" />
        <polygon points="100,172 38,64 162,64" />
        <circle cx="100" cy="100" r="46" />
      </g>
      <circle cx="100" cy="100" r="10" className="core" />
    </svg>
  );
}

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="lp-logo">PROMPT MAGIC</span>
        <a className="lp-btn small" href={PLAY_URL}>プレイする</a>
      </header>

      <section className="lp-hero">
        <MagicCircle />
        <p className="lp-kicker">― 詠唱とは、世界への命令である ―</p>
        <h1 className="lp-title">PROMPT MAGIC</h1>
        <p className="lp-lead">
          呪文は、<b>声で唱える</b>。<br />
          「ファイア」と言えば燃え、「メテオ」と言えば隕石が落ちる。<br />
          言葉がそのまま魔法になる、ブラウザの魔法バトル。
        </p>
        <a className="lp-btn" href={PLAY_URL}>▶ 今すぐ唱える</a>
        <p className="lp-note">無料・登録なし／Chrome・Edge・Safari のマイクで遊べる</p>
      </section>

      <section className="lp-shot">
        <img src="lp/screen.png" alt="戦闘画面。左に魔法陣と体力、まんなかに3Dの盤面、唱えた呪文「メテオ」が大きく出ている" loading="lazy" />
      </section>

      <section className="lp-sec">
        <h2>遊び方</h2>
        <ol className="lp-steps">
          <li>
            <span className="num">1</span>
            <b>魔法陣を押す</b>
            <p>マイクが ON になる。あとはずっと聞き取ってくれる。</p>
          </li>
          <li>
            <span className="num">2</span>
            <b>呪文を唱える</b>
            <p>話している間、魔法陣に魔力がたまっていく。</p>
          </li>
          <li>
            <span className="num">3</span>
            <b>発動</b>
            <p>少し間を空けると発動。舞台が魔法の色に光り、盤面で炎が上がる。</p>
          </li>
        </ol>
      </section>

      <section className="lp-sec">
        <h2>こう唱える</h2>
        <ul className="lp-chants">
          {CHANTS.map((c) => (
            <li key={c.say}>
              <span className="say">「{c.say}」</span>
              <span className="what">{c.what}</span>
            </li>
          ))}
        </ul>
        <p className="lp-sub">敵の攻撃は赤く光るマスで予告される。唱えて避けて、唱えて当てる。迷っている時間は無い。</p>
      </section>

      <section className="lp-sec">
        <h2>6つの属性</h2>
        <div className="lp-elems">
          {BASIC.map((k) => {
            const e = ELEMENTS[k];
            return (
              <div key={k} className="lp-elem" style={{ '--ec': e.color } as React.CSSProperties}>
                <div className="name">{e.name}</div>
                <div className="shape">{e.shapeLabel}</div>
                <p>{e.summary}</p>
              </div>
            );
          })}
        </div>
        <p className="lp-sub">濡らしてから雷、凍らせてから炎。属性の組み合わせで威力が跳ね上がる。</p>
      </section>

      <section className="lp-sec">
        <h2>{SKILLS.length}のスキルと、究極魔法</h2>
        <p className="lp-sub">
          勝つたびに SP がたまり、スキルツリーで新しい魔法を覚えていく。
          ステージが進むほど敵は強くなり、5戦ごとに強敵が現れる。
        </p>
        <ul className="lp-ults">
          {ULTIMATES.map((k) => (
            <li key={k}>{ELEMENTS[k].name}</li>
          ))}
          <li className="secret">？？？</li>
        </ul>
        <p className="lp-sub">究極魔法は全画面の演出つき。すべてを覚えた者だけが、最後の一言を知る。</p>
      </section>

      <section className="lp-cta">
        <MagicCircle />
        <h2>さあ、唱えよう。</h2>
        <a className="lp-btn" href={PLAY_URL}>▶ プレイする</a>
        <p className="lp-note">
          音声はブラウザの音声認識で文字にする（Chrome では Google のサーバーに送られる）。
          進み具合はこのブラウザの中だけに保存される。
        </p>
      </section>

      <footer className="lp-foot">PROMPT MAGIC</footer>
    </div>
  );
}
