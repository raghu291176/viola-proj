import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';

// Browser-based sheet-music scan (nothing installed): getUserMedia camera →
// canvas capture → upload for OMR. Falls back to a file picker if there's no
// camera. All conversion (OMR → MusicXML) happens server-side.
export function Scan() {
  const back = useStore((s) => s.back);
  const submitScan = useStore((s) => s.submitScan);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<{ url: string; blob: Blob } | null>(null);
  const [camError, setCamError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCamError(true));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 960;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (b) setCaptured({ url: URL.createObjectURL(b), blob: b }); }, 'image/jpeg', 0.9);
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCaptured({ url: URL.createObjectURL(f), blob: f });
  };
  const retake = () => { if (captured) URL.revokeObjectURL(captured.url); setCaptured(null); };

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={back}><Icon name="chevronLeft" /></button>
        <span className="htitle">Scan sheet music</span>
      </div>
      <div className="scr">
        <p className="rsub m0">Point your camera at a page. It converts to real notation in your library.</p>
        <div className="scanbox mt12">
          {captured
            ? <img src={captured.url} alt="Captured sheet music" />
            : camError
              ? <p className="rsub tc" style={{ padding: 24, color: '#fff' }}>Camera unavailable — use the file option below.</p>
              : <video ref={videoRef} autoPlay playsInline muted />}
        </div>

        {!captured && !camError && <button className="btn btn-primary btn-block mt12" onClick={capture}>Capture</button>}
        {captured && (
          <div className="fx gap8 mt12">
            <button className="btn btn-secondary f1" onClick={retake}>Retake</button>
            <button className="btn btn-primary f1" onClick={() => submitScan(captured.blob)}>Use this scan</button>
          </div>
        )}

        <div className="kickrow"><p className="kick">Or choose a file</p></div>
        <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer' }}>
          Image or PDF
          <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={onFile} />
        </label>
      </div>
    </div>
  );
}
