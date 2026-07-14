// Canonical MusicXML per piece (ground truth for rendering + matching).
// In production these come from the library service / OMR / transcription; here
// a real MusicXML excerpt so Verovio renders genuine notation, not fake staff lines.

// Bach — Cello Suite No. 1 in G, Allemande opening, transcribed for viola (alto clef).
// Real MusicXML 3.1. Note @id values are the xml:id bridge for note-level feedback.
const BACH_G_ALLEMANDE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Viola</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>1</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>3</line></clef>
      </attributes>
      <note id="n1"><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n2"><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n3"><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n4"><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n5"><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n6"><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n7"><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n8"><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
    </measure>
    <measure number="2">
      <note id="n9"><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n10"><pitch><step>B</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n11"><pitch><step>A</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n12"><pitch><step>B</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n13"><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n14"><pitch><step>A</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n15"><pitch><step>F</step><alter>1</alter><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note id="n16"><pitch><step>A</step><octave>3</octave></pitch><duration>2</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>`;

// A short alto-clef exercise (used as a generic fallback score).
const ALTO_EXERCISE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Viola</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>3</line></clef>
      </attributes>
      <note id="e1"><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e2"><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e3"><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e4"><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note id="e5"><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e6"><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e7"><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

export function scoreFor(title: string | undefined): string {
  if (title && title.toLowerCase().includes('bach')) return BACH_G_ALLEMANDE;
  return ALTO_EXERCISE;
}

export { BACH_G_ALLEMANDE, ALTO_EXERCISE };
