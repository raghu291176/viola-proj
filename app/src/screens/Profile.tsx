import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PROFILE_MENU } from '../lib/data';
import type { HomeVariant } from '../lib/types';

const HOME_LAYOUTS: Record<HomeVariant, string> = {
  a: 'Continue-first',
  b: 'Poster hero',
  c: 'Modular grid',
};

export function Profile() {
  const plan = useStore((s) => s.plan);
  const hv = useStore((s) => s.hv);
  const setHv = useStore((s) => s.setHv);
  const goTab = useStore((s) => s.goTab);
  const showToast = useStore((s) => s.showToast);
  const upgrade = useStore((s) => s.upgrade);

  const isFree = plan === 'Free plan';
  const cycleHome = () => {
    const next: HomeVariant = hv === 'a' ? 'b' : hv === 'b' ? 'c' : 'a';
    setHv(next);
    showToast(`Home layout: ${HOME_LAYOUTS[next]}`);
  };

  return (
    <div className="col f1 ohide">
      <div className="hdr jb">
        <span className="htitle">Profile</span>
        <button className="iconbtn" onClick={() => showToast('Settings is out of scope for this prototype')}><Icon name="settings" /></button>
      </div>
      <div className="scr">
        <div className="fx ac gap12 mt8">
          <div className="avatar">E</div>
          <div className="f1"><div className="htitle">Emily</div><div className="rsub">Violist · Boston, MA</div></div>
          <span className="tag tag-accent">{plan}</span>
        </div>
        {isFree && <button className="btn btn-secondary btn-block mt16" onClick={upgrade}>Subscribe — unlock all courses</button>}
        <div className="mt16">
          <button className="setrow" onClick={cycleHome}>
            Home layout<span className="setval">{HOME_LAYOUTS[hv]}</span>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
          <button className="setrow" onClick={() => goTab('home')}>
            Preview home<span className="setval">Open</span>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
          {PROFILE_MENU.map((t) => (
            <button key={t} className="rowbtn" onClick={() => showToast(`${t} is out of scope for this prototype`)}>
              <span className="rtitle f1">{t}</span>
              <Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
