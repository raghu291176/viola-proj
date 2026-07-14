// Real notation rendering via Verovio (WASM) — replaces the prototype's fake
// staff lines. Every note becomes an SVG element with a stable id, so per-note
// feedback can recolor the exact note (the teaching core, ARCHITECTURE.md §4.4).
import { useEffect, useRef, useState } from 'react';
import type { VerovioToolkit } from 'verovio/esm';
import type { NoteVerdict, VerdictKind } from '../lib/types';

const COLORS: Record<VerdictKind, string> = {
  good: '#16a34a',   // green — in tune / in time
  sharp: '#dc2626',  // red
  flat: '#dc2626',
  late: '#d97706',   // amber — timing
  early: '#d97706',
  wrong: '#dc2626',
  missing: '#9ca3af',
};

// One shared Verovio toolkit for the whole app (the WASM module is a few MB).
let tkPromise: Promise<VerovioToolkit> | null = null;
function getToolkit(): Promise<VerovioToolkit> {
  if (!tkPromise) {
    tkPromise = (async () => {
      const createVerovioModule = (await import('verovio/wasm')).default;
      const { VerovioToolkit } = await import('verovio/esm');
      const mod = await createVerovioModule();
      return new VerovioToolkit(mod);
    })();
  }
  return tkPromise;
}

function paintVerdicts(root: HTMLElement, verdicts: NoteVerdict[]): void {
  // Clear previous coloring.
  root.querySelectorAll<SVGElement>('g.note.vh-marked').forEach((g) => {
    g.classList.remove('vh-marked');
    g.querySelectorAll<SVGElement>('path, ellipse, rect, use').forEach((s) => {
      s.style.fill = '';
      s.style.stroke = '';
    });
  });
  for (const v of verdicts) {
    const g = root.querySelector<SVGGElement>(`#${CSS.escape(v.noteId)}`);
    if (!g) continue;
    g.classList.add('vh-marked');
    const color = COLORS[v.kind];
    g.querySelectorAll<SVGElement>('path, ellipse, rect, use').forEach((s) => {
      s.style.fill = color;
      s.style.stroke = color;
    });
  }
}

interface Props {
  /** MusicXML document to render. */
  xml: string;
  /** Optional per-note verdicts — recolor the exact notes. */
  verdicts?: NoteVerdict[];
  /** Reports the ordered note ids once rendered (for building verdict maps). */
  onNotes?: (ids: string[]) => void;
}

export function MusicSheet({ xml, verdicts, onNotes }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tk = await getToolkit();
        if (cancelled) return;
        const width = hostRef.current?.clientWidth ?? 360;
        tk.setOptions({
          pageWidth: Math.max(320, width) * 2.2, // Verovio units (÷ scale)
          scale: 45,
          adjustPageHeight: true,
          breaks: 'auto',
          header: 'none',
          footer: 'none',
          spacingStaff: 2,
          font: 'Bravura',
        });
        if (!tk.loadData(xml)) throw new Error('Verovio failed to load MusicXML');
        const svg = tk.renderToSVG(1);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        // Make the SVG scale to the container width.
        const el = hostRef.current.querySelector('svg');
        if (el) { el.removeAttribute('height'); el.setAttribute('width', '100%'); }
        const ids = Array.from(hostRef.current.querySelectorAll<SVGGElement>('g.note'))
          .map((g) => g.id).filter(Boolean);
        onNotes?.(ids);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [xml, onNotes]);

  useEffect(() => {
    if (status === 'ready' && hostRef.current && verdicts) {
      paintVerdicts(hostRef.current, verdicts);
    }
  }, [verdicts, status]);

  return (
    <div className="musicsheet">
      <div ref={hostRef} />
      {status === 'loading' && <p className="rsub tc" style={{ padding: 16 }}>Rendering score…</p>}
      {status === 'error' && <p className="rsub tc" style={{ padding: 16 }}>Couldn't render this score.</p>}
    </div>
  );
}
