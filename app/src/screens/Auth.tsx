import { useState } from 'react';
import { useStore } from '../store';

// Registration + login. Shown only when a backend is configured (see App gate),
// so the offline preview isn't blocked. Teachers register here.
export function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('teacher');

  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const busy = useStore((s) => s.authBusy);
  const error = useStore((s) => s.authError);
  const clearAuthError = useStore((s) => s.clearAuthError);

  const submit = () => {
    if (mode === 'login') login(email.trim(), password);
    else register(email.trim(), password, name.trim(), role);
  };

  return (
    <div className="col f1 ohide">
      <div className="hdr"><span className="brand">VIOLAHUB<span className="bdot">.</span></span></div>
      <div className="scr">
        <h3 className="m0" style={{ fontSize: 24 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
        <p className="rsub mt8">{mode === 'login' ? 'Log in to continue.' : 'For teachers and their students.'}</p>

        {mode === 'register' && (
          <>
            <div className="kickrow"><p className="kick">Name</p></div>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); clearAuthError(); }} placeholder="Your name" />
          </>
        )}
        <div className="kickrow"><p className="kick">Email</p></div>
        <input className="input" type="email" autoCapitalize="none" value={email} onChange={(e) => { setEmail(e.target.value); clearAuthError(); }} placeholder="you@example.com" />
        <div className="kickrow"><p className="kick">Password</p></div>
        <input className="input" type="password" value={password} onChange={(e) => { setPassword(e.target.value); clearAuthError(); }} placeholder="At least 8 characters" />

        {mode === 'register' && (
          <>
            <div className="kickrow"><p className="kick">I am a</p></div>
            <div className="seg w100">
              <label className="seg-opt f1 tc" style={{ justifyContent: 'center' }}>
                <input type="radio" name="role" checked={role === 'teacher'} onChange={() => setRole('teacher')} />Teacher
              </label>
              <label className="seg-opt f1 tc" style={{ justifyContent: 'center' }}>
                <input type="radio" name="role" checked={role === 'student'} onChange={() => setRole('student')} />Student
              </label>
            </div>
          </>
        )}

        {error && <p className="rsub mt12" style={{ color: 'var(--color-accent-700)' }}>{error}</p>}

        <button className="btn btn-primary btn-block mt16" onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearAuthError(); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        </button>
      </div>
    </div>
  );
}
