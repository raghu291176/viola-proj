import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PROFILE_MENU } from '../lib/data';
import { BILLING_ENABLED } from '../lib/constants';
import type { HomeVariant } from '../lib/types';

const HOME_LAYOUTS: Record<HomeVariant, string> = {
  a: 'Continue-first',
  b: 'Poster hero',
  c: 'Modular grid',
};

export function Profile() {
  const plan = useStore((s) => s.plan);
  const hv = useStore((s) => s.hv);
  const role = useStore((s) => s.role);
  const authName = useStore((s) => s.authName);
  const authed = useStore((s) => s.authed);
  const setHv = useStore((s) => s.setHv);
  const setRole = useStore((s) => s.setRole);
  const goTab = useStore((s) => s.goTab);
  const showToast = useStore((s) => s.showToast);
  const logout = useStore((s) => s.logout);

  const isTeacher = role === 'teacher' || role === 'admin';
  const name = authName || 'Nishta';
  const planLabel = BILLING_ENABLED ? plan : 'Free · early access';
  const cycleHome = () => {
    const next: HomeVariant = hv === 'a' ? 'b' : hv === 'b' ? 'c' : 'a';
    setHv(next);
    showToast(`Home layout: ${HOME_LAYOUTS[next]}`);
  };
  const onMenu = (t: string) => showToast(
    t === 'Subscription & billing' ? 'Free during early access — no billing yet.'
      : `${t} is out of scope for this prototype`,
  );

  return (
    <div className="col f1 ohide">
      <div className="hdr jb">
        <span className="htitle">Profile</span>
        <button className="iconbtn" onClick={() => showToast('Settings is out of scope for this prototype')}><Icon name="settings" /></button>
      </div>
      <div className="scr">
        <div className="fx ac gap12 mt8">
          <div className="avatar">{name.charAt(0).toUpperCase()}</div>
          <div className="f1">
            <div className="htitle">{name}</div>
            <div className="rsub">{isTeacher ? 'Viola teacher' : 'Violist'} · Boston, MA</div>
          </div>
          <span className="tag tag-accent">{planLabel}</span>
        </div>

        <div className="mt16">
          {/* Role controls which set of screens you see. */}
          <button className="setrow" onClick={() => setRole(isTeacher ? 'student' : 'teacher')}>
            {isTeacher ? 'Switch to student view' : 'Switch to teacher view'}
            <span className="setval">{isTeacher ? 'Teacher' : 'Student'}</span>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
          {!isTeacher && (
            <>
              <button className="setrow" onClick={cycleHome}>
                Home layout<span className="setval">{HOME_LAYOUTS[hv]}</span>
                <Icon name="chevronRight" className="ic ic16 chev" />
              </button>
              <button className="setrow" onClick={() => goTab('home')}>
                Preview home<span className="setval">Open</span>
                <Icon name="chevronRight" className="ic ic16 chev" />
              </button>
            </>
          )}
          {PROFILE_MENU.map((t) => (
            <button key={t} className="rowbtn" onClick={() => onMenu(t)}>
              <span className="rtitle f1">{t}</span>
              <Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          ))}
          {authed && (
            <button className="setrow" onClick={logout}>
              Log out<Icon name="chevronRight" className="ic ic16 chev" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
