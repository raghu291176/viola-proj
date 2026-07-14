import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { MusicSheet } from '../components/MusicSheet';
import { scoreFor } from '../lib/scores';
import { ASSESS_SKILLS, LEVELS, GRADE_LABELS } from '../lib/constants';

// The data-collection instrument: a teacher records a student, grades their
// technique, and captures consent. Each saved assessment is a labeled training
// record for the technique-quality models (ARCHITECTURE.md §4.3 data moat).
export function Assess() {
  const a = useStore((s) => s.assess);
  const count = useStore((s) => s.assessCount);
  const goTab = useStore((s) => s.goTab);
  const setAssess = useStore((s) => s.setAssess);
  const gradeSkill = useStore((s) => s.gradeSkill);
  const startAssessRec = useStore((s) => s.startAssessRec);
  const stopAssessRec = useStore((s) => s.stopAssessRec);
  const saveAssessment = useStore((s) => s.saveAssessment);

  const recSecsLabel = `0:${String(a.recSecs % 60).padStart(2, '0')}`;

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={() => goTab('students')}><Icon name="chevronLeft" /></button>
        <div className="f1"><div className="htitle" style={{ fontSize: 14 }}>Assessment</div><div className="rsub">{count} collected</div></div>
      </div>
      <div className="scr">
        <div className="kickrow" style={{ marginTop: 0 }}><p className="kick">Student</p></div>
        <input className="input" placeholder="Student name" value={a.student} onChange={(e) => setAssess({ student: e.target.value })} />
        <div className="seg w100 mt8">
          {LEVELS.map((lv) => (
            <label key={lv} className="seg-opt f1 tc" style={{ justifyContent: 'center' }}>
              <input type="radio" name="asLevel" checked={a.level === lv} onChange={() => setAssess({ level: lv })} />
              {lv}
            </label>
          ))}
        </div>

        <div className="kickrow"><p className="kick">Excerpt · {a.pieceTitle}</p></div>
        <MusicSheet xml={scoreFor(a.pieceTitle)} verdicts={a.verdicts} />

        <div className="kickrow"><p className="kick">Recording</p></div>
        {a.recState === 'idle' && <button className="btn btn-primary btn-block" onClick={startAssessRec}>Start recording</button>}
        {a.recState === 'recording' && (
          <div className="tc">
            <div className="bignote" style={{ fontSize: 40, color: 'var(--color-accent)' }}>{recSecsLabel}</div>
            <button className="btn btn-secondary btn-block" onClick={stopAssessRec}>Stop</button>
          </div>
        )}
        {a.recState === 'done' && (
          <div className="fx ac gap8">
            <span className="rsub f1">Recorded {recSecsLabel} — ready to grade.</span>
            <button className="btn btn-ghost" onClick={startAssessRec}>Re-record</button>
          </div>
        )}

        <div className="kickrow"><p className="kick">Teacher grade</p></div>
        {ASSESS_SKILLS.map((skill) => (
          <div key={skill} style={{ marginBottom: 8 }}>
            <div className="fx ac">
              <span className="rtitle f1">{skill}</span>
              <span className="rsub">{GRADE_LABELS[a.grades[skill] ?? 0]}</span>
            </div>
            <div className="fx gap8 mt8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`btn btn-icon ${a.grades[skill] === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => gradeSkill(skill, n)}>{n}</button>
              ))}
            </div>
          </div>
        ))}

        <div className="kickrow"><p className="kick">Notes</p></div>
        <textarea className="input" placeholder="What to work on, what went well…" value={a.notes} onChange={(e) => setAssess({ notes: e.target.value })} />

        <button className="setrow" onClick={() => setAssess({ consent: !a.consent })}>
          Student / guardian consents to this recording being used to improve ViolaHub
          <span className={`chk${a.consent ? ' on' : ''}`} />
        </button>

        <button className="btn btn-primary btn-block mt16" onClick={saveAssessment}>Save assessment</button>
        <p className="rsub mt12">Saved assessments become labeled training data for the technique models — consent required.</p>
      </div>
    </div>
  );
}
