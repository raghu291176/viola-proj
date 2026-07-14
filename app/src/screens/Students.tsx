import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { LEVELS } from '../lib/constants';

// Teacher's home: the student roster. Tap a student to assess them.
export function Students() {
  const students = useStore((s) => s.students);
  const authName = useStore((s) => s.authName);
  const addStudent = useStore((s) => s.addStudent);
  const removeStudent = useStore((s) => s.removeStudent);
  const assessStudent = useStore((s) => s.assessStudent);

  const [name, setName] = useState('');
  const [level, setLevel] = useState('Intermediate');

  const add = () => { addStudent(name, level); setName(''); };

  return (
    <div className="col f1 ohide">
      <div className="hdr jb">
        <span className="brand">VIOLAHUB<span className="bdot">.</span></span>
        <span className="htitle">Students</span>
      </div>
      <div className="scr">
        <h3 className="m0" style={{ fontSize: 22 }}>{authName ? `Welcome, ${authName}.` : 'Your students'}</h3>
        <p className="rsub mt8">Record and grade a student to build their history.</p>

        <div className="kickrow"><p className="kick">Add a student</p></div>
        <input className="input" placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="seg w100 mt8">
          {LEVELS.map((lv) => (
            <label key={lv} className="seg-opt f1 tc" style={{ justifyContent: 'center' }}>
              <input type="radio" name="newLevel" checked={level === lv} onChange={() => setLevel(lv)} />{lv}
            </label>
          ))}
        </div>
        <button className="btn btn-secondary btn-block" onClick={add}>Add student</button>

        <div className="kickrow"><p className="kick">Roster</p><span className="rsub mla">{students.length}</span></div>
        {students.length === 0 && <p className="rsub">No students yet — add one above.</p>}
        {students.map((st) => (
          <div key={st.name} className="rowbtn" style={{ cursor: 'default' }}>
            <div className="avatar sm">{st.name.charAt(0).toUpperCase()}</div>
            <div className="f1"><div className="rtitle">{st.name}</div><div className="rsub">{st.level}</div></div>
            <button className="btn btn-primary" onClick={() => assessStudent(st.name, st.level)}>Assess</button>
            <button className="iconbtn" onClick={() => removeStudent(st.name)} aria-label={`Remove ${st.name}`}>
              <Icon name="minus" className="ic ic16" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
