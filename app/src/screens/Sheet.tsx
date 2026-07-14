import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { MusicSheet } from '../components/MusicSheet';
import { TS } from '../lib/constants';
import { scoreFor } from '../lib/scores';

export function Sheet() {
  const piece = useStore((s) => s.piece);
  const overlay = useStore((s) => s.overlay);
  const annTool = useStore((s) => s.annTool);
  const bowDir = useStore((s) => s.bowDir);
  const finger = useStore((s) => s.finger);
  const marks = useStore((s) => s.marks);
  const strokes = useStore((s) => s.strokes);
  const bpm = useStore((s) => s.bpm);
  const run = useStore((s) => s.run);
  const beat = useStore((s) => s.beat);
  const accent = useStore((s) => s.accent);
  const tsIdx = useStore((s) => s.tsIdx);
  const listening = useStore((s) => s.listening);
  const heard = useStore((s) => s.heard);
  const cents = useStore((s) => s.cents);
  const hz = useStore((s) => s.hz);
  const plan = useStore((s) => s.plan);

  const back = useStore((s) => s.back);
  const setOverlay = useStore((s) => s.setOverlay);
  const showToast = useStore((s) => s.showToast);
  const toggleRun = useStore((s) => s.toggleRun);
  const setBpm = useStore((s) => s.setBpm);
  const toggleListen = useStore((s) => s.toggleListen);
  const addMark = useStore((s) => s.addMark);
  const penDown = useStore((s) => s.penDown);
  const penMove = useStore((s) => s.penMove);
  const penUp = useStore((s) => s.penUp);
  const setAnnTool = useStore((s) => s.setAnnTool);
  const setBowDir = useStore((s) => s.setBowDir);
  const setFinger = useStore((s) => s.setFinger);
  const undoMark = useStore((s) => s.undoMark);
  const aiMark = useStore((s) => s.aiMark);

  const beats = parseInt(TS[tsIdx], 10);
  const beatDots = Array.from({ length: beats }, (_, i) => `dot2${i === beat && run ? ' hit' : i === accent - 1 ? ' acc' : ''}`);
  const subbed = plan !== 'Free plan';
  const centsLabel = `${cents > 0 ? '+' : ''}${cents} cents · ${hz} Hz`;

  const coords = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) };
  };
  const onSheetClick = (e: ReactMouseEvent<HTMLDivElement>) => { const { x, y } = coords(e); addMark(x, y); };
  const onPenDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const { x, y } = coords(e); penDown(x, y);
  };
  const onPenMove = (e: ReactPointerEvent<HTMLDivElement>) => { const { x, y } = coords(e); penMove(x, y); };

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={back}><Icon name="chevronLeft" /></button>
        <div className="f1">
          <div className="htitle" style={{ fontSize: 14 }}>{piece?.t}</div>
          <div className="rsub">{piece?.s}</div>
        </div>
        <button className={`iconbtn${overlay === 'met' ? ' on' : ''}`} onClick={() => setOverlay('met')}><Icon name="metronome" /></button>
        <button className={`iconbtn${overlay === 'tun' ? ' on' : ''}`} onClick={() => setOverlay('tun')}><Icon name="mic" /></button>
        <button className="iconbtn" onClick={() => showToast('Saved to bookmarks')}><Icon name="bookmark" /></button>
      </div>

      {overlay === 'met' && (
        <div className="ovpanel">
          <span className="kick">Metronome</span>
          <button className="btn btn-secondary btn-icon" onClick={() => setBpm(bpm - 1)}><Icon name="minus" className="ic ic16" /></button>
          <span className="ovbpm">{bpm}</span>
          <button className="btn btn-secondary btn-icon" onClick={() => setBpm(bpm + 1)}><Icon name="plus" className="ic ic16" /></button>
          <div className="dots" style={{ margin: 0 }}>{beatDots.map((cls, i) => <span key={i} className={cls} />)}</div>
          <button className="btn btn-primary mla" onClick={toggleRun}>{run ? 'Stop' : 'Start'}</button>
        </div>
      )}
      {overlay === 'tun' && (
        <div className="ovpanel">
          <span className="kick">Tuner</span>
          <span className="ovbpm">{heard ?? ''}</span>
          <span className="rsub">{centsLabel}</span>
          <div className="ovbar"><div className="ovmid" /><div className="ovneedle" style={{ left: `calc(50% + ${cents * 0.7}px)` }} /></div>
          <button className="btn btn-primary mla" onClick={toggleListen}>{listening ? 'Stop listening' : 'Start listening'}</button>
        </div>
      )}

      <div className="scr" style={{ padding: 0 }}>
        <div className="fx ac gap8" style={{ padding: '12px 16px 0' }}>
          <p className="rsub m0 f1">Pick a tool below, tap the staff to mark up — free.</p>
          <button className="btn btn-ghost" onClick={aiMark}>{subbed ? 'AI markup' : 'AI markup · subscribers'}</button>
        </div>
        <div
          className="sheet"
          onClick={onSheetClick}
          onPointerDown={onPenDown}
          onPointerMove={onPenMove}
          onPointerUp={penUp}
          onPointerLeave={penUp}
          style={{ touchAction: 'none' }}
        >
          <MusicSheet xml={scoreFor(piece?.t)} />
          {marks.map((m, i) => (
            <span key={i} className="mark" style={{ left: `${m.x}px`, top: `${m.y}px` }}>{m.sym}</span>
          ))}
          <svg className="ink">
            {strokes.map((k, i) => (
              <polyline key={i} points={k.pts} fill="none" stroke="var(--color-accent-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
      </div>

      {annTool === 'bow' && (
        <div className="fx ac gap8" style={{ padding: '8px 16px', borderTop: '1px solid var(--color-divider)' }}>
          <span className="kick">Bow direction</span>
          <button className={`btn ${bowDir === 'up' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBowDir('up')}>∨ Up bow</button>
          <button className={`btn ${bowDir === 'dn' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBowDir('dn')}>∏ Down bow</button>
        </div>
      )}
      {annTool === 'fing' && (
        <div className="fx ac gap8" style={{ padding: '8px 16px', borderTop: '1px solid var(--color-divider)' }}>
          <span className="kick">Finger</span>
          {['0', '1', '2', '3', '4'].map((n) => (
            <button key={n} className={`btn btn-icon ${n === finger ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFinger(n)}>{n}</button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <button className={`tool${annTool === 'select' ? ' on' : ''}`} onClick={() => setAnnTool('select')}><Icon name="select" className="ic ic16" />Select</button>
        <button className={`tool${annTool === 'fing' ? ' on' : ''}`} onClick={() => setAnnTool('fing')}><Icon name="hand" className="ic ic16" />Fingerings</button>
        <button className={`tool${annTool === 'bow' ? ' on' : ''}`} onClick={() => setAnnTool('bow')}><Icon name="chevronDown" className="ic ic16" />Bowings</button>
        <button className={`tool${annTool === 'pen' ? ' on' : ''}`} onClick={() => setAnnTool('pen')}><Icon name="pen" className="ic ic16" />Annotate</button>
      </div>
      <div className="actbar">
        <button className="btn btn-secondary" onClick={undoMark}>Undo</button>
        <button className="btn btn-primary f1" onClick={() => showToast('Annotations saved')}>Save</button>
        <button className="btn btn-ghost" onClick={() => showToast('Share sheet opens here')}>Share</button>
      </div>
    </div>
  );
}
