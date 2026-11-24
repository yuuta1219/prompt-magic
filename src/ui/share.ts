/**
 * 話をクリアしたときの X（Twitter）シェア。
 * シェアする URL は public/share/epN/（話ごとの OGP 画像が出る。人が開くとトップへ飛ぶ）。
 * クリアしたときのモーダルは、話ごとに1回だけ（出したかどうかは localStorage に残す）。
 */
const SHOWN_KEY = 'prompt-magic.share-shown';

export function tweetUrl(no: number, subtitle: string): string {
  const last = no === 7;
  const text = last
    ? `PROMPT MAGIC 第一部「終末の東京」全7話クリア！\n第7話「${subtitle}」まで唱えきった。`
    : `PROMPT MAGIC 第${no}話「${subtitle}」をクリアした！`;
  const url = `${location.origin}/share/ep${no}/`;
  const q = new URLSearchParams({ text, url, hashtags: 'PROMPTMAGIC' });
  return `https://x.com/intent/post?${q}`;
}

function shownList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function shareShown(epId: string): boolean {
  return shownList().includes(epId);
}
export function markShareShown(epId: string): void {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set([...shownList(), epId])]));
  } catch {
    /* 保存できなくてもよい（次も出るだけ） */
  }
}
