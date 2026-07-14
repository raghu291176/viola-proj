// ViolaHub global store (Zustand). Ports the prototype's single `state` object
// and its actions, organized by domain, and drives the Web Audio engine.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TS, NOTES, KEYS, BILLING_ENABLED } from '../lib/constants';
import { FEEDBACK_BANKS } from '../lib/data';
import { metronome, drone, tuner, setReferenceA, type MetParams } from '../lib/audio';
import {
  apiEnabled, runFeedbackAnalysis, uploadRecording, submitAssessment,
  authToken, setAuthToken, login as apiLogin, register as apiRegister,
} from '../lib/api';
import { startMicRecording, stopMicRecording, cancelMicRecording, recordingSupported } from '../lib/recorder';
import { liveEngine, type LiveCue } from '../lib/realtime';
import type {
  Device, Tab, Sub, HomeVariant, Plan, PracticeTool, AnnTool, BowDir, Browse,
  Overlay, LearnTab, TransSource, RecState, MetMenu, SrMenu,
  Piece, Course, Lesson, Mark, Stroke, Feedback, NoteVerdict, Role, Student,
} from '../lib/types';

// Module-level timers / transient flags (not React state).
let toastTimer: ReturnType<typeof setTimeout>;
let recTimer: ReturnType<typeof setInterval>;
let fbTimer: ReturnType<typeof setTimeout>;
let transTimer: ReturnType<typeof setTimeout>;
let drawing = false;
let usingRealRecorder = false;
let assessTimer: ReturnType<typeof setInterval>;
let assessBlob: Blob | null = null;
let assessUsingMic = false;

export interface AssessDraft {
  student: string;
  level: string;
  pieceTitle: string;
  grades: Record<string, number>;   // skill → 1..5
  notes: string;
  consent: boolean;
  recState: RecState;
  recSecs: number;
  verdicts: NoteVerdict[];
}

function beatsOf(tsIdx: number): number {
  return parseInt(TS[tsIdx], 10);
}

export interface StoreState {
  // nav
  device: Device;
  tab: Tab;
  sub: Sub;
  hv: HomeVariant;
  toast: string | null;
  // account
  plan: Plan;
  // music
  q: string;
  browse: Browse | null;
  piece: Piece | null;
  recentOpened: Piece[];
  overlay: Overlay;
  // annotation
  annTool: AnnTool;
  bowDir: BowDir;
  finger: string;
  marks: Mark[];
  strokes: Stroke[];
  // metronome
  bpm: number;
  run: boolean;
  beat: number;
  tsIdx: number;
  accent: number;
  soundIdx: number;
  metMenu: MetMenu;
  // tuner
  listening: boolean;
  heard: string | null;
  cents: number;
  hz: number;
  refA: number;                 // reference pitch A4 in Hz (orchestral: 442/443)
  // live (T1 on-device real-time)
  liveCue: LiveCue | null;
  // drone
  droneNote: string;
  droneOct: number;
  dronePlay: boolean;
  // practice + sight reading
  prTool: PracticeTool;
  srMenu: SrMenu;
  srNum: number;
  srKeyIdx: number;
  srTsIdx: number;
  srNotes: string[];
  srAdd: string[];
  // learn
  learnTab: LearnTab;
  course: Course | null;
  lesson: Lesson | null;
  checkPick: number | null;
  checkResult: 'correct' | 'wrong' | null;
  done: Record<string, boolean>;
  recState: RecState;
  recSecs: number;
  feedback: Feedback | null;
  // transcription
  src: TransSource;
  trans: boolean;
  // teacher assessment (data-collection flywheel)
  assess: AssessDraft;
  assessCount: number;
  // auth + role
  authed: boolean;
  authName: string;
  authRole: string;
  authError: string;
  authBusy: boolean;
  role: Role;                 // drives which set of screens (teacher vs student)
  students: Student[];        // a teacher's roster

  // ── derived ──
  subbed: () => boolean;
  beats: () => number;

  // ── nav actions ──
  setDevice: (d: Device) => void;
  setHv: (hv: HomeVariant) => void;
  goTab: (tab: Tab) => void;
  goToolH: (prTool: PracticeTool) => void;
  back: () => void;
  showToast: (msg: string) => void;

  // ── music actions ──
  setQ: (q: string) => void;
  openPiece: (p: Piece) => void;
  openSheet: () => void;
  openTrans: () => void;
  openComm: () => void;
  openPro: () => void;
  setOverlay: (o: Overlay) => void;

  // ── annotation actions ──
  setAnnTool: (t: AnnTool) => void;
  setBowDir: (d: BowDir) => void;
  setFinger: (f: string) => void;
  addMark: (x: number, y: number) => void;
  penDown: (x: number, y: number) => void;
  penMove: (x: number, y: number) => void;
  penUp: () => void;
  undoMark: () => void;
  aiMark: () => void;

  // ── metronome actions ──
  toggleRun: () => void;
  setBpm: (bpm: number) => void;
  setTsIdx: (i: number) => void;
  setAccent: (a: number) => void;
  setSoundIdx: (i: number) => void;
  setMetMenu: (m: MetMenu) => void;

  // ── tuner action ──
  toggleListen: () => void;
  setRefA: (hz: number) => void;

  // ── live cue (T1) ──
  startLiveCue: () => void;
  stopLiveCue: () => void;

  // ── drone actions ──
  toggleDrone: () => void;
  setDroneNote: (n: string) => void;
  setDroneOct: (o: number) => void;

  // ── practice + sight reading ──
  setPrTool: (t: PracticeTool) => void;
  setSrMenu: (m: SrMenu) => void;
  setSrKeyIdx: (i: number) => void;
  setSrTsIdx: (i: number) => void;
  toggleSrNote: (v: string) => void;
  toggleSrAdd: (name: string) => void;
  newExercise: () => void;

  // ── learn actions ──
  setLearnTab: (t: LearnTab) => void;
  openCourse: (c: Course) => void;
  openLesson: (course: Course, lesson: Lesson, idx: number) => void;
  backLesson: () => void;
  pickCheck: (i: number) => void;
  submitCheck: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  retryRecording: () => void;

  // ── transcription ──
  setSrc: (s: TransSource) => void;
  doTrans: () => void;

  // ── account ──
  upgrade: () => void;

  // ── teacher assessment ──
  openAssess: () => void;
  setAssess: (p: Partial<AssessDraft>) => void;
  gradeSkill: (skill: string, n: number) => void;
  startAssessRec: () => void;
  stopAssessRec: () => void;
  saveAssessment: () => void;

  // ── auth ──
  login: (email: string, password: string) => void;
  register: (email: string, password: string, name: string, role: string) => void;
  logout: () => void;
  clearAuthError: () => void;

  // ── role + roster (teacher) ──
  setRole: (role: Role) => void;
  addStudent: (name: string, level: string) => void;
  removeStudent: (name: string) => void;
  assessStudent: (name: string, level: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      const metParams = (): MetParams => {
        const s = get();
        return { bpm: s.bpm, beats: beatsOf(s.tsIdx), accent: s.accent, soundIdx: s.soundIdx };
      };

      // Mark the lesson complete and show the scored feedback (real or simulated).
      const applyFeedback = (fb: Feedback): void => {
        const s = get();
        const l = s.lesson;
        set({
          recState: 'done',
          feedback: fb,
          done: l ? { ...s.done, [`${l.course}|${l.idx}`]: true } : s.done,
        });
        s.showToast('AI feedback ready — lesson complete');
      };

      // Offline fallback: synthesise plausible feedback from the skill's bank.
      const simulateFeedback = (): void => {
        clearTimeout(fbTimer);
        fbTimer = setTimeout(() => {
          const l = get().lesson;
          const bank = (l?.skill && FEEDBACK_BANKS[l.skill]) || FEEDBACK_BANKS.reading;
          const pick = (arr: string[], n: number) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
          applyFeedback({
            score: Math.floor(72 + Math.random() * 22),
            strengths: pick(bank.strengths, 2),
            work: pick(bank.work, 2),
          });
        }, 1800);
      };

      return {
        device: 'phone', tab: 'home', sub: null, hv: 'a', toast: null,
        plan: 'Subscriber',
        q: '', browse: null, piece: null,
        recentOpened: [
          { t: 'Telemann: Fantasia No. 2', s: 'Yesterday' },
          { t: 'Wohlfahrt: Op. 45 No. 1', s: '2 days ago' },
        ],
        overlay: null,
        annTool: 'select', bowDir: 'up', finger: '1', marks: [], strokes: [],
        bpm: 80, run: false, beat: -1, tsIdx: 2, accent: 1, soundIdx: 0, metMenu: null,
        listening: false, heard: null, cents: 0, hz: 0, refA: 442,
        liveCue: null,
        droneNote: 'A', droneOct: 3, dronePlay: false,
        prTool: 'met', srMenu: null, srNum: 1, srKeyIdx: 0, srTsIdx: 2,
        srNotes: ['Quarter notes', 'Eighth notes'], srAdd: [],
        learnTab: 'crs', course: null, lesson: null, checkPick: null, checkResult: null, done: {},
        recState: 'idle', recSecs: 0, feedback: null,
        src: 'file', trans: false,
        assess: {
          student: '', level: 'Intermediate', pieceTitle: 'Bach: Suite No. 1 in G Major',
          grades: {}, notes: '', consent: false, recState: 'idle', recSecs: 0, verdicts: [],
        },
        assessCount: 0,
        authed: authToken() !== '', authName: '', authRole: '', authError: '', authBusy: false,
        role: 'student', students: [],

        // Free during early access → everything unlocked regardless of plan.
        subbed: () => !BILLING_ENABLED || get().plan !== 'Free plan',
        beats: () => beatsOf(get().tsIdx),

        // nav
        setDevice: (device) => set({ device }),
        setHv: (hv) => set({ hv }),
        goTab: (tab) => set({ tab, sub: null }),
        goToolH: (prTool) => set({ tab: 'practice', sub: null, prTool }),
        back: () => set({ sub: null }),
        showToast: (msg) => {
          clearTimeout(toastTimer);
          set({ toast: msg });
          toastTimer = setTimeout(() => set({ toast: null }), 1900);
        },

        // music
        setQ: (q) => set({ q }),
        openPiece: (p) => set((s) => ({
          sub: 'sheet',
          piece: { t: p.t, s: p.s },
          recentOpened: [{ t: p.t, s: 'Just now' }, ...s.recentOpened.filter((r) => r.t !== p.t)].slice(0, 8),
        })),
        openSheet: () => get().openPiece({ t: 'Bach: Suite No. 1 in G Major', s: 'I. Allemande' }),
        openTrans: () => set({ sub: 'trans', tab: 'music' }),
        openComm: () => set({ sub: 'browse', browse: 'comm' }),
        openPro: () => set({ sub: 'browse', browse: 'pro' }),
        setOverlay: (overlay) => set((s) => ({ overlay: s.overlay === overlay ? null : overlay })),

        // annotation
        setAnnTool: (annTool) => set({ annTool }),
        setBowDir: (bowDir) => set({ bowDir }),
        setFinger: (finger) => set({ finger }),
        addMark: (x, y) => {
          const s = get();
          if (s.annTool === 'select' || s.annTool === 'pen') return;
          const sym = s.annTool === 'bow' ? (s.bowDir === 'up' ? '∨' : '∏') : s.finger;
          set({ marks: [...s.marks, { x, y, sym }] });
        },
        penDown: (x, y) => {
          if (get().annTool !== 'pen') return;
          drawing = true;
          set((s) => ({ strokes: [...s.strokes, { pts: `${x},${y}` }] }));
        },
        penMove: (x, y) => {
          if (!drawing || get().annTool !== 'pen') return;
          set((s) => {
            const ks = s.strokes.slice();
            const last = ks[ks.length - 1];
            ks[ks.length - 1] = { pts: `${last.pts} ${x},${y}` };
            return { strokes: ks };
          });
        },
        penUp: () => { drawing = false; },
        undoMark: () => set((s) => (s.strokes.length
          ? { strokes: s.strokes.slice(0, -1) }
          : { marks: s.marks.slice(0, -1) })),
        aiMark: () => {
          const s = get();
          if (!s.subbed()) { s.showToast('AI markup is part of the subscription — subscribe in Profile'); return; }
          const rand = (a: number, b: number) => a + Math.random() * (b - a);
          const syms = ['3', '1', '∨', '∏'];
          const ms = Array.from({ length: 8 }, () => ({
            x: Math.round(rand(30, 330)), y: Math.round(rand(30, 340)), sym: syms[Math.floor(Math.random() * 4)],
          }));
          set({ marks: [...s.marks, ...ms] });
          s.showToast('AI markup added — included in your subscription');
        },

        // metronome
        toggleRun: () => {
          const s = get();
          if (s.run) {
            metronome.stop();
            set({ run: false, beat: -1 });
          } else {
            set({ run: true, beat: 0 });
            metronome.start(metParams, (beat) => set({ beat }));
          }
        },
        setBpm: (bpm) => {
          bpm = Math.max(30, Math.min(240, bpm));
          set({ bpm });
          metronome.reschedule();
        },
        setTsIdx: (tsIdx) => set({ tsIdx, accent: 1, beat: -1 }),
        setAccent: (accent) => set({ accent }),
        setSoundIdx: (soundIdx) => set({ soundIdx }),
        setMetMenu: (m) => set((s) => ({ metMenu: s.metMenu === m ? null : m })),

        // tuner
        toggleListen: () => {
          const s = get();
          if (s.listening) { tuner.stop(); set({ listening: false }); return; }
          tuner.start((p) => set({ heard: p.heard, cents: p.cents, hz: p.hz }))
            .then(() => set({ listening: true }))
            .catch(() => s.showToast('Microphone access is needed for the tuner'));
        },
        setRefA: (hz) => {
          setReferenceA(hz);
          set({ refA: hz });
          const s = get();
          if (s.dronePlay) drone.retune(s.droneNote, s.droneOct);
        },

        // live cue (T1 on-device real-time)
        startLiveCue: () => {
          liveEngine.start((c) => set({ liveCue: c }))
            .catch(() => get().showToast('Microphone access is needed for live cues'));
        },
        stopLiveCue: () => { liveEngine.stop(); set({ liveCue: null }); },

        // drone
        toggleDrone: () => {
          const s = get();
          if (s.dronePlay) { drone.stop(); set({ dronePlay: false }); }
          else { drone.start(s.droneNote, s.droneOct); set({ dronePlay: true }); }
        },
        setDroneNote: (droneNote) => {
          set({ droneNote });
          const s = get();
          if (s.dronePlay) drone.retune(droneNote, s.droneOct);
        },
        setDroneOct: (droneOct) => {
          set({ droneOct });
          const s = get();
          if (s.dronePlay) drone.retune(s.droneNote, droneOct);
        },

        // practice + sight reading
        setPrTool: (prTool) => set({ prTool }),
        setSrMenu: (m) => set((s) => ({ srMenu: s.srMenu === m ? null : m })),
        setSrKeyIdx: (srKeyIdx) => set({ srKeyIdx }),
        setSrTsIdx: (srTsIdx) => set({ srTsIdx }),
        toggleSrNote: (v) => set((s) => ({
          srNotes: s.srNotes.includes(v) ? s.srNotes.filter((x) => x !== v) : [...s.srNotes, v],
        })),
        toggleSrAdd: (name) => set((s) => ({
          srAdd: s.srAdd.includes(name) ? s.srAdd.filter((x) => x !== name) : [...s.srAdd, name],
        })),
        newExercise: () => {
          const s = get();
          if (s.srNotes.length === 0) { s.showToast('Select at least one note type'); return; }
          set({ srNum: s.srNum + 1, srMenu: null });
          s.showToast(`Excerpt generated — ${KEY_AT(s.srKeyIdx)}, ${TS[s.srTsIdx]}`);
        },

        // learn
        setLearnTab: (learnTab) => set({ learnTab }),
        openCourse: (course) => set({ sub: 'course', course, lesson: null }),
        openLesson: (course, lesson, idx) => set({
          sub: 'lesson',
          lesson: { ...lesson, idx, course: course.t },
          checkPick: null, checkResult: null, recState: 'idle', recSecs: 0, feedback: null,
        }),
        backLesson: () => set({ sub: 'course', lesson: null }),
        pickCheck: (checkPick) => set({ checkPick }),
        submitCheck: () => {
          const s = get();
          const l = s.lesson;
          if (!l || s.checkPick == null) return;
          const ok = s.checkPick === l.a;
          set({
            checkResult: ok ? 'correct' : 'wrong',
            done: ok ? { ...s.done, [`${l.course}|${l.idx}`]: true } : s.done,
          });
          s.showToast(ok ? 'Correct — lesson complete' : 'Not quite — give it another watch');
        },
        startRecording: () => {
          clearInterval(recTimer);
          set({ recState: 'recording', recSecs: 0, feedback: null });
          recTimer = setInterval(() => set((s) => ({ recSecs: s.recSecs + 1 })), 1000);
          // Real mic capture when a backend is configured; otherwise simulate.
          usingRealRecorder = false;
          if (apiEnabled() && recordingSupported()) {
            startMicRecording().then(() => { usingRealRecorder = true; }).catch(() => { usingRealRecorder = false; });
          }
        },
        stopRecording: () => {
          clearInterval(recTimer);
          set({ recState: 'analyzing' });
          if (usingRealRecorder) {
            const skill = get().lesson?.skill ?? 'reading';
            stopMicRecording()
              .then((blob) => runFeedbackAnalysis(blob, skill))
              .then((fb) => applyFeedback(fb))
              .catch(() => simulateFeedback());   // network/mic failure → graceful fallback
          } else {
            simulateFeedback();
          }
        },
        retryRecording: () => {
          clearInterval(recTimer);
          clearTimeout(fbTimer);
          cancelMicRecording();
          usingRealRecorder = false;
          set({ recState: 'idle', recSecs: 0, feedback: null });
        },

        // transcription
        setSrc: (src) => set({ src }),
        doTrans: () => {
          const s = get();
          if (s.trans) return;
          clearTimeout(transTimer);
          set({ trans: true });
          transTimer = setTimeout(() => {
            set({ trans: false, sub: null, tab: 'music' });
            s.showToast('Transcription added to your library');
          }, 1600);
        },

        // account
        upgrade: () => {
          set({ plan: 'Subscriber' });
          get().showToast('Subscribed — courses unlocked');
        },

        // teacher assessment — the data-collection flywheel
        openAssess: () => set({ sub: 'assess' }),
        setAssess: (p) => set((s) => ({ assess: { ...s.assess, ...p } })),
        gradeSkill: (skill, n) => set((s) => ({
          assess: { ...s.assess, grades: { ...s.assess.grades, [skill]: n } },
        })),
        startAssessRec: () => {
          clearInterval(assessTimer);
          assessBlob = null;
          assessUsingMic = false;
          set((s) => ({ assess: { ...s.assess, recState: 'recording', recSecs: 0, verdicts: [] } }));
          assessTimer = setInterval(
            () => set((s) => ({ assess: { ...s.assess, recSecs: s.assess.recSecs + 1 } })), 1000);
          if (recordingSupported()) {
            startMicRecording().then(() => { assessUsingMic = true; }).catch(() => { assessUsingMic = false; });
          }
        },
        stopAssessRec: () => {
          clearInterval(assessTimer);
          if (assessUsingMic) stopMicRecording().then((b) => { assessBlob = b; }).catch(() => { /* mic ended */ });
          set((s) => ({ assess: { ...s.assess, recState: 'done' } }));
        },
        saveAssessment: () => {
          const s = get();
          const a = s.assess;
          if (!a.student.trim()) { s.showToast('Enter the student’s name first'); return; }
          if (!a.consent) { s.showToast('Consent is required to save a recording'); return; }
          // With a backend: upload the recording + submit the labels. Offline: keep the count.
          if (apiEnabled() && assessBlob) {
            uploadRecording(assessBlob, 'reading', a.level)
              .then((rid) => submitAssessment({
                student: a.student, level: a.level, piece_title: a.pieceTitle,
                grades: a.grades, notes: a.notes, consent: a.consent, recording_id: rid,
              }))
              .catch(() => { /* surfaced elsewhere; keep the local count */ });
          }
          const n = s.assessCount + 1;
          set({
            assessCount: n,
            assess: { ...a, student: '', grades: {}, notes: '', consent: false, recState: 'idle', recSecs: 0, verdicts: [] },
          });
          s.showToast(`Assessment saved · ${n} collected`);
        },

        // auth
        login: (email, password) => {
          set({ authBusy: true, authError: '' });
          apiLogin(email, password)
            .then((r) => { setAuthToken(r.token); get().setRole(r.role as Role); set({ authed: true, authName: r.name, authRole: r.role, authBusy: false }); })
            .catch(() => set({ authError: 'Invalid email or password.', authBusy: false }));
        },
        register: (email, password, name, role) => {
          set({ authBusy: true, authError: '' });
          apiRegister(email, password, name, role)
            .then((r) => { setAuthToken(r.token); get().setRole(r.role as Role); set({ authed: true, authName: r.name, authRole: r.role, authBusy: false }); })
            .catch(() => set({ authError: 'Could not register — that email may already be in use.', authBusy: false }));
        },
        logout: () => { setAuthToken(null); set({ authed: false, authName: '', authRole: '' }); },
        clearAuthError: () => set({ authError: '' }),

        // role + roster
        setRole: (role) => {
          const teacher = role === 'teacher' || role === 'admin';
          set({ role, tab: teacher ? 'students' : 'home', sub: null });
        },
        addStudent: (name, level) => {
          name = name.trim();
          if (!name) { get().showToast('Enter a student name'); return; }
          set((s) => (s.students.some((x) => x.name === name)
            ? {}
            : { students: [...s.students, { name, level }] }));
        },
        removeStudent: (name) => set((s) => ({ students: s.students.filter((x) => x.name !== name) })),
        assessStudent: (name, level) => set((s) => ({
          tab: 'assess', sub: null,
          assess: { ...s.assess, student: name, level },
        })),
      };
    },
    {
      name: 'violahub',
      // Persist only durable per-user preferences + library (not transient audio/timer state).
      partialize: (s) => ({
        device: s.device, hv: s.hv, plan: s.plan,
        recentOpened: s.recentOpened, done: s.done,
        bpm: s.bpm, tsIdx: s.tsIdx, soundIdx: s.soundIdx,
        droneNote: s.droneNote, droneOct: s.droneOct, refA: s.refA,
        srKeyIdx: s.srKeyIdx, srTsIdx: s.srTsIdx, srNotes: s.srNotes,
        assessCount: s.assessCount, role: s.role, students: s.students,
      }),
      onRehydrateStorage: () => (s) => {
        if (s?.refA) setReferenceA(s.refA);   // keep the audio engine in sync with the saved pitch
      },
    },
  ),
);
function KEY_AT(i: number): string { return KEYS[i] ?? ''; }
export { NOTES };
