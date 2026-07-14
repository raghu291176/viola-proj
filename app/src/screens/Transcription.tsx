import { useStore } from '../store';
import { Icon } from '../components/Icon';

export function Transcription() {
  const src = useStore((s) => s.src);
  const trans = useStore((s) => s.trans);
  const plan = useStore((s) => s.plan);
  const back = useStore((s) => s.back);
  const setSrc = useStore((s) => s.setSrc);
  const doTrans = useStore((s) => s.doTrans);
  const upgrade = useStore((s) => s.upgrade);

  const isFree = plan === 'Free plan';

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={back}><Icon name="chevronLeft" /></button>
        <span className="htitle">AI transcription</span>
      </div>
      <div className="scr">
        <h3 className="m0 mt8" style={{ fontSize: 22 }}>Turn any song or audio into sheet music.</h3>
        <div className="wave" /><div className="wave short" />

        <button className="rowbtn" onClick={() => setSrc('file')}>
          <span className={`rdot${src === 'file' ? ' on' : ''}`} />
          <Icon name="upload" />
          <div className="f1"><div className="rtitle">Upload audio file</div><div className="rsub">MP3, WAV, M4A</div></div>
        </button>
        <button className="rowbtn" onClick={() => setSrc('yt')}>
          <span className={`rdot${src === 'yt' ? ' on' : ''}`} />
          <Icon name="link" />
          <div className="f1"><div className="rtitle">Paste YouTube link</div><div className="rsub">Extract audio from any video</div></div>
        </button>
        <button className="rowbtn" onClick={() => setSrc('rec')}>
          <span className={`rdot${src === 'rec' ? ' on' : ''}`} />
          <Icon name="mic" />
          <div className="f1"><div className="rtitle">Record audio</div><div className="rsub">Record directly in the app</div></div>
        </button>

        <div className="setrow" style={{ cursor: 'default' }}>Cost<span className="setval" style={{ color: 'var(--color-accent-700)' }}>{isFree ? 'Subscription required' : 'Included in your subscription'}</span></div>

        {isFree && (
          <div className="banner">
            AI transcription is part of the ViolaHub subscription.
            <button className="btn btn-primary btn-block" onClick={upgrade}>Subscribe to unlock</button>
          </div>
        )}
        {!isFree && (
          <button className="btn btn-primary btn-block mt16" onClick={doTrans} disabled={trans}>{trans ? 'Transcribing…' : 'Transcribe'}</button>
        )}
      </div>
    </div>
  );
}
