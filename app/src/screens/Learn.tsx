import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { COURSES } from '../lib/data';

export function Learn() {
  const learnTab = useStore((s) => s.learnTab);
  const plan = useStore((s) => s.plan);
  const setLearnTab = useStore((s) => s.setLearnTab);
  const openCourse = useStore((s) => s.openCourse);
  const upgrade = useStore((s) => s.upgrade);
  const showToast = useStore((s) => s.showToast);

  const isFree = plan === 'Free plan';

  return (
    <div className="col f1 ohide">
      <div className="hdr"><span className="htitle">Learn</span></div>
      <div className="ptabs">
        <button className={`ptab${learnTab === 'crs' ? ' on' : ''}`} onClick={() => setLearnTab('crs')}>Courses</button>
        <button className={`ptab${learnTab === 'prg' ? ' on' : ''}`} onClick={() => setLearnTab('prg')}>My progress</button>
      </div>

      {learnTab === 'crs' && (
        <div className="scr">
          {isFree && (
            <div className="banner" style={{ marginTop: 12 }}>
              Courses are included with a ViolaHub subscription.
              <button className="btn btn-primary btn-block" onClick={upgrade}>Subscribe to unlock</button>
            </div>
          )}
          <div className="kickrow" style={{ marginTop: 6 }}><p className="kick">Featured courses{isFree ? '' : ' · included in your subscription'}</p></div>
          {COURSES.map((c, i) => (
            <button key={i} className="rowbtn" onClick={isFree ? () => showToast('Subscribe to access courses') : () => openCourse(c)}>
              <div className="thumb"><Icon name="music" /></div>
              <div className="f1"><div className="rtitle">{c.t}</div><div className="rsub">{c.s}</div></div>
              {isFree && <Icon name="lock" className="ic ic16 chev" />}
              <Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          ))}
        </div>
      )}

      {learnTab === 'prg' && (
        <div className="scr">
          <p className="kick" style={{ marginTop: 6 }}>This week</p>
          <div className="bignum mt8">4h 20m</div>
          <div className="rsub">of a 6h goal</div>
          <div className="prog mt8"><i style={{ width: '72%' }} /></div>
          <div className="mt16">
            <div className="setrow" style={{ cursor: 'default' }}>Practice streak<span className="setval">6 days</span></div>
            <div className="setrow" style={{ cursor: 'default' }}>Courses in progress<span className="setval">2</span></div>
            <div className="setrow" style={{ cursor: 'default' }}>Pieces learned<span className="setval">14</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
