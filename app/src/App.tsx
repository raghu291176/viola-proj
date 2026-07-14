import { useEffect } from 'react';
import { useStore } from './store';
import { stopAllAudio } from './lib/audio';
import { liveEngine } from './lib/realtime';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { Home } from './screens/Home';
import { Music } from './screens/Music';
import { Browse } from './screens/Browse';
import { Sheet } from './screens/Sheet';
import { Practice } from './screens/Practice';
import { Learn } from './screens/Learn';
import { Course } from './screens/Course';
import { Lesson } from './screens/Lesson';
import { Transcription } from './screens/Transcription';
import { Profile } from './screens/Profile';
import { Assess } from './screens/Assess';

function ActiveScreen() {
  const tab = useStore((s) => s.tab);
  const sub = useStore((s) => s.sub);
  const screen = sub ?? tab;
  switch (screen) {
    case 'home': return <Home />;
    case 'music': return <Music />;
    case 'practice': return <Practice />;
    case 'learn': return <Learn />;
    case 'profile': return <Profile />;
    case 'sheet': return <Sheet />;
    case 'browse': return <Browse />;
    case 'trans': return <Transcription />;
    case 'course': return <Course />;
    case 'lesson': return <Lesson />;
    case 'assess': return <Assess />;
    default: return <Home />;
  }
}

export function App() {
  const device = useStore((s) => s.device);
  const setDevice = useStore((s) => s.setDevice);
  const sub = useStore((s) => s.sub);

  useEffect(() => () => { stopAllAudio(); liveEngine.stop(); }, []);

  return (
    <div className="col ac gap12" style={{ padding: 24 }}>
      <div className="seg" role="tablist" aria-label="Device">
        <label className="seg-opt">
          <input type="radio" name="device" checked={device === 'phone'} onChange={() => setDevice('phone')} />
          Phone
        </label>
        <label className="seg-opt">
          <input type="radio" name="device" checked={device === 'ipad'} onChange={() => setDevice('ipad')} />
          iPad
        </label>
      </div>

      <div className={`phone${device === 'ipad' ? ' ipad' : ''}`}>
        <ActiveScreen />
        {sub !== 'sheet' && <TabBar />}
        <Toast />
      </div>
    </div>
  );
}
