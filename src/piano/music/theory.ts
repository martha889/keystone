// Music theory helpers: note spelling, scales, chords, key signatures.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// The Casiotone CT-S1 has 61 keys: C2 (MIDI 36) to C7 (MIDI 96).
export const KEYBOARD_LOW = 36;
export const KEYBOARD_HIGH = 96;
export const MIDDLE_C = 60;

export interface Spelled {
  letter: number; // 0..6 = C..B
  acc: number; // -2..2
  octave: number;
  midi: number;
}

export function isBlack(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

export function pc(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function noteName(midi: number, withOctave = true, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const n = names[pc(midi)];
  return withOctave ? `${n}${Math.floor(midi / 12) - 1}` : n;
}

export function accSymbol(acc: number): string {
  return acc === 0 ? '' : acc === 1 ? '♯' : acc === -1 ? '♭' : acc === 2 ? '𝄪' : '𝄫';
}

export function spelledName(s: Spelled, withOctave = true): string {
  return `${LETTERS[s.letter]}${accSymbol(s.acc)}${withOctave ? s.octave : ''}`;
}

export function makeSpelled(letter: number, acc: number, octave: number): Spelled {
  return { letter, acc, octave, midi: 12 * (octave + 1) + LETTER_PC[letter] + acc };
}

/** Parse "C4", "F#3", "Bb5", "Eb" (octave optional, defaults to 4). */
export function parseNote(name: string): Spelled {
  const m = /^([A-Ga-g])([#b♯♭x]*)(-?\d)?$/.exec(name.trim());
  if (!m) throw new Error(`Bad note: ${name}`);
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  let acc = 0;
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : ch === 'x' ? 2 : -1;
  const octave = m[3] !== undefined ? parseInt(m[3], 10) : 4;
  return makeSpelled(letter, acc, octave);
}

export function n(name: string): number {
  return parseNote(name).midi;
}

/** Default spelling for a MIDI number (sharps or flats). */
export function spellMidi(midi: number, preferFlats = false): Spelled {
  const p = pc(midi);
  const octave = Math.floor(midi / 12) - 1;
  const natural = LETTER_PC.indexOf(p);
  if (natural >= 0) return { letter: natural, acc: 0, octave, midi };
  if (preferFlats) {
    const letter = LETTER_PC.indexOf(p + 1);
    return { letter, acc: -1, octave, midi };
  }
  const letter = LETTER_PC.indexOf(p - 1);
  return { letter, acc: 1, octave, midi };
}

// ---------- Keys ----------

export type Mode = 'major' | 'minor';

/** Number of sharps (positive) or flats (negative) for a key. */
const MAJOR_SIGS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MINOR_SIGS: Record<string, number> = {
  A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6,
  D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6,
};

export function keySignature(tonic: string, mode: Mode): number {
  const t = tonic.replace('♯', '#').replace('♭', 'b');
  const v = (mode === 'major' ? MAJOR_SIGS : MINOR_SIGS)[t];
  if (v === undefined) throw new Error(`Unknown key ${tonic} ${mode}`);
  return v;
}

const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B (letter indices)
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

/** Accidental applied by a key signature to each letter. */
export function keySigAccidentals(sig: number): number[] {
  const accs = [0, 0, 0, 0, 0, 0, 0];
  if (sig > 0) for (let i = 0; i < sig; i++) accs[SHARP_ORDER[i]] = 1;
  if (sig < 0) for (let i = 0; i < -sig; i++) accs[FLAT_ORDER[i]] = -1;
  return accs;
}

export function keySigLetters(sig: number): number[] {
  return sig > 0 ? SHARP_ORDER.slice(0, sig) : FLAT_ORDER.slice(0, -sig);
}

/** Spell a MIDI note in the context of a key signature. */
export function spellInKey(midi: number, sig: number): Spelled {
  const accs = keySigAccidentals(sig);
  const p = pc(midi);
  const octaveBase = Math.floor(midi / 12) - 1;
  // Prefer diatonic letter
  for (let l = 0; l < 7; l++) {
    const raw = LETTER_PC[l] + accs[l];
    if (((raw % 12) + 12) % 12 === p) {
      const octave = octaveBase + (raw < 0 ? 1 : raw > 11 ? -1 : 0);
      return { letter: l, acc: accs[l], octave, midi };
    }
  }
  return spellMidi(midi, sig < 0);
}

// ---------- Scales ----------

export type ScaleType = 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor' | 'chromatic' | 'majorPentatonic' | 'blues';

const SCALE_STEPS: Record<Exclude<ScaleType, 'chromatic' | 'majorPentatonic' | 'blues'>, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
};

export const SCALE_LABEL: Record<ScaleType, string> = {
  major: 'major',
  naturalMinor: 'natural minor',
  harmonicMinor: 'harmonic minor',
  melodicMinor: 'melodic minor',
  chromatic: 'chromatic',
  majorPentatonic: 'major pentatonic',
  blues: 'blues',
};

function diatonicOctave(tonic: Spelled, steps: number[]): Spelled[] {
  const out: Spelled[] = [];
  for (let i = 0; i < 7; i++) {
    const letterAbs = tonic.letter + i;
    const letter = letterAbs % 7;
    const octave = tonic.octave + Math.floor(letterAbs / 7);
    const target = tonic.midi + steps[i];
    const naturalMidi = 12 * (octave + 1) + LETTER_PC[letter];
    out.push({ letter, acc: target - naturalMidi, octave, midi: target });
  }
  return out;
}

/**
 * Notes of a scale, ascending `octaves` octaves then (optionally) back down.
 * tonic like "G3" or "Bb2".
 */
export function scale(tonicName: string, type: ScaleType, octaves = 1, upAndDown = true): Spelled[] {
  const tonic = parseNote(tonicName);
  let up: Spelled[] = [];
  let down: Spelled[] | null = null;
  if (type === 'chromatic') {
    const preferFlats = tonic.acc < 0;
    for (let i = 0; i <= 12 * octaves; i++) up.push(spellMidi(tonic.midi + i, preferFlats));
    if (upAndDown) down = up.slice(0, -1).reverse().map((s) => spellMidi(s.midi, true));
  } else if (type === 'majorPentatonic' || type === 'blues') {
    const steps = type === 'majorPentatonic' ? [0, 2, 4, 7, 9] : [0, 3, 5, 6, 7, 10];
    const majorSig = type === 'blues' ? -3 : 0;
    for (let o = 0; o < octaves; o++)
      for (const s of steps) up.push(spellInKey(tonic.midi + 12 * o + s, majorSig + (tonic.acc < 0 ? -1 : 0)));
    up.push(makeSpelled(tonic.letter, tonic.acc, tonic.octave + octaves));
  } else {
    const steps = SCALE_STEPS[type];
    for (let o = 0; o < octaves; o++) {
      const t = makeSpelled(tonic.letter, tonic.acc, tonic.octave + o);
      up.push(...diatonicOctave(t, steps));
    }
    up.push(makeSpelled(tonic.letter, tonic.acc, tonic.octave + octaves));
    if (type === 'melodicMinor' && upAndDown) {
      const nat: Spelled[] = [];
      for (let o = 0; o < octaves; o++) {
        nat.push(...diatonicOctave(makeSpelled(tonic.letter, tonic.acc, tonic.octave + o), SCALE_STEPS.naturalMinor));
      }
      down = nat.reverse();
    }
  }
  if (!upAndDown) return up;
  if (!down) down = up.slice(0, -1).reverse();
  return [...up, ...down];
}

// ---------- Chords ----------

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'dom7' | 'maj7' | 'min7' | 'm7b5' | 'dim7' | 'sus2' | 'sus4';

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

const CHORD_LETTER_STEPS: Record<ChordQuality, number[]> = {
  maj: [0, 2, 4], min: [0, 2, 4], dim: [0, 2, 4], aug: [0, 2, 4],
  sus2: [0, 1, 4], sus4: [0, 3, 4],
  dom7: [0, 2, 4, 6], maj7: [0, 2, 4, 6], min7: [0, 2, 4, 6], m7b5: [0, 2, 4, 6], dim7: [0, 2, 4, 6],
};

export const CHORD_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4',
  dom7: '7', maj7: 'maj7', min7: 'm7', m7b5: 'm7♭5', dim7: '°7',
};

/** Spelled chord tones. inversion 0 = root position. */
export function chord(rootName: string, quality: ChordQuality, inversion = 0): Spelled[] {
  const root = parseNote(rootName);
  const ints = CHORD_INTERVALS[quality];
  const ls = CHORD_LETTER_STEPS[quality];
  let tones = ints.map((iv, i) => {
    const letterAbs = root.letter + ls[i];
    const letter = letterAbs % 7;
    const octave = root.octave + Math.floor(letterAbs / 7);
    const midi = root.midi + iv;
    return { letter, acc: midi - (12 * (octave + 1) + LETTER_PC[letter]), octave, midi };
  });
  for (let i = 0; i < inversion; i++) {
    const [first, ...rest] = tones;
    tones = [...rest, { ...first, octave: first.octave + 1, midi: first.midi + 12 }];
  }
  return tones;
}

export function chordName(rootName: string, quality: ChordQuality): string {
  const r = parseNote(rootName);
  return `${LETTERS[r.letter]}${accSymbol(r.acc)}${CHORD_SUFFIX[quality]}`;
}

/** Diatonic triad qualities for degrees I..vii in major. */
export const MAJOR_TRIADS: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
export const MAJOR_SEVENTHS: ChordQuality[] = ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'm7b5'];

export const ALL_MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const ALL_MINOR_KEYS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'];

/** Choose an octave for a tonic so its scale sits comfortably for a hand. */
export function tonicWithOctave(tonic: string, hand: 'R' | 'L'): string {
  const base = parseNote(tonic + '4');
  // RH: tonic in C4..B4 ; LH: tonic in C3..B3 (an octave down)
  const oct = hand === 'R' ? 4 : 3;
  // Keep keys with high tonics (A, B) lower for LH to stay in range
  const adj = base.letter >= 5 && hand === 'R' ? -1 : 0;
  return `${tonic}${oct + adj}`;
}

export function intervalName(semitones: number): string {
  return [
    'unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
    'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th', 'octave',
  ][Math.abs(semitones) % 13];
}

// ---------- Scale fingerings (one octave, ascending, 8 notes) ----------

const RH_FINGERING: Record<string, string> = {
  C: '12312345', G: '12312345', D: '12312345', A: '12312345', E: '12312345', B: '12312345',
  F: '12341234', Bb: '41231234', Eb: '31234123', Ab: '34123123', Db: '23123412', 'F#': '23412312', Gb: '23412312',
};
const LH_FINGERING: Record<string, string> = {
  C: '54321321', G: '54321321', D: '54321321', A: '54321321', E: '54321321', B: '43214321',
  F: '54321321', Bb: '32143213', Eb: '32143213', Ab: '32143213', Db: '32143213', 'F#': '43213214', Gb: '43213214',
};

/** Fingering for an up-and-down (or up only) scale of `octaves` octaves, or null if unknown. */
export function scaleFingering(tonic: string, type: ScaleType, hand: 'R' | 'L', octaves: number, upAndDown: boolean): number[] | null {
  if (type === 'chromatic' || type === 'majorPentatonic' || type === 'blues') return null;
  const t = tonic.replace(/-?\d+$/, '');
  if (type !== 'major' && !['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(t)) return null;
  const f = (hand === 'R' ? RH_FINGERING : LH_FINGERING)[t];
  if (!f) return null;
  const p = f.split('').map(Number);
  const joint = hand === 'R' ? (p[0] === 1 ? 1 : p[0]) : p[0] === 5 ? 1 : p[0];
  const up: number[] = [p[0], ...p.slice(1, 7)];
  for (let o = 1; o < octaves; o++) up.push(joint, ...p.slice(1, 7));
  up.push(p[7]);
  if (!upAndDown) return up;
  return [...up, ...up.slice(0, -1).reverse()];
}
