// ViolaHub seed content — ported verbatim from the prototype's renderVals() + stopRecording() banks.
import type { Piece, Course, BrowseEntry, FeedbackBank, Skill } from './types';

export const PIECES: Piece[] = [
  { t: 'Bach: Suite No. 1 in G Major', s: 'I. Allemande', star: '★' },
  { t: 'Hoffmeister: Concerto in D Major', s: 'I. Allegro moderato', star: '' },
  { t: 'Suzuki Viola School', s: 'Book 2', star: '' },
];

export const INITIAL_RECENT: Piece[] = [
  { t: 'Telemann: Fantasia No. 2', s: 'Yesterday' },
  { t: 'Wohlfahrt: Op. 45 No. 1', s: '2 days ago' },
];

export const COMMUNITY: BrowseEntry[] = [
  { t: 'Etude in C', s: 'by @violajen · 412 downloads', cta: 'Open', cls: 'btn-ghost' },
  { t: 'Irish Reel Set for Viola', s: 'by @fiddleviola · 208 downloads', cta: 'Open', cls: 'btn-ghost' },
  { t: 'Warm-up Drones & Scales', s: 'by @bratschist · 1.1k downloads', cta: 'Open', cls: 'btn-ghost' },
  { t: 'Pop Medley (viola solo)', s: 'by @emviola · 96 downloads', cta: 'Open', cls: 'btn-ghost' },
];

export const PROFESSIONAL: BrowseEntry[] = [
  { t: 'Schott: Telemann Viola Concerto', s: 'Digital · $12.99 · opens in app', cta: 'Buy on Amazon', cls: 'btn-secondary' },
  { t: 'Bärenreiter: Bach Cello Suites (viola)', s: 'Physical · $34.00 · ships to you', cta: 'Buy on Amazon', cls: 'btn-secondary' },
  { t: 'Henle: Brahms Sonatas Op. 120', s: 'Digital · $18.99 · opens in app', cta: 'Buy on Amazon', cls: 'btn-secondary' },
  { t: 'Suzuki Viola School, Book 3', s: 'Physical · $10.99 · ships to you', cta: 'Buy on Amazon', cls: 'btn-secondary' },
];

export const COURSES: Course[] = [
  {
    t: 'Beginner Viola', s: 'Tuning, posture, first notes · 12 lessons', lessons: [
      { t: 'Parts of the viola', d: '3:30', type: 'quiz', q: 'Which part do you turn to change a string’s pitch?', opts: ['The bridge', 'The tuning peg', 'The f-hole'], a: 1 },
      { t: 'Holding the viola', d: '4:12', type: 'audio', skill: 'bow', markMeasure: 2, excerpt: 'Open C, G, D and A strings, whole notes', target: 'Bach: Suite No. 1 in G Major — I. Allemande, m.1–4' },
      { t: 'Tuning your strings', d: '5:03', type: 'audio', skill: 'tuning', markMeasure: 1, excerpt: 'C–G–D–A open strings', target: 'Open string tuning check' },
      { t: 'Your first bow stroke', d: '6:20', type: 'audio', skill: 'bow', markMeasure: 1, excerpt: 'Long, even down-bows on the D string', target: 'Bach: Suite No. 1 in G Major — I. Allemande, m.1–2' },
      { t: 'Reading your first notes', d: '7:45', type: 'audio', skill: 'reading', markMeasure: 2, excerpt: 'First line, quarter notes only', target: 'Suzuki Viola School, Book 1 — No. 3' },
    ],
  },
  {
    t: 'Shifting Techniques', s: 'Improve your range · 8 lessons', lessons: [
      { t: 'What is shifting?', d: '5:10', type: 'audio', skill: 'shifting', markMeasure: 2, excerpt: 'First-to-third position shift on the A string', target: 'Shifting Techniques — Exercise 2' },
      { t: 'First to third position', d: '6:40', type: 'audio', skill: 'shifting', markMeasure: 3, excerpt: 'Scale with one shift per line', target: 'Shifting Techniques — Exercise 5' },
      { t: 'Shifting on scales', d: '8:15', type: 'audio', skill: 'shifting', markMeasure: 5, excerpt: 'Two-octave G major scale, shifting each octave', target: 'Shifting Techniques — Exercise 8' },
    ],
  },
  {
    t: 'Vibrato Mastery', s: 'Beautiful, expressive sound · 10 lessons', lessons: [
      { t: 'The motion of vibrato', d: '4:50', type: 'audio', skill: 'vibrato', markMeasure: 2, excerpt: 'Sustained D on the A string with vibrato', target: 'Vibrato Mastery — Exercise 1' },
      { t: 'Arm vs. wrist vibrato', d: '6:05', type: 'audio', skill: 'vibrato', markMeasure: 1, excerpt: 'Slow phrase, alternating vibrato style', target: 'Vibrato Mastery — Exercise 4' },
      { t: 'Adding vibrato to phrases', d: '7:30', type: 'audio', skill: 'vibrato', markMeasure: 3, excerpt: 'Short lyrical phrase', target: 'Vibrato Mastery — Exercise 7' },
    ],
  },
  {
    t: 'Intonation Essentials', s: 'Play in tune with confidence · 9 lessons', lessons: [
      { t: 'Why intonation matters', d: '3:55', type: 'audio', skill: 'intonation', markMeasure: 2, excerpt: 'Slow scale, listening for pitch', target: 'Intonation Essentials — Exercise 1' },
      { t: 'Using open strings as reference', d: '5:20', type: 'audio', skill: 'intonation', markMeasure: 1, excerpt: 'Double-stops against open strings', target: 'Intonation Essentials — Exercise 3' },
      { t: 'Practicing with a drone', d: '6:45', type: 'audio', skill: 'intonation', markMeasure: 3, excerpt: 'Scale against a sustained drone', target: 'Intonation Essentials — Exercise 6' },
    ],
  },
];

export const PROFILE_MENU = ['My library', 'Downloads', 'Practice history', 'Subscription & billing', 'Settings', 'Help & support'];

export const FEEDBACK_BANKS: Record<Skill, FeedbackBank> = {
  shifting: {
    strengths: ['Clean shift into the new position, no audible slide', 'Landed the shifted note in tune', 'Left hand stayed relaxed through the shift', 'Bow kept a steady tone through the position change'],
    work: ['The shift lands a little sharp — check the new hand frame', 'Audible slide between positions — aim for a quicker, lighter shift', 'Tempo dips right at the shift — keep the pulse steady', 'Guide finger contact is too heavy going into the shift'],
  },
  vibrato: {
    strengths: ['Even, consistent vibrato width', 'Vibrato speed matches the mood of the phrase', 'Relaxed wrist/arm motion', 'Vibrato starts right as the note begins'],
    work: ['Vibrato is a bit tense — loosen the wrist', 'Width varies note to note — aim for consistency', 'Vibrato starts late after the note begins', 'Try a faster vibrato for this phrase’s energy'],
  },
  intonation: {
    strengths: ['Pitches line up cleanly against the reference', 'Confident, centered intonation', 'Consistent tuning across the phrase', 'Good ear for correcting pitch mid-note'],
    work: ['A few notes drift flat against the reference', 'The leading tone could sit higher', 'Double-stops are slightly out of tune with each other', 'Check intonation on the shifted notes specifically'],
  },
  bow: {
    strengths: ['Even bow speed start to finish', 'Good contact point near the bridge', 'Smooth string crossings', 'Full, resonant tone'],
    work: ['Bow speed slows near the tip', 'Contact point drifts toward the fingerboard', 'A little scratch at the bow change', 'Try more arm weight for a fuller sound'],
  },
  tuning: {
    strengths: ['Open strings are well in tune with each other', 'Clean, resonant open-string tone', 'Confident peg adjustments'],
    work: ['The A string sits slightly sharp', 'Check the C string against the tuner again', 'Bow pressure is too heavy while tuning'],
  },
  reading: {
    strengths: ['Rhythm matched the notated values', 'Correct notes throughout the line', 'Steady tempo while reading'],
    work: ['A rhythm was rushed in the second measure', 'One note was misread — double check the key signature', 'Tempo dragged toward the end of the line'],
  },
};

export const MARK_LABEL: Record<Skill, string> = {
  shifting: 'shift ↗', vibrato: 'vibrato ~', intonation: 'pitch ✓', bow: 'bow ↔', tuning: 'in tune?', reading: 'rhythm ♩',
};

export const MARK_NOTE: Record<Skill, string> = {
  shifting: 'AI checks specifically for a clean position shift at the marked point — not just the right notes.',
  vibrato: 'AI checks specifically for consistent vibrato width and speed at the marked point.',
  intonation: 'AI checks specifically for pitch accuracy at the marked point.',
  bow: 'AI checks specifically for bow control and tone at the marked point.',
  tuning: 'AI checks specifically that this string is in tune at the marked point.',
  reading: 'AI checks specifically for correct rhythm and notes at the marked point.',
};
