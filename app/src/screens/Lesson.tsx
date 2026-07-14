import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { MARK_LABEL, MARK_NOTE } from '../lib/data';

export function Lesson() {
  const lesson = useStore((s) => s.lesson);
  const checkPick = useStore((s) => s.checkPick);
  const checkResult = useStore((s) => s.checkResult);
  const recState = useStore((s) => s.recState);
  const recSecs = useStore((s) => s.recSecs);
  const feedback = useStore((s) => s.feedback);
  const backLesson = useStore((s) => s.backLesson);
  const showToast = useStore((s) => s.showToast);
  const pickCheck = useStore((s) => s.pickCheck);
  const submitCheck = useStore((s) => s.submitCheck);
  const startRecording = useStore((s) => s.startRecording);
  const stopRecording = useStore((s) => s.stopRecording);
  const retryRecording = useStore((s) => s.retryRecording);

  if (!lesson) return null;

  const isQuiz = lesson.type === 'quiz';
  const isAudio = lesson.type === 'audio';
  const skill = lesson.skill;
  const markLabel = skill ? MARK_LABEL[skill] : 'check';
  const markNote = skill ? MARK_NOTE[skill] : 'AI checks your technique at the marked point.';
  const recSecsLabel = `0:${String(recSecs % 60).padStart(2, '0')}`;

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={backLesson}><Icon name="chevronLeft" /></button>
        <div className="f1">
          <div className="htitle" style={{ fontSize: 14 }}>{lesson.t}</div>
          <div className="rsub">{lesson.course}</div>
        </div>
      </div>
      <div className="scr">
        <div className="videobox" onClick={() => showToast('Playing lesson video')}>
          <Icon name="play" className="ic" style={{ width: 34, height: 34 }} />
          <span className="rsub" style={{ color: '#fff' }}>{lesson.d}</span>
        </div>
        <div className="kickrow"><p className="kick">Soundcheck</p></div>

        {isQuiz && (
          <>
            <p className="rtitle" style={{ marginBottom: 10 }}>{lesson.q}</p>
            {(lesson.opts ?? []).map((name, i) => (
              <button key={i} className="optbtn w100 mb8" style={{ display: 'block' }} onClick={() => pickCheck(i)}>
                <span className={`rdot${checkPick === i ? ' on' : ''}`} /> {name}
              </button>
            ))}
            <button className="btn btn-primary btn-block mt16" onClick={submitCheck} disabled={checkPick == null}>Check answer</button>
            {checkResult === 'correct' && <p className="rsub mt12" style={{ color: 'var(--color-accent-700)' }}>Correct — lesson marked complete.</p>}
            {checkResult === 'wrong' && <p className="rsub mt12">Not quite — rewatch the video and try again.</p>}
          </>
        )}

        {isAudio && (
          <>
            <p className="rsub mb12">Record yourself playing the excerpt below — AI compares it to the sheet music and checks your technique.</p>
            <div className="banner">
              <div className="rtitle">{lesson.target}</div>
              <div className="rsub mt8">{lesson.excerpt}</div>
            </div>
            {lesson.markMeasure != null && (
              <>
                <div className="sheet" style={{ cursor: 'default', padding: '20px 8px 4px' }}>
                  <div className="sys" style={{ marginBottom: 8 }}>
                    <span className="mark" style={{ left: `${(lesson.markMeasure ?? 0) * 60}px`, top: -6, fontSize: 10, color: 'var(--color-accent-700)' }}>{markLabel}</span>
                  </div>
                </div>
                <p className="rsub" style={{ marginTop: -4 }}>{markNote}</p>
              </>
            )}
            {recState === 'idle' && <button className="btn btn-primary btn-block mt16" onClick={startRecording}>Start recording</button>}
            {recState === 'recording' && (
              <div className="tc mt16">
                <div className="bignote" style={{ fontSize: 40, color: 'var(--color-accent)' }}>{recSecsLabel}</div>
                <p className="rsub mt8">Recording — play the excerpt now</p>
                <button className="btn btn-secondary btn-block mt16" onClick={stopRecording}>Stop and analyze</button>
              </div>
            )}
            {recState === 'analyzing' && <p className="rsub tc mt16">Analyzing your recording against the sheet music…</p>}
            {recState === 'done' && feedback && (
              <div className="mt16">
                <div className="fx ac jb"><p className="kick m0">Match score</p><span className="bignum">{feedback.score}%</span></div>
                <div className="prog mt8"><i style={{ width: `${feedback.score}%` }} /></div>
                <p className="kick mt16">What you did well</p>
                {feedback.strengths.map((s, i) => <p key={i} className="rsub mt8">✓ {s}</p>)}
                <p className="kick mt16">What to work on</p>
                {feedback.work.map((w, i) => <p key={i} className="rsub mt8">→ {w}</p>)}
                <button className="btn btn-secondary btn-block mt16" onClick={retryRecording}>Record again</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
