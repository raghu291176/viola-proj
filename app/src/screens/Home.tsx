import { useStore } from '../store';
import { Icon } from '../components/Icon';

export function Home() {
  const hv = useStore((s) => s.hv);
  const recentOpened = useStore((s) => s.recentOpened);
  const bpm = useStore((s) => s.bpm);
  const droneNote = useStore((s) => s.droneNote);
  const showToast = useStore((s) => s.showToast);
  const openSheet = useStore((s) => s.openSheet);
  const openPiece = useStore((s) => s.openPiece);
  const goToolH = useStore((s) => s.goToolH);
  const goTab = useStore((s) => s.goTab);

  return (
    <div className="col f1 ohide">
      <div className="hdr jb">
        <span className="brand">VIOLAHUB<span className="bdot">.</span></span>
        <span className="htitle homet">Home</span>
        <button className="iconbtn" onClick={() => showToast('No new notifications')}>
          <Icon name="bell" />
        </button>
      </div>

      {hv === 'a' && (
        <div className="scr">
          <h3 className="m0" style={{ fontSize: 24 }}>Good morning, Emily.</h3>
          <p className="rsub mt8">Let's make beautiful music today.</p>
          <div className="kickrow"><p className="kick">Continue practicing</p></div>
          <div className="card elev-sm">
            <div className="fx ac gap12">
              <div className="thumb"><div className="ministaff" /></div>
              <div className="f1">
                <div className="rtitle">Bach: Suite No. 1 in G Major</div>
                <div className="rsub">I. Allemande · 62% through</div>
              </div>
            </div>
            <div className="prog"><i style={{ width: '62%' }} /></div>
            <button className="btn btn-primary btn-block" onClick={openSheet}>Resume</button>
          </div>
          <div className="kickrow"><p className="kick">Quick access</p></div>
          <div className="qgrid">
            <button className="qcell" onClick={() => goToolH('met')}><Icon name="metronome" />Metronome</button>
            <button className="qcell" onClick={() => goToolH('tun')}><Icon name="mic" />Tuner</button>
            <button className="qcell" onClick={() => goToolH('dro')}><Icon name="music" />Drone</button>
            <button className="qcell" onClick={() => goToolH('sr')}><Icon name="sightread" />Sight reading</button>
          </div>
          <div className="kickrow"><p className="kick">Recent music</p><button className="seeall" onClick={() => goTab('music')}>See all</button></div>
          {recentOpened.map((r, i) => (
            <button key={i} className="rowbtn" onClick={() => openPiece(r)}>
              <div className="thumb"><div className="ministaff" /></div>
              <div className="f1"><div className="rtitle">{r.t}</div><div className="rsub">{r.s}</div></div>
              <Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          ))}
        </div>
      )}

      {hv === 'b' && (
        <div className="scr">
          <div className="poster">
            <p className="pm">Tuesday · 7:40 AM</p>
            <h2 className="ph">Good morning, Emily.</h2>
            <p className="pm">6-day streak · 4h 20m this week</p>
          </div>
          <button className="rowbtn" onClick={openSheet} style={{ paddingTop: 18 }}>
            <div className="thumb"><div className="ministaff" /></div>
            <div className="f1">
              <div className="kick" style={{ color: 'var(--color-accent-700)' }}>Continue practicing</div>
              <div className="rtitle">Bach: Suite No. 1 in G Major</div>
              <div className="rsub">I. Allemande · 62% through</div>
            </div>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
          <div className="kickrow"><p className="kick">Tools</p></div>
          <button className="rowbtn" onClick={() => goToolH('met')}><span className="rtitle f1">Metronome</span><span className="rsub">{bpm} BPM</span></button>
          <button className="rowbtn" onClick={() => goToolH('tun')}><span className="rtitle f1">Tuner</span><span className="rsub">A4 · 440 Hz</span></button>
          <button className="rowbtn" onClick={() => goToolH('dro')}><span className="rtitle f1">Drone</span><span className="rsub">{droneNote}</span></button>
          <button className="rowbtn" onClick={() => goToolH('sr')}><span className="rtitle f1">Sight reading</span><span className="rsub">Level 2</span></button>
          <div className="kickrow"><p className="kick">Recent music</p><button className="seeall" onClick={() => goTab('music')}>See all</button></div>
          {recentOpened.map((r, i) => (
            <button key={i} className="rowbtn" onClick={() => openPiece(r)}>
              <div className="f1"><div className="rtitle">{r.t}</div><div className="rsub">{r.s}</div></div>
              <Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          ))}
        </div>
      )}

      {hv === 'c' && (
        <div className="scr">
          <h3 className="m0" style={{ fontSize: 24 }}>Good morning, Emily.</h3>
          <p className="rsub mt8">Tuesday · week 24</p>
          <div className="cellgrid">
            <div className="cell br bb">
              <p className="kick">Continue</p>
              <div className="rtitle f1">Bach: Suite No. 1 in G Major</div>
              <div className="rsub">I. Allemande</div>
              <button className="btn btn-primary" onClick={openSheet}>Resume</button>
            </div>
            <div className="cell bb">
              <p className="kick">This week</p>
              <div className="bignum">4h 20m</div>
              <div className="rsub">6-day streak</div>
              <div className="prog mt8"><i style={{ width: '72%' }} /></div>
              <div className="rsub">72% of 6h goal</div>
            </div>
            <div className="cell br">
              <p className="kick">Tools</p>
              <button className="btn btn-ghost" onClick={() => goToolH('met')}>Metronome</button>
              <button className="btn btn-ghost" onClick={() => goToolH('tun')}>Tuner</button>
              <button className="btn btn-ghost" onClick={() => goToolH('dro')}>Drone</button>
            </div>
            <div className="cell">
              <p className="kick">Recent</p>
              {recentOpened.map((r, i) => (
                <button key={i} className="btn btn-ghost" style={{ color: 'inherit', textAlign: 'left' }} onClick={() => openPiece(r)}>{r.t}</button>
              ))}
            </div>
          </div>
          <div className="kickrow"><p className="kick">Up next in Learn</p></div>
          <button className="rowbtn" onClick={() => goTab('learn')}>
            <div className="f1"><div className="rtitle">Vibrato Mastery · Lesson 4</div><div className="rsub">Beautiful, expressive sound</div></div>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
        </div>
      )}
    </div>
  );
}
