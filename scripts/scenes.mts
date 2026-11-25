/**
 * 紙芝居のシーン一覧ページ（台本の確認用）。絵・色・演出・セリフをページごとに並べる。
 *   node --experimental-strip-types scripts/scenes.mts
 * art/scenes.html に書き出す（ブラウザで開くだけ。デプロイはしない）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseScript } from '../src/story/script.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'art/scenes.html');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Page = { img?: string; tone?: string; fx?: string; lines: { who?: string; text: string }[] };
let body = '';
let toc = '';
let pagesAll = 0;
let charsAll = 0;
for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  const src = readFileSync(join(ROOT, `src/story/ep${n}.txt`), 'utf8');
  const sc = parseScript(src);
  charsAll += src.length;
  const sections: [string, Page[]][] = [
    ['プロローグ', sc.prologue as Page[]],
    ...sc.chapters.flatMap((c) => {
      const out: [string, Page[]][] = [
        [`チャプター${c.no}「${c.title}」 戦闘の前（敵: ${c.enemy}）`, c.before as Page[]],
        [`チャプター${c.no}「${c.title}」 ${c.loseEvent ? '負けたあと（負けイベント）' : '勝ったあと'}`, c.after as Page[]],
      ];
      if (c.postCredits?.length) out.push(['エンドロールのあと', c.postCredits as Page[]]);
      return out;
    }),
  ];
  const pages = sections.reduce((a, [, p]) => a + p.length, 0);
  pagesAll += pages;
  toc += `<a href="#ep${n}">${esc(sc.title)}「${esc(sc.subtitle)}」<small>${pages}ページ・${src.length}字</small></a>`;
  body += `<h2 id="ep${n}">${esc(sc.title)}「${esc(sc.subtitle)}」 <small>${pages}ページ・${src.length}字</small></h2>`;
  for (const [name, list] of sections) {
    body += `<h3>${esc(name)}</h3>`;
    list.forEach((p, i) => {
      const lines = p.lines.map((l) => (l.who ? `<span class="who">${esc(l.who)}</span>「${esc(l.text)}」` : esc(l.text))).join('<br>');
      const has = p.img && existsSync(join(ROOT, `public/story/${p.img}.jpg`));
      const img = has ? `<img src="../public/story/${p.img}.jpg" loading="lazy" alt="">` : (p.img ? `<div class="noimg miss">絵がない（${esc(p.img)}）</div>` : `<div class="noimg">絵なし</div>`);
      body += `<div class="p">${img}<div><div class="id">ページ${i + 1}　絵: ${esc(p.img ?? 'なし')}</div><div class="meta">色: ${esc(p.tone ?? '-')} ／ 演出: ${esc(p.fx ?? '-')}</div><div class="l">${lines}</div></div></div>`;
    });
  }
}

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>紙芝居のシーン一覧</title><style>
body{background:#0b0817;color:#eee;font-family:'Noto Sans JP',sans-serif;margin:0;padding:16px;max-width:1100px;margin:auto}
h1{font-size:20px} h2{margin:32px 0 8px;color:#ffd166;border-bottom:1px solid #444;scroll-margin-top:12px} h3{margin:18px 0 6px;color:#a98bff;font-size:15px}
small{font-size:12px;color:#999;font-weight:normal;margin-left:6px}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0} .toc a{color:#eee;text-decoration:none;background:#1b1433;border:1px solid #3a2f63;border-radius:8px;padding:6px 10px;font-size:13px}
.p{display:grid;grid-template-columns:260px 1fr;gap:12px;padding:8px;border-bottom:1px solid #222}
.p img{width:260px;border-radius:6px} .noimg{width:260px;height:120px;display:grid;place-items:center;border:1px dashed #555;border-radius:6px;color:#888;font-size:12px} .noimg.miss{color:#f88;border-color:#a44}
.id{color:#7fe8ff;font-family:monospace;font-size:12px} .meta{color:#999;font-size:12px} .l{font-size:13px;line-height:1.6;margin-top:4px}
.who{color:#ffd166}
@media (max-width:640px){.p{grid-template-columns:1fr}.p img,.noimg{width:100%}}
</style></head><body>
<h1>紙芝居のシーン一覧（第1話〜第7話）</h1>
<p style="color:#999">ページ番号は台本と同じ。全${pagesAll}ページ・${charsAll}字。台本（src/story/epN.txt）から自動で作っています。</p>
<nav class="toc">${toc}</nav>
${body}</body></html>`;
writeFileSync(OUT, html);
console.log(`書き出した: ${OUT}（${pagesAll}ページ）`);
