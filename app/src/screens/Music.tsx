import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PIECES } from '../lib/data';

export function Music() {
  const q = useStore((s) => s.q);
  const setQ = useStore((s) => s.setQ);
  const openComm = useStore((s) => s.openComm);
  const openPro = useStore((s) => s.openPro);
  const openTrans = useStore((s) => s.openTrans);
  const openPiece = useStore((s) => s.openPiece);
  const openScan = useStore((s) => s.openScan);

  const musicList = PIECES.filter((p) => p.t.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="col f1 ohide">
      <div className="hdr"><span className="htitle">Music</span></div>
      <div className="scr">
        <input className="input" placeholder="Search music…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="kickrow"><p className="kick">Find music</p></div>

        <button className="rowbtn" onClick={openComm}>
          <Icon name="users" />
          <div className="f1"><div className="rtitle">Community music</div><div className="rsub">Free · sheet music made by violists, for violists</div></div>
          <Icon name="chevronRight" className="ic ic16 chev" />
        </button>
        <button className="rowbtn" onClick={openPro}>
          <Icon name="cart" />
          <div className="f1"><div className="rtitle">Professional music</div><div className="rsub">Paid · from publishers, purchased via Amazon</div></div>
          <Icon name="chevronRight" className="ic ic16 chev" />
        </button>
        <button className="rowbtn" onClick={openTrans}>
          <Icon name="transcribe" />
          <div className="f1"><div className="rtitle">AI transcription</div><div className="rsub">Subscribers · turn any song or audio into sheet music</div></div>
          <Icon name="chevronRight" className="ic ic16 chev" />
        </button>
        <button className="rowbtn" onClick={openScan}>
          <Icon name="upload" />
          <div className="f1"><div className="rtitle">Scan sheet music</div><div className="rsub">Photograph a page — turns into notation</div></div>
          <Icon name="chevronRight" className="ic ic16 chev" />
        </button>

        <div className="kickrow"><p className="kick">Recently opened</p></div>
        {musicList.map((p, i) => (
          <button key={i} className="rowbtn" onClick={() => openPiece(p)}>
            <div className="thumb"><div className="ministaff" /></div>
            <div className="f1"><div className="rtitle">{p.t}</div><div className="rsub">{p.s}</div></div>
            <span className="stars">{p.star}</span>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
        ))}
        {musicList.length === 0 && <p className="rsub mt12">No pieces match "{q}".</p>}
      </div>
    </div>
  );
}
