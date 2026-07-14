// Static option lists — ported verbatim from the prototype's Component class.

export const TS = ['2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '2/2', '3/2', '3/8', '6/8', '9/8', '12/8', '5/8', '7/8'];

export const SOUNDS = ['Woodblock', 'Click', 'Beep'];

export const KEYS = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'B major', 'F# major', 'C# major',
  'F major', 'B♭ major', 'E♭ major', 'A♭ major', 'D♭ major', 'G♭ major', 'C♭ major',
  'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor', 'D# minor', 'A# minor',
  'D minor', 'G minor', 'C minor', 'F minor', 'B♭ minor', 'E♭ minor', 'A♭ minor',
];

export const NVS = [
  'Whole notes', 'Half notes', 'Quarter notes', 'Eighth notes', 'Sixteenth notes',
  'Dotted rhythms', 'Triplets', 'Syncopation', 'Whole rests', 'Half rests',
  'Quarter rests', 'Eighth rests', 'Sixteenth rests',
];

export const SROPTS = ['Shifting', 'Double stops', 'Treble clef part'];

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function tempoName(bpm: number): string {
  return bpm < 60 ? 'Largo'
    : bpm < 76 ? 'Adagio'
    : bpm < 108 ? 'Andante'
    : bpm < 120 ? 'Moderato'
    : bpm < 156 ? 'Allegro'
    : bpm < 200 ? 'Presto'
    : 'Prestissimo';
}
