/**
 * 盤面のマスに出る、魔法ごとの着弾エフェクト（ファイアなら燃える、メテオなら隕石が落ちる、アイスなら氷が割れる…）。
 *
 * 1マスにつき1つ出る。中身は2層:
 * - floor: 床に貼りつく（波紋・焦げ・霜・ひび）
 * - stand: 盤面の傾きと逆に起こして、カメラの方を向いて立つ（炎・雷・氷柱・岩・光の柱）
 * 動きは CSS アニメーションだけ。全画面の大演出は究極魔法だけ（Cinematic.tsx）。
 */
import { ELEMENTS, type SpellKey } from '../game/elements';

export type VfxKind = 'flame' | 'meteor' | 'splash' | 'bolt' | 'ice' | 'icicle' | 'wind' | 'tornado' | 'earth' | 'rock' | 'holy' | 'dark' | 'steam';

const BY_SPELL: Partial<Record<string, VfxKind>> = {
  meteor: 'meteor',
  icicle: 'icicle',
  tornado: 'tornado',
  tempest: 'tornado',
  rock_blast: 'rock',
  steam: 'steam',
  storm: 'bolt',
  sandstorm: 'wind',
  frost_nova: 'ice',
  chaos: 'dark',
  veni_vidi_vici: 'holy',
  deus_ex_machina: 'holy',
};
const BY_BRANCH: Record<string, VfxKind> = {
  fire: 'flame',
  water: 'splash',
  thunder: 'bolt',
  ice: 'ice',
  wind: 'wind',
  earth: 'earth',
  holy: 'holy',
  dark: 'dark',
  hybrid: 'dark',
};

export function vfxKind(element: string): VfxKind {
  const by = BY_SPELL[element];
  if (by) return by;
  const def = (ELEMENTS as Record<string, { branch: string } | undefined>)[element as SpellKey];
  return BY_BRANCH[def?.branch ?? element] ?? 'dark';
}

/** n 個の同じ部品（--i で番号を渡して、CSS 側でずらす） */
function Parts({ cls, n }: { cls: string; n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cls} style={{ '--i': i } as React.CSSProperties} />
      ))}
    </>
  );
}

export function Vfx({ element }: { element: string }) {
  const kind = vfxKind(element);
  return (
    <div className={`vfx vfx-${kind}`} aria-hidden>
      <div className="vfx-floor">{FLOOR[kind]}</div>
      <div className="vfx-stand">{STAND[kind]}</div>
    </div>
  );
}

const FLOOR: Record<VfxKind, React.ReactNode> = {
  flame: <span className="f-scorch" />,
  meteor: (
    <>
      <span className="f-crater" />
      <span className="f-ring" />
    </>
  ),
  splash: <Parts cls="f-ripple" n={2} />,
  bolt: <span className="f-flash" />,
  ice: <span className="f-frost" />,
  icicle: <span className="f-frost" />,
  wind: <Parts cls="f-slash" n={2} />,
  tornado: <span className="f-swirl" />,
  earth: <Parts cls="f-crack" n={3} />,
  rock: <Parts cls="f-crack" n={3} />,
  holy: <span className="f-halo" />,
  dark: <span className="f-vortex" />,
  steam: <span className="f-flash soft" />,
};

const STAND: Record<VfxKind, React.ReactNode> = {
  flame: (
    <>
      <Parts cls="s-flame" n={3} />
      <Parts cls="s-ember" n={5} />
    </>
  ),
  meteor: (
    <>
      <span className="s-meteor" />
      <Parts cls="s-flame late" n={3} />
      <Parts cls="s-debris" n={6} />
    </>
  ),
  splash: <Parts cls="s-drop" n={7} />,
  bolt: (
    <>
      <span className="s-bolt" />
      <Parts cls="s-spark" n={5} />
    </>
  ),
  ice: (
    <>
      <span className="s-crystal" />
      <Parts cls="s-shard" n={6} />
    </>
  ),
  icicle: (
    <>
      <span className="s-icicle" />
      <Parts cls="s-shard late" n={6} />
    </>
  ),
  wind: <Parts cls="s-gust" n={3} />,
  tornado: <Parts cls="s-twister" n={5} />,
  earth: (
    <>
      <span className="s-spike" />
      <Parts cls="s-dust" n={4} />
    </>
  ),
  rock: (
    <>
      <span className="s-rock" />
      <Parts cls="s-debris" n={6} />
      <Parts cls="s-dust late" n={4} />
    </>
  ),
  holy: (
    <>
      <span className="s-pillar" />
      <Parts cls="s-sparkle" n={5} />
    </>
  ),
  dark: (
    <>
      <span className="s-orb" />
      <Parts cls="s-wisp" n={4} />
    </>
  ),
  steam: <Parts cls="s-puff" n={5} />,
};
