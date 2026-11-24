/** 話をクリアしたときの「ツイートしませんか？」 */
import { tweetUrl } from './share';

export function ShareModal({ no, subtitle, onClose }: { no: number; subtitle: string; onClose: () => void }) {
  return (
    <div className="share-backdrop" onClick={onClose}>
      <div className="share-modal" role="dialog" aria-label="クリアをシェア" onClick={(e) => e.stopPropagation()}>
        <div className="share-kicker">{no === 7 ? '第一部 完' : `第${no}話 クリア！`}</div>
        <img className="share-img" src={`../share/ep${no}.jpg`} alt="" />
        <p className="share-msg">「{subtitle}」をクリアしました。ツイートしませんか？</p>
        <div className="share-actions">
          <a className="share-go" href={tweetUrl(no, subtitle)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            𝕏 でポストする
          </a>
          <button className="share-close" onClick={onClose}>あとで</button>
        </div>
      </div>
    </div>
  );
}
