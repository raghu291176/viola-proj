import { useStore } from '../store';
import { Icon, type IconName } from './Icon';
import type { Tab } from '../lib/types';

const TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'music', icon: 'music', label: 'Music' },
  { key: 'practice', icon: 'metronome', label: 'Practice' },
  { key: 'learn', icon: 'cap', label: 'Learn' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const sub = useStore((s) => s.sub);
  const goTab = useStore((s) => s.goTab);

  return (
    <div className="tabbar">
      <div className="railbrand">VIOLAHUB<span className="bdot">.</span></div>
      {TABS.map((t) => (
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
