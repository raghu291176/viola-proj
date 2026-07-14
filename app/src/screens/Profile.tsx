import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PROFILE_MENU } from '../lib/data';

export function Profile() {
  const plan = useStore((s) => s.plan);
  const showToast = useStore((s) => s.showToast);
  const upgrade = useStore((s) => s.upgrade);

  const isFree = plan === 'Free plan';

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
