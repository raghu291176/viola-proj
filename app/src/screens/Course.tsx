import { useStore } from '../store';
import { Icon } from '../components/Icon';

export function Course() {
  const course = useStore((s) => s.course);
  const done = useStore((s) => s.done);
  const back = useStore((s) => s.back);
  const openLesson = useStore((s) => s.openLesson);

  if (!course) return null;

  return (
    <div className="col f1 ohide">
      <div className="hdr">
        <button className="iconbtn" onClick={back}><Icon name="chevronLeft" /></button>
        <div className="f1">
          <div className="htitle" style={{ fontSize: 14 }}>{course.t}</div>
          <div className="rsub">{course.s}</div>
        </div>
      </div>
      <div className="scr">
        {course.lessons.map((l, idx) => (
          <button key={idx} className="rowbtn" onClick={() => openLesson(course, l, idx)}>
            <div className="thumb">{done[`${course.t}|${idx}`] ? '✓' : '▶'}</div>
            <div className="f1">
              <div className="rtitle">{l.t}</div>
              <div className="rsub">{l.d} · {l.type === 'quiz' ? 'quiz' : 'record & AI check'}</div>
            </div>
            <Icon name="chevronRight" className="ic ic16 chev" />
          </button>
        ))}
      </div>
    </div>
  );
}
