import { useStore } from '../store';
import { Icon, type IconName } from './Icon';
import type { Tab } from '../lib/types';

const STUDENT_TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'music', icon: 'music', label: 'Music' },
  { key: 'practice', icon: 'metronome', label: 'Practice' },
  { key: 'learn', icon: 'cap', label: 'Learn' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

// Teachers get a different set of screens.
const TEACHER_TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'students', icon: 'users', label: 'Students' },
  { key: 'assess', icon: 'mic', label: 'Assess' },
  { key: 'music', icon: 'music', label: 'Library' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const sub = useStore((s) => s.sub);
  const role = useStore((s) => s.role);
  const goTab = useStore((s) => s.goTab);

  const tabs = role === 'teacher' || role === 'admin' ? TEACHER_TABS : STUDENT_TABS;

  return (
    <div className="tabbar">
      <div className="railbrand">VIOLAHUB<span className="bdot">.</span></div>
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`titem${tab === t.key && !sub ? ' on' : ''}`}
          onClick={() => goTab(t.key)}
        >
          <Icon name={t.icon} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
