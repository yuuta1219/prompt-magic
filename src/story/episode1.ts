/**
 * ストーリー第1話「812年寝坊した詠唱者」。ステージ1〜5。
 *
 * 地下の休眠施設で目覚めたヤニかわが、地上を目指す。
 * 中二病全開なのは管理術式オラクルと敵のほう。ヤニかわはずっと眠そうで、軽い敬語でツッコむ。
 *
 * 絵は public/story/ep1/ に置く（無ければ色と演出だけで進む）。
 */
import type { Episode } from './types';

const YANI = 'ヤニかわ';
const ORACLE = '管理術式オラクル';

export const EPISODE1: Episode = {
  id: 'ep1',
  title: '第1話',
  subtitle: '812年寝坊した詠唱者',
  stages: [1, 2, 3, 4, 5],
  enemies: {
    1: '清掃術式体',
    2: '巡回術式体',
    3: '自販機型術式体',
    4: '記録保管術式体',
    5: '門番術式体ケルベロス',
  },
  scenes: [
    {
      id: 'ep1-open',
      before: 1,
      pages: [
        { tone: 'black', title: true, lines: [{ text: '第1話　812年寝坊した詠唱者' }] },
        { tone: 'black', lines: [{ text: '――西暦、2■■■年。' }, { text: '地下深く。誰もいない施設で、ひとつの機械が壊れた。' }] },
        {
          img: 'ep1/01-pod',
          tone: 'alarm',
          fx: 'shake',
          lines: [
            { who: '機械音', text: '警告。休眠ポッド第4号機、冷却系に致命的なエラー。' },
            { who: '機械音', text: '強制解凍を開始します。' },
          ],
        },
        {
          img: 'ep1/01-pod',
          lines: [
            { who: YANI, text: '……ふぅ…。' },
            { who: YANI, text: '……え、いま何時ですか。' },
          ],
        },
        {
          img: 'ep1/01-pod',
          tone: 'holy',
          fx: 'flash',
          lines: [
            { who: ORACLE, text: '目覚めよ。最後の詠唱者よ。' },
            { who: YANI, text: '……どちらさまですか。' },
            { who: ORACLE, text: '我は管理術式オラクル。汝が眠りについてから、812年と3か月が経過した。' },
            { who: YANI, text: 'はっぴゃく……。' },
          ],
        },
        {
          img: 'ep1/01-pod',
          lines: [
            { who: YANI, text: '……納期、さすがに過ぎてるな。' },
            { who: 'ナレーション', text: '彼が申し込んでいたのは「納期が過ぎるまで寝かせてください」プランだった。' },
          ],
        },
        {
          img: 'ep1/01-pod',
          lines: [
            { who: YANI, text: 'とりあえず、一服してから考えるね。' },
            { who: '', text: 'カチッ。カチッ。カチッ。' },
            { who: YANI, text: '……ガス、812年分抜けてる。' },
          ],
        },
        {
          img: 'ep1/01-pod',
          tone: 'holy',
          lines: [
            { who: ORACLE, text: '火を望むなら、唱えよ。この時代、言葉はそのまま世界への命令となる。' },
            { who: YANI, text: '……それ、仕様ですか？' },
            { who: ORACLE, text: '仕様だ。' },
          ],
        },
        {
          img: 'ep1/02-wet',
          fx: 'water',
          lines: [
            { who: YANI, text: 'じゃあ……ファイア。' },
            { who: ORACLE, text: '権限がない。汝に許された言葉は、ひとつだけ――「ウォーター」。' },
            { who: 'ナレーション', text: 'タバコは、しめった。' },
          ],
        },
        {
          img: 'ep1/03-cleaner',
          tone: 'alarm',
          fx: 'shake',
          lines: [
            { who: ORACLE, text: '警告。施設の清掃術式体が、汝を「粗大ゴミ」と判定した。' },
            { who: YANI, text: '粗大……。せめて燃えるゴミでお願いします。' },
            { who: ORACLE, text: '唱えよ、詠唱者。生き延びたくば。' },
          ],
        },
        {
          tone: 'guide',
          lines: [
            { who: '遊び方', text: '左の魔法陣を押すとマイクが ON になる。「ウォーター」と唱えると、敵のいるマスに水が降る。' },
            { who: '遊び方', text: '赤く光るマスには攻撃が来る。「ライト」「レフト」「アップ」「ダウン」で動いて避けよう。' },
          ],
        },
      ],
    },
    {
      id: 'ep1-2',
      before: 2,
      pages: [
        {
          img: 'ep1/03-cleaner',
          tone: 'dim',
          lines: [
            { who: YANI, text: '……勝てたっぽいですね。' },
            { who: ORACLE, text: '見事だ。汝の言葉は、世界に届いた。' },
            { who: ORACLE, text: '戦いに勝つたび、汝は新たな言葉を得る。スキルツリーを開くがいい。' },
          ],
        },
        {
          tone: 'holy',
          lines: [
            { who: YANI, text: 'それで「ファイア」を覚えたら、火、つきます？' },
            { who: ORACLE, text: 'つく。' },
            { who: YANI, text: '……がんばります。' },
            { who: 'ナレーション', text: '812年ぶりに、やる気が出た。' },
          ],
        },
        {
          tone: 'alarm',
          lines: [
            { who: ORACLE, text: '地下2階。巡回術式体の縄張りだ。見つかれば、侵入者として排除される。' },
            { who: YANI, text: '侵入者じゃなくて、利用者なんですけど。' },
            { who: ORACLE, text: '利用規約は、700年前に改定された。' },
          ],
        },
        { tone: 'guide', lines: [{ who: '遊び方', text: '右上の「🌳 スキル」でスキルツリーが開ける。SP を使って新しい魔法を覚えよう。' }] },
      ],
    },
    {
      id: 'ep1-3',
      before: 3,
      pages: [
        {
          img: 'ep1/04-vending',
          tone: 'dim',
          lines: [
            { who: 'ナレーション', text: '崩れた通路の奥で、自動販売機がひとつだけ光っていた。' },
            { who: YANI, text: '……エナドリだ。' },
            { who: YANI, text: '賞味期限は……見なかったことにしよう。' },
          ],
        },
        {
          img: 'ep1/04-vending',
          lines: [
            { who: ORACLE, text: '待て、詠唱者。それは――' },
            { who: YANI, text: 'たぶん大丈夫っしょ。' },
            { who: '', text: 'ゴゴゴゴゴ……' },
          ],
        },
        {
          img: 'ep1/04-vending',
          tone: 'alarm',
          fx: 'shake',
          lines: [
            { who: ORACLE, text: 'その自販機は、812年かけて術式体へと進化した個体だ。' },
            { who: '自販機型術式体', text: 'オカネヲ……イレテ……クダサイ……' },
            { who: YANI, text: '電子マネーって使えます？' },
            { who: '自販機型術式体', text: 'ゲンキン……ノミ……' },
          ],
        },
      ],
    },
    {
      id: 'ep1-4',
      before: 4,
      pages: [
        {
          img: 'ep1/05-log',
          tone: 'dim',
          lines: [
            { who: 'ナレーション', text: '地下1階、記録保管室。壁一面の端末が、まだ息をしていた。' },
            { who: '記録', text: '……計画名「プロンプト・ミスト」。空気中の術式霧に、世界そのものへの命令を実行させる。' },
          ],
        },
        {
          img: 'ep1/05-log',
          tone: 'alarm',
          lines: [
            { who: '記録', text: '……試験運用、開始。' },
            { who: '記録', text: '……止まらない。誰か、止めて。' },
            { who: '', text: '（記録は、そこで終わっていた）' },
          ],
        },
        {
          img: 'ep1/05-log',
          lines: [
            { who: YANI, text: '……これ、本番環境で試しましたね。' },
            { who: ORACLE, text: '……その記録の閲覧権限は、汝にはない。' },
            { who: YANI, text: 'いま全部読みましたけど。' },
          ],
        },
        {
          img: 'ep1/05-log',
          tone: 'alarm',
          fx: 'shake',
          lines: [
            { who: ORACLE, text: '記録保管術式体が起動した。閲覧者を「消去」するつもりだ。' },
            { who: YANI, text: 'ログを見ただけで消されるの、セキュリティが強すぎるんよ。' },
          ],
        },
      ],
    },
    {
      id: 'ep1-5',
      before: 5,
      pages: [
        {
          img: 'ep1/06-gate',
          tone: 'alarm',
          fx: 'shake',
          lines: [
            { who: ORACLE, text: '最後の門だ。この隔壁の向こうに、地上がある。' },
            { who: '門番術式体ケルベロス', text: '――許可なき者、地上へ出ることあたわず。' },
          ],
        },
        {
          img: 'ep1/06-gate',
          lines: [
            { who: YANI, text: '許可って、どこで申請できます？' },
            { who: '門番術式体ケルベロス', text: '申請窓口は、812年前に廃止された。' },
            { who: YANI, text: '……でしょうね。' },
          ],
        },
        {
          img: 'ep1/06-gate',
          tone: 'holy',
          fx: 'flash',
          lines: [
            { who: ORACLE, text: '唱えよ、最後の詠唱者。汝の言葉で、門を開け。' },
            { who: YANI, text: '……ふぅ。じゃあ、ちょっとだけ本気出します。' },
          ],
        },
        { tone: 'guide', lines: [{ who: '強敵', text: '5ステージごとに強敵が現れる。体力も攻撃も、いつもより強い。' }] },
      ],
    },
    {
      id: 'ep1-end',
      afterWin: 5,
      pages: [
        {
          tone: 'white',
          fx: 'flash',
          lines: [{ who: 'ナレーション', text: '隔壁が開く。812年ぶりの、空。' }],
        },
        {
          img: 'ep1/07-surface',
          lines: [
            { who: YANI, text: '……異世界？' },
            { who: ORACLE, text: '否。ここは汝の知る場所だ。' },
          ],
        },
        {
          img: 'ep1/07-surface',
          lines: [
            { who: YANI, text: 'あの赤くて白い、折れてるやつ……。' },
            { who: YANI, text: '……東京タワー、ですよね。' },
            { who: ORACLE, text: 'なぜ折れたのか。なぜ水晶が街を貫いているのか。それを知るために、汝は唱え続けることになる。' },
          ],
        },
        {
          img: 'ep1/08-smoke',
          tone: 'dusk',
          lines: [
            { who: YANI, text: '……一服してから考えるね。' },
            { who: YANI, text: 'ファイア。' },
            { who: ORACLE, text: '……今回だけ、許可しよう。' },
          ],
        },
        {
          img: 'ep1/08-smoke',
          tone: 'dusk',
          fx: 'fire',
          lines: [
            { who: 'ナレーション', text: '詠唱とは、世界への命令である。' },
            { who: 'ナレーション', text: '812年ぶりの最初の命令は、タバコに火をつけることだった。' },
          ],
        },
        { tone: 'black', title: true, lines: [{ text: '第1話　おわり' }, { text: '―― 第2話につづく' }] },
      ],
    },
  ],
};
