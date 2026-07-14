import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { COMMUNITY, PROFESSIONAL } from '../lib/data';

export function Browse() {
  const browse = useStore((s) => s.browse);
  const back = useStore((s) => s.back);
  const openPiece = useStore((s) => s.openPiece);
  const showToast = useStore((s) => s.showToast);

  const isComm = browse === 'comm';
  const isPro = browse === 'pro';
  const list = isComm ? COMMUNITY : PROFESSIONAL;

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={back}><Icon name="chevronLeft" /></button>
        <div className="f1">
          <div className="htitle" style={{ fontSize: 14 }}>{isComm ? 'Community music' : 'Professional music'}</div>
          <div className="rsub">{isComm ? 'Free · by violists, for violists' : 'Paid · purchased via Amazon'}</div>
        </div>
      </div>
      <div className="scr">
        {list.map((b, i) => (
          <div key={i} className="rowbtn" style={{ cursor: 'default' }}>
            <div className="thumb"><div className="ministaff" /></div>
            <div className="f1"><div className="rtitle">{b.t}</div><div className="rsub">{b.s}</div></div>
            <button
              className={`btn ${b.cls}`}
              onClick={isComm
                ? () => openPiece({ t: b.t, s: 'Community' })
                : () => showToast('Opens Amazon checkout in a browser')}
            >
              {b.cta}
            </button>
          </div>
        ))}
        {isPro && <div className="banner">Physical editions ship from Amazon. Digital editions are also paid through Amazon and open in the app after purchase.</div>}
        {isComm && (
          <>
            <div className="banner">Community music is free. Anyone can publish — but only music for violists.</div>
            <button className="btn btn-secondary btn-block" onClick={() => showToast('Publishing flow is out of scope for this prototype')}>Publish your own piece</button>
          </>
        )}
      </div>
    </div>
  );
}
