import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { TS, SOUNDS, KEYS, NVS, SROPTS, NOTES, tempoName } from '../lib/constants';

const rot = (open: boolean) => (open ? 'rotate(90deg)' : 'none');

export function Practice() {
  const prTool = useStore((s) => s.prTool);
  const setPrTool = useStore((s) => s.setPrTool);

  return (
    <div className="col f1 ohide">
      <div className="hdr"><span className="htitle">Practice</span></div>
      <div className="ptabs">
        <button className={`ptab${prTool === 'met' ? ' on' : ''}`} onClick={() => setPrTool('met')}>Metronome</button>
        <button className={`ptab${prTool === 'tun' ? ' on' : ''}`} onClick={() => setPrTool('tun')}>Tuner</button>
        <button className={`ptab${prTool === 'dro' ? ' on' : ''}`} onClick={() => setPrTool('dro')}>Drone</button>
        <button className={`ptab${prTool === 'sr' ? ' on' : ''}`} onClick={() => setPrTool('sr')}>Sight reading</button>
      </div>
      {prTool === 'met' && <Metronome />}
      {prTool === 'tun' && <Tuner />}
      {prTool === 'dro' && <Drone />}
      {prTool === 'sr' && <SightReading />}
    </div>
  );
}

function Metronome() {
  const bpm = useStore((s) => s.bpm);
  const run = useStore((s) => s.run);
  const beat = useStore((s) => s.beat);
  const accent = useStore((s) => s.accent);
  const tsIdx = useStore((s) => s.tsIdx);
  const soundIdx = useStore((s) => s.soundIdx);
  const metMenu = useStore((s) => s.metMenu);
  const toggleRun = useStore((s) => s.toggleRun);
  const setBpm = useStore((s) => s.setBpm);
  const setTsIdx = useStore((s) => s.setTsIdx);
  const setAccent = useStore((s) => s.setAccent);
  const setSoundIdx = useStore((s) => s.setSoundIdx);
  const setMetMenu = useStore((s) => s.setMetMenu);

  const beats = parseInt(TS[tsIdx], 10);
  const beatDots = Array.from({ length: beats }, (_, i) => `dot2${i === beat && run ? ' hit' : i === accent - 1 ? ' acc' : ''}`);

  return (
    <div className="scr">
      <p className="kick" style={{ marginTop: 6 }}>Tempo · {tempoName(bpm)}</p>
      <div className="fx ac jb mt12">
        <button className="btn btn-secondary btn-icon" onClick={() => setBpm(bpm - 1)}><Icon name="minus" className="ic ic16" /></button>
        <div className="tc"><div className="bpmnum">{bpm}</div><div className="kick tc" style={{ marginTop: 4 }}>BPM</div></div>
        <button className="btn btn-secondary btn-icon" onClick={() => setBpm(bpm + 1)}><Icon name="plus" className="ic ic16" /></button>
      </div>
      <input className="slider" type="range" min={30} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
      <div className="dots">{beatDots.map((cls, i) => <span key={i} className={cls} />)}</div>
      <button className="btn btn-primary btn-block" onClick={toggleRun}>{run ? 'Stop' : 'Start'}</button>
      <div className="mt16">
        <button className="setrow" onClick={() => setMetMenu('ts')}>Time signature<span className="setval">{TS[tsIdx]}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(metMenu === 'ts') }} /></button>
        {metMenu === 'ts' && (
          <div className="optwrap">{TS.map((t, i) => <button key={i} className={`optbtn${i === tsIdx ? ' on' : ''}`} onClick={() => setTsIdx(i)}>{t}</button>)}</div>
        )}
        <button className="setrow" onClick={() => setMetMenu('acc')}>Beat accent<span className="setval">{accent === 0 ? 'None' : accent}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(metMenu === 'acc') }} /></button>
        {metMenu === 'acc' && (
          <div className="optwrap">
            <button className={`optbtn${accent === 0 ? ' on' : ''}`} onClick={() => setAccent(0)}>No accent</button>
            {Array.from({ length: beats }, (_, i) => <button key={i} className={`optbtn${i + 1 === accent ? ' on' : ''}`} onClick={() => setAccent(i + 1)}>Beat {i + 1}</button>)}
          </div>
        )}
        <button className="setrow" onClick={() => setMetMenu('sound')}>Sound<span className="setval">{SOUNDS[soundIdx]}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(metMenu === 'sound') }} /></button>
        {metMenu === 'sound' && (
          <div className="optwrap">{SOUNDS.map((s, i) => <button key={i} className={`optbtn${i === soundIdx ? ' on' : ''}`} onClick={() => setSoundIdx(i)}>{s}</button>)}</div>
        )}
      </div>
    </div>
  );
}

function Tuner() {
  const listening = useStore((s) => s.listening);
  const heard = useStore((s) => s.heard);
  const cents = useStore((s) => s.cents);
  const hz = useStore((s) => s.hz);
  const toggleListen = useStore((s) => s.toggleListen);

  const centsLabel = `${cents > 0 ? '+' : ''}${cents} cents · ${hz} Hz`;
  const ticks = [-60, -45, -30, -15, 0, 15, 30, 45, 60];

  return (
    <div className="scr">
      <p className="kick" style={{ marginTop: 6 }}>Chromatic tuner · A = 440 Hz</p>
      <div className="gauge">
        <div className="garc" />
        {ticks.map((deg) => (
          <div key={deg} className={`gtick${deg % 30 === 0 ? ' big' : ''}`} style={{ transform: `rotate(${deg}deg)` }}><i /></div>
        ))}
        <div className="needle" style={{ transform: `rotate(${cents * 1.2}deg)` }} />
        <div className="npivot" />
        <span className="glab" style={{ left: 8 }}>−50</span>
        <span className="glab" style={{ right: 8 }}>+50</span>
      </div>
      {heard ? (
        <div className="tc mt8"><span className="bignote">{heard}</span><span className="rsub" style={{ marginLeft: 8 }}>{centsLabel}</span></div>
      ) : (
        <p className="rsub tc mt16">{listening ? 'Listening for a pitch…' : 'Play a note'}</p>
      )}
      <button className="btn btn-primary btn-block mt16" onClick={toggleListen}>{listening ? 'Stop listening' : 'Start listening'}</button>
      <p className="rsub mt12">{listening ? 'Listening… play a long, steady bow stroke.' : 'Uses your microphone — tap start and play a note.'}</p>
    </div>
  );
}

function Drone() {
  const droneNote = useStore((s) => s.droneNote);
  const droneOct = useStore((s) => s.droneOct);
  const dronePlay = useStore((s) => s.dronePlay);
  const setDroneNote = useStore((s) => s.setDroneNote);
  const setDroneOct = useStore((s) => s.setDroneOct);
  const toggleDrone = useStore((s) => s.toggleDrone);

  return (
    <div className="scr">
      <p className="kick" style={{ marginTop: 6 }}>Drone pitch</p>
      <div className="seg w100 mt8" style={{ justifyContent: 'center' }}>
        {[2, 3, 4].map((o) => (
          <label key={o} className="seg-opt f1 tc" style={{ justifyContent: 'center' }}>
            <input type="radio" name="droneOct" checked={o === droneOct} onChange={() => setDroneOct(o)} />
            C{o}–B{o}
          </label>
        ))}
      </div>
      <div className="notegrid">
        {NOTES.map((n) => (
          <button key={n} className={`notebtn${n === droneNote ? ' on' : ''}`} onClick={() => setDroneNote(n)}>{n}</button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={toggleDrone}>{dronePlay ? 'Stop drone' : 'Play drone'}</button>
      <p className="rsub mt12">A sustained reference pitch for intonation work. The C–G–D–A strings of the viola are a good place to start.</p>
    </div>
  );
}

function SightReading() {
  const srNum = useStore((s) => s.srNum);
  const srKeyIdx = useStore((s) => s.srKeyIdx);
  const srTsIdx = useStore((s) => s.srTsIdx);
  const srNotes = useStore((s) => s.srNotes);
  const srAdd = useStore((s) => s.srAdd);
  const srMenu = useStore((s) => s.srMenu);
  const setSrMenu = useStore((s) => s.setSrMenu);
  const setSrKeyIdx = useStore((s) => s.setSrKeyIdx);
  const setSrTsIdx = useStore((s) => s.setSrTsIdx);
  const toggleSrNote = useStore((s) => s.toggleSrNote);
  const toggleSrAdd = useStore((s) => s.toggleSrAdd);
  const newExercise = useStore((s) => s.newExercise);

  return (
    <div className="scr">
      <p className="kick" style={{ marginTop: 6 }}>Sight reading · exercise {srNum}</p>
      <div className="sheet" style={{ padding: '26px 0 0', cursor: 'default' }}>
        <div className="sys" style={{ marginBottom: 12 }}><span className="msr">{KEYS[srKeyIdx]} · {TS[srTsIdx]} · alto clef</span></div>
        {srAdd.includes('Treble clef part') && <div className="sys" style={{ marginBottom: 12 }}><span className="msr">treble clef part</span></div>}
      </div>
      <button className="setrow" onClick={() => setSrMenu('key')}>Key<span className="setval">{KEYS[srKeyIdx]}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(srMenu === 'key') }} /></button>
      {srMenu === 'key' && (
        <div className="optwrap">{KEYS.map((k, i) => <button key={i} className={`optbtn${i === srKeyIdx ? ' on' : ''}`} onClick={() => setSrKeyIdx(i)}>{k}</button>)}</div>
      )}
      <button className="setrow" onClick={() => setSrMenu('ts')}>Time signature<span className="setval">{TS[srTsIdx]}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(srMenu === 'ts') }} /></button>
      {srMenu === 'ts' && (
        <div className="optwrap">{TS.map((t, i) => <button key={i} className={`optbtn${i === srTsIdx ? ' on' : ''}`} onClick={() => setSrTsIdx(i)}>{t}</button>)}</div>
      )}
      <button className="setrow" onClick={() => setSrMenu('nv')}>Note types<span className="setval">{srNotes.length === 0 ? 'None selected' : `${srNotes.length} selected`}</span><Icon name="chevronRight" className="ic ic16 chev" style={{ transform: rot(srMenu === 'nv') }} /></button>
      {srMenu === 'nv' && (
        <div className="optwrap">
          {NVS.map((v) => <button key={v} className={`optbtn${srNotes.includes(v) ? ' on' : ''}`} onClick={() => toggleSrNote(v)}>{v}</button>)}
          <p className="rsub w100 m0" style={{ paddingTop: 2 }}>Select all that apply — the excerpt draws from your selection.</p>
        </div>
      )}
      <div className="kickrow"><p className="kick">Add to the exercise</p></div>
      {SROPTS.map((name) => (
        <button key={name} className="setrow" onClick={() => toggleSrAdd(name)}>{name}<span className={`chk${srAdd.includes(name) ? ' on' : ''}`} /></button>
      ))}
      <button className="btn btn-primary btn-block mt16" onClick={newExercise}>New exercise</button>
    </div>
  );
}
