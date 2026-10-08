// The full curriculum: from first contact with the keyboard to elite technique.

import {
  ALL_MAJOR_KEYS, chord, keySignature, MAJOR_SEVENTHS, MAJOR_TRIADS, parseNote, scale,
  spellInKey, type ChordQuality, type ScaleType,
} from '../music/theory';
import {
  arpeggio, chordQualityEcho, chordStep, contraryMotion, data, earRounds, hanon1, intervalEcho, mel,
  melodyEcho, noteEcho, progressionEcho, rand, randomNotes, scaleHandsTogether, scaleSteps, shuffle, stepOf,
} from './build';
import type { ExerciseData, ExerciseDef, Level, Step } from './types';

type ExOpts = Omit<ExerciseDef, 'id' | 'title' | 'kind' | 'instructions' | 'build'>;

function follow(id: string, title: string, instructions: string, build: () => ExerciseData, o: ExOpts = {}): ExerciseDef {
  return { id, title, kind: 'follow', instructions, build, hints: 'keys', showFingers: true, ...o };
}
function tempo(id: string, title: string, instructions: string, build: () => ExerciseData, bpm: number, targetBpm: number, o: ExOpts = {}): ExerciseDef {
  return { id, title, kind: 'tempo', instructions, build, bpm, targetBpm, hints: 'staff', showFingers: true, ...o };
}
function ear(id: string, title: string, instructions: string, build: () => ExerciseData, o: ExOpts = {}): ExerciseDef {
  return { id, title, kind: 'ear', instructions, build, hints: 'staff', ...o };
}

const sp = (name: string) => parseNote(name);
const notes = (names: string, extra: Partial<Step> = {}) => names.split(' ').map((nm) => stepOf([sp(nm)], 1, extra));

// ---------- Song data (all public domain) ----------

const MARY = 'E4/3 D4/2 C4/1 D4/2 | E4/3 E4/3 E4/3:2 | D4/2 D4/2 D4/2:2 | E4/3 G4/5 G4/5:2 | E4/3 D4/2 C4/1 D4/2 | E4/3 E4/3 E4/3 E4/3 | D4/2 D4/2 E4/3 D4/2 | C4/1:4';
const ODE = 'E4/3 E4/3 F4/4 G4/5 | G4/5 F4/4 E4/3 D4/2 | C4/1 C4/1 D4/2 E4/3 | E4/3:1.5 D4/2:0.5 D4/2:2 | E4/3 E4/3 F4/4 G4/5 | G4/5 F4/4 E4/3 D4/2 | C4/1 C4/1 D4/2 E4/3 | D4/2:1.5 C4/1:0.5 C4/1:2';
const ODE_LH = 'E3/3 E3/3 F3/2 G3/1 | G3/1 F3/2 E3/3 D3/4 | C3/5 C3/5 D3/4 E3/3 | E3/3:1.5 D3/4:0.5 D3/4:2 | E3/3 E3/3 F3/2 G3/1 | G3/1 F3/2 E3/3 D3/4 | C3/5 C3/5 D3/4 E3/3 | D3/4:1.5 C3/5:0.5 C3/5:2';
const ODE_HT = 'C3+E4 E4 F4 G4 | G3+G4 F4 E4 D4 | C3+C4 C4 D4 E4 | G3+E4:1.5 D4:0.5 D4:2 | C3+E4 E4 F4 G4 | G3+G4 F4 E4 D4 | C3+C4 C4 D4 E4 | G3+D4:1.5 C4:0.5 C3+C4:2';
const TWINKLE = 'C4/1 C4/1 G4/4 G4/4 | A4/5 A4/5 G4/4:2 | F4/3 F4/3 E4/2 E4/2 | D4/2 D4/2 C4/1:2 | G4/5 G4/5 F4/4 F4/4 | E4/3 E4/3 D4/2:2 | G4/5 G4/5 F4/4 F4/4 | E4/3 E4/3 D4/2:2 | C4/1 C4/1 G4/4 G4/4 | A4/5 A4/5 G4/4:2 | F4/3 F4/3 E4/2 E4/2 | D4/2 D4/2 C4/1:2';
const JINGLE = 'E4/3 E4/3 E4/3:2 | E4/3 E4/3 E4/3:2 | E4/3 G4/5 C4/1:1.5 D4/2:0.5 | E4/3:4 | F4/4 F4/4 F4/4:1.5 F4/4:0.5 | F4/4 E4/3 E4/3 E4/3:0.5 E4/3:0.5 | E4/3 D4/2 D4/2 E4/3 | D4/2:2 G4/5:2';
const AMAZING = 'D4/1 | G4/3:2 B4/5:0.5 G4/3:0.5 | B4/5:2 A4/4:1 | G4/3:2 E4/2:1 | D4/1:2 D4/1:1 | G4/3:2 B4/5:0.5 G4/3:0.5 | B4/5:2 A4/4:1 | D5/5:3';
const GREENSLEEVES = 'A4/1 | C5/2:2 D5/3:1 | E5/4:1.5 F5/5:0.5 E5/4:1 | D5/3:2 B4/2:1 | G4/1:1.5 A4/2:0.5 B4/3:1 | C5/4:2 A4/2:1 | A4/2:1.5 G#4/1:0.5 A4/2:1 | B4/3:2 G#4/2:1 | E4/1:2 A4/1:1 | C5/2:2 D5/3:1 | E5/4:1.5 F5/5:0.5 E5/4:1 | D5/3:2 B4/2:1 | G4/1:1.5 A4/2:0.5 B4/3:1 | C5/4:1.5 B4/3:0.5 A4/2:1 | G#4/1:1.5 F#4/1:0.5 G#4/2:1 | A4/3:3';
const MINUET = 'D5/5 G4/1:0.5 A4/2:0.5 B4/3:0.5 C5/4:0.5 | D5/5 G4/1 G4/1 | E5/5 C5/1:0.5 D5/2:0.5 E5/3:0.5 F#5/4:0.5 | G5/5 G4/1 G4/1 | C5/4 D5/5:0.5 C5/4:0.5 B4/3:0.5 A4/2:0.5 | B4/3 C5/4:0.5 B4/3:0.5 A4/2:0.5 G4/1:0.5 | F#4/2 G4/1:0.5 A4/2:0.5 B4/3:0.5 G4/1:0.5 | A4/2:3';
const FUR_ELISE = 'E5/5:0.25 D#5/4:0.25 | E5/5:0.25 D#5/4:0.25 E5/5:0.25 B4/2:0.25 D5/4:0.25 C5/3:0.25 | A4/1:0.5 r:0.25 C4/1:0.25 E4/2:0.25 A4/3:0.25 | B4/4:0.5 r:0.25 E4/1:0.25 G#4/3:0.25 B4/4:0.25 | C5/5:0.5 r:0.25 E4/1:0.25 E5/5:0.25 D#5/4:0.25 | E5/5:0.25 D#5/4:0.25 E5/5:0.25 B4/2:0.25 D5/4:0.25 C5/3:0.25 | A4/1:0.5 r:0.25 C4/1:0.25 E4/2:0.25 A4/3:0.25 | B4/4:0.5 r:0.25 E4/1:0.25 C5/4:0.25 B4/3:0.25 | A4/2:1.5';
const PRELUDE_BARS = [
  'C4 E4 G4 C5 E5 G4 C5 E5', 'C4 D4 A4 D5 F5 A4 D5 F5', 'B3 D4 G4 D5 F5 G4 D5 F5', 'C4 E4 G4 C5 E5 G4 C5 E5',
  'C4 E4 A4 E5 A5 A4 E5 A5', 'C4 D4 F#4 A4 D5 F#4 A4 D5', 'B3 D4 G4 D5 G5 G4 D5 G5', 'B3 C4 E4 G4 C5 E4 G4 C5',
];
const prelude = (bars: number) =>
  mel(PRELUDE_BARS.slice(0, bars).map((b) => `${b} ${b}`).join(' | '), { defaultBeats: 0.25 }).map((st, i) =>
    i % 8 < 2 ? { ...st, hand: 'L' as const } : { ...st, hand: 'R' as const },
  );
const ALBERTI = 'C3/5:0.5 G3/1:0.5 E3/3:0.5 G3/1:0.5 C3/5:0.5 G3/1:0.5 E3/3:0.5 G3/1:0.5 | C3/5:0.5 A3/1:0.5 F3/2:0.5 A3/1:0.5 C3/5:0.5 A3/1:0.5 F3/2:0.5 A3/1:0.5 | B2/5:0.5 G3/1:0.5 D3/3:0.5 G3/1:0.5 B2/5:0.5 G3/1:0.5 D3/3:0.5 G3/1:0.5 | C3/5:0.5 G3/1:0.5 E3/3:0.5 G3/1:0.5 C3/5:2';

// ---------- Helpers for keys ----------

export function chromaticSteps(start: string, hand: 'R' | 'L', octaves = 1, beats = 0.5): Step[] {
  const notesS = scale(start, 'chromatic', octaves);
  return notesS.map((s, i) => {
    const black = [1, 3, 6, 8, 10].includes(s.midi % 12);
    let f = black ? 3 : 1;
    const letter = 'CDEFGAB'[s.letter];
    if (!black && hand === 'R' && (letter === 'F' || letter === 'C') && i > 0) f = 2;
    if (!black && hand === 'L' && (letter === 'E' || letter === 'B') && i > 0) f = 2;
    if (i === 0) f = 1;
    return stepOf([s], beats, { hand, fingers: [f] });
  });
}

/** Tonic in octave so that hands-together 3-octave scales fit the CT-S1 (C2–C7). */
function lhTonicLow(tonic: string): string {
  return `${tonic}2`;
}

export function randomScaleData(type: ScaleType, keys: string[], hand: 'R' | 'L' | 'B', octaves: number, beats: number): ExerciseData {
  const tonic = rand(keys);
  const mode = type === 'major' ? 'major' : 'minor';
  const sig = keySignature(tonic, mode);
  let steps: Step[];
  if (hand === 'B') {
    steps = scaleHandsTogether(octaves >= 3 ? `${tonic}3` : `${tonic}${parseNote(tonic + '4').letter >= 5 ? 3 : 4}`, type, octaves, beats);
    if (octaves >= 3) {
      const lh = scale(lhTonicLow(tonic), type, octaves);
      const rh = scale(`${tonic}3`, type, octaves);
      steps = rh.map((s, i) => stepOf([lh[i], s], beats, { hands: ['L', 'R'] }));
    }
  } else {
    const oct = hand === 'R' ? (octaves >= 2 ? 3 : parseNote(tonic + '4').letter >= 5 ? 3 : 4) : octaves >= 2 ? 2 : 3;
    steps = scaleSteps(`${tonic}${oct}`, type, hand, octaves, beats);
  }
  const label = `${tonic.replace('#', '♯').replace('b', '♭')} ${type === 'major' ? 'major' : type.replace('Minor', ' minor')}`;
  steps[0] = { ...steps[0], label };
  return data(steps, { keySig: sig });
}

/** ii–V–I with shell voicings (LH root, RH 3rd & 7th) in a given major key. */
function twoFiveOne(tonic: string): Step[] {
  const sig = keySignature(tonic, 'major');
  const t = parseNote(`${tonic}3`).midi; // C3..B3
  const lhT = t >= 55 ? t - 12 : t; // keep LH roots low
  const rhBase = parseNote(`${tonic}4`).midi; // tonic in octave 4
  const S = (m: number) => spellInKey(m, sig);
  const two = [S(lhT + 2), S(rhBase + 5), S(rhBase + 12)]; // ii: root, 3rd(4th degree), 7th(tonic)
  const five = [S(lhT - 5), S(rhBase + 5), S(rhBase + 11)]; // V: root, 7th(4th degree), 3rd(7th degree)
  const one = [S(lhT), S(rhBase + 4), S(rhBase + 11)]; // I: root, 3rd, 7th
  const name = (off: number, suf: string) => {
    const r = spellInKey(rhBase + off, sig);
    return `${'CDEFGAB'[r.letter]}${r.acc > 0 ? '♯' : r.acc < 0 ? '♭' : ''}${suf}`;
  };
  return [
    stepOf(two, 2, { label: name(2, 'm7') }),
    stepOf(five, 2, { label: name(7, '7') }),
    stepOf(one, 4, { label: name(0, 'maj7') }),
  ];
}

// ---------- Levels ----------

export const LEVELS: Level[] = [
  {
    id: 'l1', num: 1, name: 'Foundations', tagline: 'Meet your CT-S1, find your way around the keys',
    lessons: [
      {
        id: 'l1-1', title: 'Setting up your CT-S1',
        summary: 'Posture, sound settings and a microphone check.',
        body: [
          '**Your instrument.** The Casiotone CT-S1 has 61 full-size, touch-sensitive keys running from **C2 to C7**. Middle C (C4) is the C closest to the centre of the keyboard, just left of the middle of the panel.',
          '**Sound settings for this app.** Choose the **Grand Piano** tone, keep **Transpose** and **Octave** at their defaults (0), and set the volume around halfway. Turn off chorus and keep reverb low if you can: clean piano sound makes the microphone far more accurate. Put your laptop or phone near the keyboard’s speakers, in a quiet room.',
          '**Posture.** Sit centred on middle C, with your forearms level with the keys and your elbows slightly in front of your body. Let your fingers curve as if you were holding a small ball. Play with your fingertips, not the flat pads, and keep your wrists loose. The diagram below shows the shape to aim for.',
          '**Fingering help in every exercise.** Before you start, a card tells you where to put each finger (e.g. “Right hand: 1 on C4 · 2 on D4…”) and the keyboard shows outlined finger numbers on those keys. While you play, the key to press shows the finger to use (blue = right hand, orange = left hand), the hand diagram lights up that finger, and a yellow cue warns you before every hand move, like “thumb passes under to F4”.',
          '**Already have a USB cable?** The CT-S1 has a USB port that sends MIDI. If you connect it to your computer and pick **USB-MIDI** in Settings, the app reads your notes exactly, with no microphone guesswork. Microphone mode works fine too.',
        ],
        figures: ['posture', 'hands'],
        exercises: [
          follow('l1-1-a', 'Microphone check', 'Play any **C** key four times, letting each note ring briefly. Watch the level meter jump and the key light up.', () =>
            data([0, 1, 2, 3].map(() => stepOf([sp('C4')], 1, { anyOctave: true, label: 'Any C' }))), { passAccuracy: 0.5 }),
        ],
      },
      {
        id: 'l1-2', title: 'Middle C and the musical alphabet',
        summary: 'Seven letters, repeating: C D E F G A B.',
        body: [
          'Music uses just seven letter names, **A to G**, repeating over and over. On the keyboard, find any group of **two black keys**: the white key just to its left is always **C**.',
          'The C nearest the middle of your CT-S1 is **middle C**, also called **C4**. The number is the octave: C3 is one octave lower, C5 one higher. Your keyboard has C2, C3, C4, C5, C6 and C7.',
        ],
        exercises: [
          follow('l1-2-a', 'Find middle C', 'Play **middle C (C4)** three times.', () => data(notes('C4 C4 C4'))),
          follow('l1-2-b', 'Every C on the keyboard', 'Play every C from the lowest (C2) to the highest (C7).', () => data(notes('C2 C3 C4 C5 C6 C7'))),
          follow('l1-2-c', 'White keys up and down', 'Starting on middle C, play every white key up to the next C, then back down. Say the names aloud as you go.', () =>
            data(notes('C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4')), { showFingers: false }),
        ],
      },
      {
        id: 'l1-3', title: 'Black keys: sharps and flats',
        summary: 'Every black key has two names.',
        body: [
          'A **sharp (♯)** raises a note by a half step, the very next key to the right. A **flat (♭)** lowers it by a half step, the next key to the left. So the black key between C and D is both **C♯** and **D♭**.',
          'Black keys come in groups of **two** (C♯ D♯) and **three** (F♯ G♯ A♯). Learning to feel these groups without looking is your first navigation skill.',
        ],
        exercises: [
          follow('l1-3-a', 'Two-black-key groups', 'Play C♯ and D♯ in three different octaves.', () => data(notes('C#3 D#3 C#4 D#4 C#5 D#5')), { showFingers: false }),
          follow('l1-3-b', 'Three-black-key groups', 'Play F♯, G♯ and A♯ in two octaves.', () => data(notes('F#3 G#3 A#3 F#4 G#4 A#4')), { showFingers: false }),
          follow('l1-3-c', 'Half steps from middle C', 'Play every key, black and white, from C4 to C5: the **chromatic scale**.', () =>
            data(chromaticSteps('C4', 'R', 1, 1).slice(0, 13)), { showFingers: true }),
        ],
      },
      {
        id: 'l1-4', title: 'Note-name drill',
        summary: 'Find any note by name, fast.',
        body: [
          'Now the app shows only a **letter name**. Find it in any octave. Use the black-key groups as landmarks: C is left of the two, F is left of the three.',
          'Aim for **speed without guessing**. Your time per note is tracked, and the drill gets more useful the faster you get.',
        ],
        exercises: [
          follow('l1-4-a', 'White-key names', 'Play the named note in **any octave**.', () =>
            data(randomNotes(16, 60, 71, 0).map((s) => ({ ...s, anyOctave: true }))), { hints: 'name', showFingers: false }),
          follow('l1-4-b', 'All twelve names', 'Sharps and flats too. Play the named note in **any octave**.', () =>
            data(shuffle(['C4', 'C#4', 'D4', 'Eb4', 'E4', 'F4', 'F#4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4']).map((nm) => stepOf([sp(nm)], 1, { anyOctave: true }))), { hints: 'name', showFingers: false }),
          ear('l1-4-c', 'Ear: echo a note', 'The app plays one white key between middle C and the C above. Find it by ear.', () =>
            data([], { rounds: earRounds(8, () => noteEcho(60, 72)) })),
        ],
      },
      {
        id: 'l1-5', title: 'Finger numbers & C position',
        summary: 'Thumbs are 1, pinkies are 5, in both hands.',
        body: [
          'Each finger has a number: **thumb = 1, index = 2, middle = 3, ring = 4, pinky = 5**. This is the same for both hands, so the hands mirror each other.',
          '**C position:** right-hand thumb on middle C, one finger per key up to G. Left hand: pinky on C3 (an octave below middle C), thumb on G3. Keep every finger resting on its key.',
          '**Placing a hand position:** set your hand down so each finger rests lightly on its key *before* you play. Then only the fingers move, and the hand stays still. When the music goes beyond five notes, the hand moves to a new position. The app tells you when and how: the thumb passes under, a finger crosses over, or the whole hand shifts.',
        ],
        figures: ['hands'],
        exercises: [
          follow('l1-5-a', 'Right hand C position', 'Fingers 1-2-3-4-5 up, then back down. Keep your hand still and let only your fingers move.', () =>
            data(mel('C4/1 D4/2 E4/3 F4/4 G4/5 F4/4 E4/3 D4/2 C4/1', { hand: 'R' }))),
          follow('l1-5-b', 'Left hand C position', 'Pinky on C3. Play 5-4-3-2-1 up, then back down.', () =>
            data(mel('C3/5 D3/4 E3/3 F3/2 G3/1 F3/2 E3/3 D3/4 C3/5', { hand: 'L' }))),
          follow('l1-5-c', 'Finger independence', 'Skip patterns in C position. Lift each finger cleanly.', () =>
            data(mel('C4/1 E4/3 D4/2 F4/4 E4/3 G4/5 F4/4 D4/2 C4/1 | C3/5 E3/3 D3/4 F3/2 E3/3 G3/1 F3/2 D3/4 C3/5'))),
        ],
      },
    ],
  },
  {
    id: 'l2', num: 2, name: 'Reading Music', tagline: 'Treble clef, bass clef and the grand staff',
    lessons: [
      {
        id: 'l2-1', title: 'The treble clef',
        summary: 'Lines: E G B D F. Spaces: F A C E.',
        body: [
          'The **treble clef** (𝄞) is mostly for your right hand. Its five lines, bottom to top, are **E G B D F** (“Every Good Boy Does Fine”). Its spaces spell **F A C E**.',
          'Middle C sits on a short **ledger line** just below the treble staff. Notes move up the staff one line or space per letter.',
        ],
        exercises: [
          follow('l2-1-a', 'Treble lines', 'Play the line notes, bottom to top, then top to bottom.', () => data(notes('E4 G4 B4 D5 F5 D5 B4 G4 E4')), { showFingers: false }),
          follow('l2-1-b', 'Treble spaces', 'Play the space notes: F A C E.', () => data(notes('F4 A4 C5 E5 C5 A4 F4')), { showFingers: false }),
          follow('l2-1-c', 'Read without key hints', 'The keyboard won’t light up now. Read each note from the staff.', () => data(randomNotes(12, 60, 67, 0)), { hints: 'staff', showFingers: false }),
        ],
      },
      {
        id: 'l2-2', title: 'The bass clef',
        summary: 'Lines: G B D F A. Spaces: A C E G.',
        body: [
          'The **bass clef** (𝄢) is mostly for your left hand. Its two dots surround the **F line** (F3). Lines bottom to top: **G B D F A** (“Good Boys Do Fine Always”). Spaces: **A C E G** (“All Cows Eat Grass”).',
          'Middle C sits on a ledger line just **above** the bass staff. It’s the same key as middle C in the treble clef.',
        ],
        exercises: [
          follow('l2-2-a', 'Bass lines', 'Play the bass clef lines, bottom to top and back.', () => data(notes('G2 B2 D3 F3 A3 F3 D3 B2 G2', { hand: 'L' })), { showFingers: false }),
          follow('l2-2-b', 'Bass spaces', 'Play A C E G and back.', () => data(notes('A2 C3 E3 G3 E3 C3 A2', { hand: 'L' })), { showFingers: false }),
          follow('l2-2-c', 'Read the bass clef', 'No key hints. Read each note.', () => data(randomNotes(12, 48, 55, 0, { hand: 'L' })), { hints: 'staff', showFingers: false }),
        ],
      },
      {
        id: 'l2-3', title: 'Sight-reading: the grand staff',
        summary: 'Both clefs together, the way piano music is written.',
        body: [
          'Piano music uses the **grand staff**: treble on top, bass below, joined by a brace. Read **intervals**, not just letters. If the next note is one line higher, it’s a third up. Pattern-reading is how fluent readers stay fast.',
          'Use **landmarks**: treble G (2nd line), middle C, bass F (4th line). Measure from the nearest landmark instead of counting up from the bottom.',
        ],
        exercises: [
          follow('l2-3-a', 'Treble, one octave', 'Read and play. Mostly steps, a few skips.', () => data(randomNotes(16, 60, 72, 0, { stepwise: 0.6 })), { hints: 'staff', showFingers: false }),
          follow('l2-3-b', 'Bass, one octave', 'Read and play with your left hand.', () => data(randomNotes(16, 43, 60, 0, { stepwise: 0.6, hand: 'L' })), { hints: 'staff', showFingers: false }),
          follow('l2-3-c', 'Grand staff mix', 'Notes jump between clefs. Use your landmarks.', () => data(randomNotes(20, 43, 79, 0)), { hints: 'staff', showFingers: false }),
        ],
      },
    ],
  },
  {
    id: 'l3', num: 3, name: 'Rhythm & First Songs', tagline: 'Keep a steady beat and play real melodies',
    lessons: [
      {
        id: 'l3-1', title: 'Steady beat',
        summary: 'Quarter, half and whole notes with the metronome.',
        body: [
          'A **quarter note** (♩) lasts one beat, a **half note** two, a **whole note** four. In **4/4 time** there are four beats in each bar.',
          'In tempo exercises the app counts in one bar, then scores both **pitch** and **timing**. It tells you if you **rush** (play early) or **drag** (play late). Count aloud: “1-2-3-4”.',
          '**Tip:** headphones (plugged into the CT-S1’s PHONES jack) stop the microphone hearing the metronome. Better still, play the keyboard through its speakers and listen to the click from your computer.',
        ],
        exercises: [
          tempo('l3-1-a', 'Quarter notes', 'Play middle C exactly on every click.', () => data(mel('C4 C4 C4 C4 | C4 C4 C4 C4 | G4 G4 G4 G4 | C4 C4 C4 C4')), 70, 100, { hints: 'keys' }),
          tempo('l3-1-b', 'Halves and wholes', 'Hold long notes for their full value. Only the attack is scored, so count while you hold.', () =>
            data(mel('C4:2 E4:2 | G4:2 E4:2 | C4:4 | D4:2 F4:2 | E4:2 D4:2 | C4:4')), 70, 100, { hints: 'keys' }),
          tempo('l3-1-c', 'Rests', 'A rest is a beat of silence. Don’t play on it, but keep counting.', () =>
            data(mel('C4 r C4 r | E4 E4 r E4 | G4 r G4 G4 | C5:2 r:2')), 70, 100, { hints: 'keys' }),
        ],
      },
      {
        id: 'l3-2', title: 'Eighth notes & dotted rhythms',
        summary: 'Two notes per beat; long-short patterns.',
        body: [
          '**Eighth notes** split a beat in two: count “1-and-2-and”. A **dot** adds half the note’s value, so a dotted quarter is 1½ beats and is usually followed by an eighth.',
        ],
        exercises: [
          tempo('l3-2-a', 'Eighth notes', 'Even eighths: “1-and-2-and…”', () =>
            data(mel('C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:2 | G4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:2 | C4:0.5 C4:0.5 E4:0.5 E4:0.5 G4:0.5 G4:0.5 E4:1 | D4:0.5 D4:0.5 F4:0.5 F4:0.5 E4:2')), 60, 96, { hints: 'keys' }),
          tempo('l3-2-b', 'Dotted quarters', 'Long-short: count “1-(2)-and”.', () =>
            data(mel('C4:1.5 D4:0.5 E4:2 | E4:1.5 F4:0.5 G4:2 | G4:1.5 F4:0.5 E4:1.5 D4:0.5 | C4:4')), 60, 96, { hints: 'keys' }),
        ],
      },
      {
        id: 'l3-3', title: 'First melodies',
        summary: 'Mary Had a Little Lamb, Ode to Joy, Jingle Bells.',
        body: [
          'All three songs use **right-hand C position**: thumb on middle C. First learn the notes in follow mode, which waits for you. Then play with the metronome, starting slowly.',
          '**Practice principle:** slow and correct beats fast and sloppy. Mistakes you repeat become habits. Only raise the tempo once you score 3 stars.',
        ],
        exercises: [
          follow('l3-3-a', 'Mary Had a Little Lamb: notes', 'Learn the melody at your own pace.', () => data(mel(MARY, { hand: 'R' }))),
          tempo('l3-3-b', 'Mary Had a Little Lamb: in time', 'Now with the metronome.', () => data(mel(MARY, { hand: 'R' })), 72, 110),
          follow('l3-3-c', 'Ode to Joy: notes', 'Beethoven’s famous theme. Watch the dotted rhythm in bar 4.', () => data(mel(ODE, { hand: 'R' }))),
          tempo('l3-3-d', 'Ode to Joy: in time', 'Keep it steady. The dotted quarter is 1½ beats.', () => data(mel(ODE, { hand: 'R' })), 72, 116),
          tempo('l3-3-e', 'Jingle Bells chorus', 'Mixed rhythms in C position.', () => data(mel(JINGLE, { hand: 'R' })), 80, 126, { hints: 'keys' }),
        ],
      },
      {
        id: 'l3-4', title: 'Moving out of position',
        summary: 'Twinkle Twinkle needs a stretch; the left hand gets a melody.',
        body: [
          '“Twinkle Twinkle” reaches **A**, one key beyond C position. Play G with finger 4 so that finger 5 can reach A. Watch the finger numbers.',
          'The left hand needs to learn melodies too. Playing Ode to Joy an octave lower with the LH builds independence. Your LH fingering is the **mirror** of the right hand.',
        ],
        exercises: [
          follow('l3-4-a', 'Twinkle Twinkle Little Star', 'Follow the fingering: 1-1-4-4-5-5-4.', () => data(mel(TWINKLE, { hand: 'R' }))),
          tempo('l3-4-b', 'Twinkle: in time', 'With the metronome.', () => data(mel(TWINKLE, { hand: 'R' })), 80, 120),
          follow('l3-4-c', 'Ode to Joy: left hand', 'Left hand, C position, pinky on C3.', () => data(mel(ODE_LH, { hand: 'L' }))),
        ],
      },
    ],
  },
  {
    id: 'l4', num: 4, name: 'Scales & Thumb Crossing', tagline: 'The engine of piano technique',
    lessons: [
      {
        id: 'l4-1', title: 'C major scale: right hand',
        summary: 'Thumb under: the key to playing more than five notes.',
        body: [
          'A **major scale** follows the pattern **whole-whole-half-whole-whole-whole-half**. C major uses only white keys.',
          '**RH fingering: 1-2-3, 1-2-3-4-5.** After finger 3 plays E, tuck your **thumb under** to play F. Going down, cross **finger 3 over** the thumb from F to E. Keep your wrist level. Don’t let it jump when the thumb passes.',
        ],
        exercises: [
          follow('l4-1-a', 'C major RH, one octave', 'Watch for the thumb-under on F.', () => data(scaleSteps('C4', 'major', 'R'))),
          tempo('l4-1-b', 'C major RH in time', 'Quarter notes. Make the thumb-crossing inaudible.', () => data(scaleSteps('C4', 'major', 'R')), 60, 100),
          tempo('l4-1-c', 'C major RH, eighths', 'Two notes per beat, two octaves.', () => data(scaleSteps('C4', 'major', 'R', 2, 0.5)), 60, 100),
        ],
      },
      {
        id: 'l4-2', title: 'C major scale: left hand',
        summary: 'LH fingering 5-4-3-2-1, 3-2-1.',
        body: [
          '**LH fingering ascending: 5-4-3-2-1, 3-2-1.** After the thumb plays G, cross **finger 3 over** to A. Coming down, the thumb tucks **under** after A.',
          'The left hand is usually weaker. Give it extra slow repetitions; it pays off in every piece you’ll ever play.',
        ],
        exercises: [
          follow('l4-2-a', 'C major LH, one octave', 'Pinky on C3.', () => data(scaleSteps('C3', 'major', 'L'))),
          tempo('l4-2-b', 'C major LH in time', 'Quarter notes, steady.', () => data(scaleSteps('C3', 'major', 'L')), 60, 100),
        ],
      },
      {
        id: 'l4-3', title: 'Key signatures: G, D and F major',
        summary: 'Sharps and flats at the start of the staff.',
        body: [
          'G major needs one sharp (**F♯**), so instead of writing ♯ every time, music puts it in the **key signature** at the start of each line. D major has two sharps (**F♯, C♯**). F major has one flat (**B♭**).',
          '**F major RH fingering is different:** 1-2-3-4, 1-2-3-4. The thumb crosses after finger 4 on B♭, because the thumb should avoid black keys.',
        ],
        exercises: [
          follow('l4-3-a', 'G major RH', 'Remember F♯.', () => data(scaleSteps('G4', 'major', 'R'), { keySig: 1 })),
          follow('l4-3-b', 'G major LH', 'LH: 5-4-3-2-1-3-2-1.', () => data(scaleSteps('G3', 'major', 'L'), { keySig: 1 })),
          follow('l4-3-c', 'D major RH', 'F♯ and C♯.', () => data(scaleSteps('D4', 'major', 'R'), { keySig: 2 })),
          follow('l4-3-d', 'F major RH', 'Fingering 1-2-3-4-1-2-3-4. Thumb crosses after B♭.', () => data(scaleSteps('F4', 'major', 'R'), { keySig: -1 })),
          follow('l4-3-e', 'Read in G major', 'Sight-read with a key signature. Every F is F♯.', () => data(randomNotes(16, 62, 74, 1, { stepwise: 0.6 }), { keySig: 1 }), { hints: 'staff', showFingers: false }),
        ],
      },
      {
        id: 'l4-4', title: 'Hands together',
        summary: 'Coordinating two different fingerings.',
        body: [
          'In C major hands together, the hands cross at **different moments**: the RH thumb crosses under on F while the LH crosses 3 over on A. Go **very** slowly at first. Practise in follow mode until it feels automatic.',
        ],
        exercises: [
          follow('l4-4-a', 'C major hands together', 'Both hands, one octave apart.', () => data(scaleHandsTogether('C4', 'major', 1))),
          tempo('l4-4-b', 'C major HT in time', 'Quarter notes; the hands must land together.', () => data(scaleHandsTogether('C4', 'major', 1)), 56, 100),
          tempo('l4-4-c', 'G major HT, two octaves', 'Eighth notes.', () => data(scaleHandsTogether('G3', 'major', 2, 0.5), { keySig: 1 }), 56, 96),
        ],
      },
      {
        id: 'l4-5', title: 'Minor scales',
        summary: 'Natural, harmonic, melodic.',
        body: [
          'Every major key has a **relative minor** that shares its key signature, starting on the 6th degree. C major ↔ **A minor**.',
          '**Natural minor** uses the key signature as written. **Harmonic minor** raises the 7th (G♯ in A minor), which gives that exotic augmented-2nd leap. **Melodic minor** raises the 6th and 7th going up, and returns to natural going down.',
        ],
        exercises: [
          follow('l4-5-a', 'A natural minor RH', 'Same fingering as C major.', () => data(scaleSteps('A3', 'naturalMinor', 'R'))),
          follow('l4-5-b', 'A harmonic minor RH', 'Raised 7th: G♯.', () => data(scaleSteps('A3', 'harmonicMinor', 'R'))),
          follow('l4-5-c', 'A melodic minor RH', 'F♯ and G♯ going up, F and G natural coming down.', () => data(scaleSteps('A3', 'melodicMinor', 'R'))),
          follow('l4-5-d', 'A harmonic minor LH', 'LH fingering 5-4-3-2-1-3-2-1.', () => data(scaleSteps('A2', 'harmonicMinor', 'L'))),
        ],
      },
    ],
  },
  {
    id: 'l5', num: 5, name: 'Chords & Harmony', tagline: 'Intervals, triads, inversions and progressions',
    lessons: [
      {
        id: 'l5-1', title: 'Intervals',
        summary: 'The distance between two notes.',
        body: [
          'An **interval** is the distance between two notes, counted by letter names (C to E = a 3rd) and measured exactly in half steps (C–E = 4 half steps = **major 3rd**; C–E♭ = 3 = **minor 3rd**).',
          'Key intervals to know by sight and sound: **2nd** (step), **3rd** (skip), **4th**, **5th** (“Twinkle” C to G), **octave**.',
          '**For the microphone:** when playing two or more notes together, strike them **exactly together** and hold them about half a second.',
        ],
        exercises: [
          follow('l5-1-a', 'Intervals from C', 'Play both notes together: 2nd, 3rd, 4th, 5th, 6th, 7th, octave.', () =>
            data(['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((t, i) => stepOf([sp('C4'), sp(t)], 2, { label: ['2nd', '3rd', '4th', '5th', '6th', '7th', '8ve'][i] }))), { showFingers: false }),
          ear('l5-1-b', 'Ear: echo intervals', 'Listen to two notes, then play them back. Start on the same note the app played.', () =>
            data([], { rounds: earRounds(8, () => intervalEcho([2, 4, 5, 7, 12])) })),
        ],
      },
      {
        id: 'l5-2', title: 'Triads',
        summary: 'Root, third, fifth. Major and minor.',
        body: [
          'A **triad** stacks two thirds: **root, 3rd, 5th**. A **major** triad has 4 half steps then 3 (C–E–G, bright). A **minor** triad has 3 then 4 (A–C–E, darker).',
          'RH fingering for root position triads: **1-3-5**. LH: **5-3-1**.',
          'The 7 triads of C major: **C, Dm, Em, F, G, Am, B°**, numbered **I ii iii IV V vi vii°**.',
        ],
        exercises: [
          follow('l5-2-a', 'Triads of C major', 'Play each triad in root position, all three notes together.', () =>
            data(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'].map((r, i) => chordStep(r, MAJOR_TRIADS[i], 0, 2, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'][i])))),
          follow('l5-2-b', 'Major ↔ minor', 'Flip each chord between major and minor by moving only the 3rd.', () =>
            data(['C4', 'D4', 'E4', 'F4', 'G4'].flatMap((r) => {
              const nm = r[0];
              return [chordStep(r, 'maj', 0, 2, nm), chordStep(r, 'min', 0, 2, nm + 'm')];
            }))),
          ear('l5-2-c', 'Ear: major or minor?', 'Listen to the chord and play it back exactly. The answer shows afterwards.', () =>
            data([], { rounds: earRounds(8, () => chordQualityEcho(['maj', 'min'])) })),
        ],
      },
      {
        id: 'l5-3', title: 'Inversions',
        summary: 'Same notes, different bottom.',
        body: [
          'An **inversion** rearranges the chord tones. **Root position** C–E–G; **1st inversion** E–G–C; **2nd inversion** G–C–E. The chord is still C major.',
          'Inversions let you move between chords with **minimal hand movement** (“voice leading”), which is how real accompaniments are played.',
        ],
        exercises: [
          follow('l5-3-a', 'C major inversions', 'Root, 1st, 2nd, octave root, and back down.', () =>
            data([0, 1, 2, 3, 2, 1, 0].map((inv) => (inv === 3 ? chordStep('C5', 'maj', 0, 2, 'C') : chordStep('C4', 'maj', inv, 2, ['root', '1st inv', '2nd inv'][inv]))))),
          follow('l5-3-b', 'F and G inversions', 'F: root → 1st → 2nd. G: root → 1st → 2nd.', () =>
            data([...[0, 1, 2].map((i) => chordStep('F3', 'maj', i, 2, 'F')), ...[0, 1, 2].map((i) => chordStep('G3', 'maj', i, 2, 'G'))])),
        ],
      },
      {
        id: 'l5-4', title: 'Chord progressions',
        summary: 'I–IV–V–I and the four-chord pop progression.',
        body: [
          '**I–IV–V–I** is the backbone of Western music. Voice-led in C: **C (C-E-G) → F (C-F-A) → G (B-D-G) → C**. Your hand barely moves.',
          'The “pop” progression **I–V–vi–IV** (C–G–Am–F) powers thousands of songs. Add the **root in the left hand** for a full sound.',
        ],
        exercises: [
          follow('l5-4-a', 'I–IV–V–I in C (RH)', 'Smooth voice leading. Keep common tones still.', () =>
            data([chordStep('C4', 'maj', 0, 4, 'C'), chordStep('F3', 'maj', 2, 4, 'F'), chordStep('G3', 'maj', 1, 4, 'G'), chordStep('C4', 'maj', 0, 4, 'C')])),
          follow('l5-4-b', 'I–IV–V–I with bass', 'LH plays the root; RH plays the voice-led chord.', () =>
            data([
              stepOf([sp('C3'), ...chord('C4', 'maj')], 4, { label: 'C' }),
              stepOf([sp('F2'), ...chord('F3', 'maj', 2)], 4, { label: 'F' }),
              stepOf([sp('G2'), ...chord('G3', 'maj', 1)], 4, { label: 'G' }),
              stepOf([sp('C3'), ...chord('C4', 'maj')], 4, { label: 'C' }),
            ])),
          tempo('l5-4-c', 'Pop progression in time', 'C – G – Am – F, one chord per bar. Play on beat 1 and hold.', () =>
            data([
              stepOf([sp('C3'), ...chord('C4', 'maj')], 4, { label: 'C' }),
              stepOf([sp('G2'), ...chord('G3', 'maj', 1)], 4, { label: 'G' }),
              stepOf([sp('A2'), ...chord('A3', 'min', 1)], 4, { label: 'Am' }),
              stepOf([sp('F2'), ...chord('F3', 'maj', 2)], 4, { label: 'F' }),
              stepOf([sp('C3'), ...chord('C4', 'maj')], 4, { label: 'C' }),
            ]), 72, 100, { hints: 'keys' }),
        ],
      },
    ],
  },
  {
    id: 'l6', num: 6, name: 'Hands Together & Repertoire', tagline: 'Real pieces from the classical and folk tradition',
    lessons: [
      {
        id: 'l6-1', title: 'Ode to Joy, hands together',
        summary: 'Melody plus bass.',
        body: [
          'Your left hand plays a bass note at the start of each bar while the right plays the melody. Where the two coincide, **strike them exactly together**. Practise in follow mode first.',
        ],
        exercises: [
          follow('l6-1-a', 'Ode to Joy HT: notes', 'Learn the coordination.', () => data(mel(ODE_HT, { split: true })), { showFingers: false }),
          tempo('l6-1-b', 'Ode to Joy HT: in time', 'Hands together with the metronome.', () => data(mel(ODE_HT, { split: true })), 66, 112, { showFingers: false }),
        ],
      },
      {
        id: 'l6-2', title: 'Alberti bass',
        summary: 'The classic left-hand broken-chord pattern.',
        body: [
          'The **Alberti bass** breaks a chord into **bottom–top–middle–top**: C-G-E-G. Mozart and Haydn used it constantly. Keep it light and even, with the thumb (on the repeated top note) especially soft.',
        ],
        exercises: [
          follow('l6-2-a', 'Alberti bass: notes', 'C – F – G – C with the LH. Fingering 5-1-3-1.', () => data(mel(ALBERTI, { hand: 'L' }))),
          tempo('l6-2-b', 'Alberti bass: in time', 'Even eighth notes.', () => data(mel(ALBERTI, { hand: 'L' })), 60, 120),
        ],
      },
      {
        id: 'l6-3', title: 'Folk melodies in 3/4',
        summary: 'Amazing Grace and Greensleeves.',
        body: [
          '**3/4 time** has three beats per bar: think waltz. Both songs start with a **pickup** (anacrusis), a note before the first full bar.',
          '**Greensleeves** is in A minor and uses G♯ and F♯ from the melodic and harmonic minor scales you learned.',
        ],
        exercises: [
          follow('l6-3-a', 'Amazing Grace: notes', 'G major, 3/4, one pickup beat.', () => data(mel(AMAZING, { hand: 'R' }), { keySig: 1, timeSig: [3, 4], pickup: 1 })),
          tempo('l6-3-b', 'Amazing Grace: in time', 'Gently, with a lilt.', () => data(mel(AMAZING, { hand: 'R' }), { keySig: 1, timeSig: [3, 4], pickup: 1 }), 72, 100),
          follow('l6-3-c', 'Greensleeves: notes', 'A minor, 3/4, pickup beat.', () => data(mel(GREENSLEEVES, { hand: 'R' }), { timeSig: [3, 4], pickup: 1 })),
          tempo('l6-3-d', 'Greensleeves: in time', 'Long-short dotted rhythms.', () => data(mel(GREENSLEEVES, { hand: 'R' }), { timeSig: [3, 4], pickup: 1 }), 80, 120),
        ],
      },
      {
        id: 'l6-4', title: 'Minuet in G',
        summary: 'Petzold’s minuet (Anna Magdalena Notebook).',
        body: [
          'Long attributed to J.S. Bach, this minuet by **Christian Petzold** is one of the most-played early pieces. Shape the eighth-note runs and keep the quarter notes crisp and detached.',
          'After this, learn the left hand from a free score (search **IMSLP “Minuet in G major, BWV Anh. 114”**), then use **Free Play** to check your evenness.',
        ],
        exercises: [
          follow('l6-4-a', 'Minuet in G (RH, bars 1–8): notes', 'G major, 3/4.', () => data(mel(MINUET, { hand: 'R' }), { keySig: 1, timeSig: [3, 4] })),
          tempo('l6-4-b', 'Minuet in G: in time', 'Elegant and dance-like.', () => data(mel(MINUET, { hand: 'R' }), { keySig: 1, timeSig: [3, 4] }), 76, 120),
        ],
      },
      {
        id: 'l6-5', title: 'Für Elise (opening)',
        summary: 'Beethoven’s famous A-minor theme.',
        body: [
          'The opening alternates **E and D♯** (a half step) with a relaxed hand. In the full piece the left hand fills the rests with A-E-A and E-E-G♯ patterns. Here you play the right-hand part.',
          'Keep the D♯–E alternation **light**, close to the keys, and with no wrist motion.',
        ],
        exercises: [
          follow('l6-5-a', 'Für Elise: notes', 'Learn the melody.', () => data(mel(FUR_ELISE, { hand: 'R' }), { timeSig: [3, 8], pickup: 0.5 })),
          tempo('l6-5-b', 'Für Elise: in time', 'Tempo is per quarter note. Each note here is a 16th.', () => data(mel(FUR_ELISE, { hand: 'R' }), { timeSig: [3, 8], pickup: 0.5 }), 50, 90),
        ],
      },
    ],
  },
  {
    id: 'l7', num: 7, name: 'All Twelve Keys', tagline: 'Circle of fifths, every scale, reading in keys',
    lessons: [
      {
        id: 'l7-1', title: 'The circle of fifths: sharp keys',
        summary: 'G D A E B F♯: each adds a sharp.',
        body: [
          'Go up a **5th** and you add one sharp: C(0) → G(1) → D(2) → A(3) → E(4) → B(5) → F♯(6). The new sharp is always the **7th note** of the new scale.',
          'Order of sharps: **F C G D A E B** (“Father Charles Goes Down And Ends Battle”).',
        ],
        exercises: [
          follow('l7-1-a', 'Random sharp-key scale (RH)', 'A random key each attempt. Check the key signature!', () => randomScaleData('major', ['G', 'D', 'A', 'E', 'B'], 'R', 1, 1)),
          follow('l7-1-b', 'Random sharp-key scale (LH)', 'Same, left hand.', () => randomScaleData('major', ['G', 'D', 'A', 'E', 'B'], 'L', 1, 1)),
          tempo('l7-1-c', 'Sharp keys HT in time', 'Two octaves, eighths.', () => randomScaleData('major', ['G', 'D', 'A', 'E'], 'B', 2, 0.5), 60, 100),
        ],
      },
      {
        id: 'l7-2', title: 'Flat keys',
        summary: 'F B♭ E♭ A♭ D♭: each adds a flat.',
        body: [
          'Go down a 5th and you add a flat: C → F(1) → B♭(2) → E♭(3) → A♭(4) → D♭(5) → G♭(6). Order of flats: **B E A D G C F**, the sharps reversed.',
          'Flat-key fingerings start on fingers other than 1, because **thumbs avoid black keys**. B♭ major RH starts on 4 (or 2); E♭ on 3. The app shows the standard fingering.',
        ],
        exercises: [
          follow('l7-2-a', 'Random flat-key scale (RH)', 'Read the key signature first.', () => randomScaleData('major', ['F', 'Bb', 'Eb', 'Ab', 'Db'], 'R', 1, 1)),
          follow('l7-2-b', 'Random flat-key scale (LH)', 'Left hand.', () => randomScaleData('major', ['F', 'Bb', 'Eb', 'Ab', 'Db'], 'L', 1, 1)),
          tempo('l7-2-c', 'Flat keys HT in time', 'Two octaves, eighths.', () => randomScaleData('major', ['F', 'Bb', 'Eb', 'Ab'], 'B', 2, 0.5), 60, 100),
        ],
      },
      {
        id: 'l7-3', title: 'Minor scales in all keys',
        summary: 'Harmonic and melodic minor everywhere.',
        body: [
          'Find the relative minor by going **down three half steps** from the major tonic (or up to the 6th degree). G major ↔ E minor; F major ↔ D minor.',
        ],
        exercises: [
          follow('l7-3-a', 'Random harmonic minor', 'RH, one octave.', () => randomScaleData('harmonicMinor', ['A', 'E', 'D', 'G', 'B', 'C', 'F'], 'R', 1, 1)),
          follow('l7-3-b', 'Random melodic minor', 'Up raised 6 and 7, down natural.', () => randomScaleData('melodicMinor', ['A', 'E', 'D', 'G', 'C'], 'R', 1, 1)),
          tempo('l7-3-c', 'Harmonic minor HT', 'Two octaves, eighths.', () => randomScaleData('harmonicMinor', ['A', 'E', 'D', 'G'], 'B', 2, 0.5), 56, 96),
        ],
      },
      {
        id: 'l7-4', title: 'Chromatic scale',
        summary: 'Every half step, with 1-3 fingering.',
        body: [
          'Fingering rule: **3 on every black key, 1 on white keys**, except where two white keys are adjacent (E–F, B–C), where you use **1-2** (RH: 2 on F and C; LH: 2 on E and B).',
        ],
        exercises: [
          follow('l7-4-a', 'Chromatic RH, one octave', 'Up and down.', () => data(chromaticSteps('C4', 'R', 1, 0.5))),
          tempo('l7-4-b', 'Chromatic RH, two octaves', 'Eighths, smooth.', () => data(chromaticSteps('C4', 'R', 2, 0.5)), 60, 108),
          follow('l7-4-c', 'Chromatic LH', 'Up and down.', () => data(chromaticSteps('C3', 'L', 1, 0.5))),
        ],
      },
      {
        id: 'l7-5', title: 'Sight-reading in keys',
        summary: 'Reading with key signatures and accidentals.',
        body: [
          'Before playing, ask three questions: **What key? Where’s my first note? What’s the hand position?** Then keep your eyes on the music, not your hands.',
        ],
        exercises: [
          follow('l7-5-a', 'D major reading', 'Two sharps: F♯ and C♯.', () => data(randomNotes(16, 62, 76, 2, { stepwise: 0.6 }), { keySig: 2 }), { hints: 'staff', showFingers: false }),
          follow('l7-5-b', 'B♭ major reading', 'Two flats: B♭ and E♭.', () => data(randomNotes(16, 58, 74, -2, { stepwise: 0.6 }), { keySig: -2 }), { hints: 'staff', showFingers: false }),
          follow('l7-5-c', 'Accidentals', 'C major with occasional sharps and flats.', () => data(randomNotes(16, 55, 77, 0, { stepwise: 0.5, chromatic: 0.25 })), { hints: 'staff', showFingers: false }),
        ],
      },
    ],
  },
  {
    id: 'l8', num: 8, name: 'Technique & Advanced Harmony', tagline: 'Hanon, arpeggios, seventh chords, Bach',
    lessons: [
      {
        id: 'l8-1', title: 'Hanon No. 1',
        summary: 'Finger independence and evenness.',
        body: [
          'Charles-Louis Hanon’s **Virtuoso Pianist** exercises build strength and evenness. Lift each finger and play every note at the **same volume**. The app’s evenness score shows how steady you are.',
          'Start slow (♩=60 in 16ths) and add 4 bpm only when you get 3 stars. Mastery is ♩=108.',
        ],
        exercises: [
          follow('l8-1-a', 'Hanon 1 RH: pattern', 'Learn the pattern: 1-2-3-4-5-4-3-2.', () => data(hanon1(4, 'R', 7, 0.25))),
          tempo('l8-1-b', 'Hanon 1 RH in time', 'Sixteenth notes.', () => data(hanon1(4, 'R', 7, 0.25)), 50, 108),
          tempo('l8-1-c', 'Hanon 1 LH in time', 'Sixteenths, LH an octave lower.', () => data(hanon1(3, 'L', 7, 0.25)), 50, 108),
        ],
      },
      {
        id: 'l8-2', title: 'Arpeggios',
        summary: 'Broken chords across the keyboard.',
        body: [
          'An **arpeggio** plays a chord’s notes one after another across octaves. RH fingering for C, G and F major: **1-2-3, 1-2-3-5**; the thumb passes under after finger 3. LH: **5-4-2-1, 4-2-1**.',
          'Let your **wrist and forearm glide** sideways; don’t stretch the fingers. The thumb arrives early, already positioned under the hand.',
        ],
        exercises: [
          follow('l8-2-a', 'C major arpeggio RH', 'Two octaves up and down.', () => data(arpeggio('C4', 'maj', 2, 'R', 0.5))),
          tempo('l8-2-b', 'C major arpeggio RH in time', 'Eighths.', () => data(arpeggio('C4', 'maj', 2, 'R', 0.5)), 56, 100),
          follow('l8-2-c', 'A minor arpeggio LH', 'Two octaves.', () => data(arpeggio('A2', 'min', 2, 'L', 0.5))),
          follow('l8-2-d', 'G major arpeggio RH', 'Two octaves.', () => data(arpeggio('G3', 'maj', 2, 'R', 0.5))),
        ],
      },
      {
        id: 'l8-3', title: 'Seventh chords',
        summary: 'Maj7, m7, dominant 7, half-diminished.',
        body: [
          'Add another third on top of a triad to get a **seventh chord**. In C major the diatonic sevenths are **Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5**.',
          'The **dominant 7th** (G7 = G-B-D-F) pulls strongly to the tonic. It’s the most important chord in tonal harmony.',
        ],
        exercises: [
          follow('l8-3-a', 'Diatonic sevenths in C', 'Four notes together, root position, RH.', () =>
            data(['C4', 'D4', 'E4', 'F4', 'G3', 'A3', 'B3'].map((r, i) => chordStep(r, MAJOR_SEVENTHS[i], 0, 2, `${r[0]}${['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5'][i]}`)))),
          ear('l8-3-b', 'Ear: chord qualities', 'Major, minor, diminished, augmented. Play back what you hear.', () =>
            data([], { rounds: earRounds(8, () => chordQualityEcho(['maj', 'min', 'dim', 'aug'])) })),
        ],
      },
      {
        id: 'l8-4', title: 'The ii–V–I',
        summary: 'Jazz’s most important progression, in every key.',
        body: [
          '**ii–V–I** (Dm7–G7–Cmaj7 in C) is everywhere in jazz and pop. Using **shell voicings** (LH root; RH 3rd and 7th) you’ll notice the 7th of each chord falls a half step to the 3rd of the next. That’s smooth voice leading.',
        ],
        exercises: [
          follow('l8-4-a', 'ii–V–I in C', 'LH root, RH guide tones.', () => data(twoFiveOne('C'))),
          follow('l8-4-b', 'ii–V–I in random keys', 'Three keys per attempt.', () => {
            const keys = shuffle(ALL_MAJOR_KEYS).slice(0, 3);
            return data(keys.flatMap((k) => twoFiveOne(k)));
          }, { showFingers: false }),
        ],
      },
      {
        id: 'l8-5', title: 'Bach: Prelude in C (BWV 846)',
        summary: 'The first prelude of the Well-Tempered Clavier.',
        body: [
          'Each bar is one chord broken into a repeating pattern. Here it’s written as a single line: the **first two notes are LH** (hold them in the full version), the rest RH.',
          'Aim for perfect **evenness**. Think of the harmony changing bar by bar, not individual notes.',
        ],
        exercises: [
          follow('l8-5-a', 'Prelude in C, bars 1–4: notes', 'Learn the pattern.', () => data(prelude(4))),
          tempo('l8-5-b', 'Prelude in C, bars 1–4: in time', 'Sixteenth notes.', () => data(prelude(4)), 50, 80),
          ear('l8-5-c', 'Ear: melodic dictation', 'Listen to a short melody in C major starting on C, then play it back.', () =>
            data([], { rounds: earRounds(6, () => melodyEcho(4, 'C4')) })),
        ],
      },
    ],
  },
  {
    id: 'l9', num: 9, name: 'Advanced Performance', tagline: 'Speed, range and control',
    lessons: [
      {
        id: 'l9-1', title: 'Multi-octave scales',
        summary: 'Three octaves, hands together, in sixteenths.',
        body: [
          'At this level scales are about **speed with control**. Practise with **rhythms** (long-short, short-long), **accents** every 3 or 4 notes, and **dynamics** (crescendo up, diminuendo down).',
          'Mastery benchmark: **major scales HT, 3–4 octaves, sixteenths at ♩=100+**.',
        ],
        exercises: [
          tempo('l9-1-a', 'C major 3 octaves HT', 'Sixteenths.', () => {
            const lh = scale('C2', 'major', 3);
            const rh = scale('C3', 'major', 3);
            return data(rh.map((s, i) => stepOf([lh[i], s], 0.25, { hands: ['L', 'R'] })));
          }, 60, 108),
          tempo('l9-1-b', 'Random major key, 3 octaves HT', 'Any of the 12 keys.', () => randomScaleData('major', ALL_MAJOR_KEYS, 'B', 3, 0.25), 56, 100),
          tempo('l9-1-c', 'Contrary motion', 'Hands mirror outward from the same note.', () => data(contraryMotion('C5', 2, 0.5)), 56, 100),
        ],
      },
      {
        id: 'l9-2', title: 'Arpeggios in all keys',
        summary: 'Three octaves, major and minor.',
        body: [
          'Black-key arpeggios use different fingerings (e.g. D♭ major RH starts 2-1-2-4). Keep the thumb off black keys when you can. Glide with the arm and keep the wrist level.',
        ],
        exercises: [
          tempo('l9-2-a', 'Random major arpeggio RH', 'Three octaves, sixteenths.', () => {
            const r = rand(['C3', 'G3', 'F3', 'D3', 'A3', 'E3']);
            return data(arpeggio(r, 'maj', 3, 'R', 0.25), { keySig: keySignature(r.slice(0, -1), 'major') });
          }, 56, 100),
          tempo('l9-2-b', 'Random minor arpeggio LH', 'Three octaves, sixteenths.', () => {
            const r = rand(['A2', 'E2', 'D2', 'G2', 'C2']);
            return data(arpeggio(r, 'min', 3, 'L', 0.25), { keySig: keySignature(r.slice(0, -1), 'minor') });
          }, 56, 100),
          tempo('l9-2-c', 'Dominant 7th arpeggio', 'G7 across three octaves, RH.', () => data(arpeggio('G3', 'dom7', 2, 'R', 0.25)), 56, 100),
        ],
      },
      {
        id: 'l9-3', title: 'Advanced sight-reading',
        summary: 'Wide range, key signatures, accidentals.',
        body: [
          'Fluent readers look **ahead** while playing. The tempo-mode reading exercise forces you to keep going without stopping. A wrong note is better than a stopped beat.',
        ],
        exercises: [
          follow('l9-3-a', 'Grand staff, random key', 'Up to 4 sharps or flats.', () => {
            const sig = rand([-4, -3, -2, -1, 1, 2, 3, 4]);
            return data(randomNotes(20, 41, 84, sig, { stepwise: 0.4, chromatic: 0.1 }), { keySig: sig });
          }, { hints: 'staff', showFingers: false }),
          tempo('l9-3-b', 'Read in time', 'Keep going no matter what!', () => {
            const sig = rand([-2, -1, 0, 1, 2]);
            return data(randomNotes(24, 55, 79, sig, { stepwise: 0.6 }), { keySig: sig });
          }, 60, 100, { showFingers: false }),
          ear('l9-3-c', 'Ear: progressions', 'Listen to four chords and play them back (any voicing).', () =>
            data([], { rounds: earRounds(5, () => progressionEcho('C')) })),
        ],
      },
      {
        id: 'l9-4', title: 'Bach Prelude in C: bars 1–8',
        summary: 'Extend the prelude and build tempo.',
        body: [
          'Bars 5–8 add F♯ (bar 6), the first chromatic colour. Practise each bar separately at first if needed. Then aim to play all eight bars **without stopping** at ♩=72.',
        ],
        exercises: [
          follow('l9-4-a', 'Prelude bars 1–8: notes', 'Learn the new bars.', () => data(prelude(8))),
          tempo('l9-4-b', 'Prelude bars 1–8: in time', 'Even sixteenths.', () => data(prelude(8)), 56, 84),
          tempo('l9-4-c', 'Hanon 1 hands together', 'Hands an octave apart, sixteenths.', () => {
            const r = hanon1(4, 'R', 7, 0.25);
            const l = hanon1(3, 'L', 7, 0.25);
            return data(r.map((s, i) => stepOf([l[i].spelled[0], s.spelled[0]], s.beats, { hands: ['L', 'R'], fingers: [l[i].fingers?.[0] ?? null, s.fingers?.[0] ?? null] })));
          }, 56, 108),
        ],
      },
    ],
  },
  {
    id: 'l10', num: 10, name: 'Elite', tagline: 'Conservatory-level benchmarks',
    lessons: [
      {
        id: 'l10-1', title: 'Scale mastery: all keys',
        summary: 'Every major and minor scale, 3 octaves HT, ♩=120 sixteenths.',
        body: [
          'This is the scale standard of a conservatory audition: **all 24 major and minor keys, hands together, 3–4 octaves, sixteenths at ♩=120 or faster**, evenly and musically.',
          'Earn 3 stars at the target tempo on several random keys in a row. Use the **Practice Gym** to drill any specific key at any tempo.',
        ],
        exercises: [
          tempo('l10-1-a', 'Random major scale, 3 octaves HT', 'Target ♩=120 sixteenths.', () => randomScaleData('major', ALL_MAJOR_KEYS, 'B', 3, 0.25), 80, 120),
          tempo('l10-1-b', 'Random harmonic minor, 3 octaves HT', 'Target ♩=120 sixteenths.', () => randomScaleData('harmonicMinor', ['A', 'E', 'B', 'D', 'G', 'C', 'F'], 'B', 3, 0.25), 76, 120),
          tempo('l10-1-c', 'Random melodic minor, 3 octaves HT', 'Target ♩=116 sixteenths.', () => randomScaleData('melodicMinor', ['A', 'E', 'B', 'D', 'G', 'C', 'F'], 'B', 3, 0.25), 72, 116),
          tempo('l10-1-d', 'Chromatic 2 octaves RH', 'Target ♩=132 sixteenths.', () => data(chromaticSteps('C4', 'R', 2, 0.25)), 80, 132),
        ],
      },
      {
        id: 'l10-2', title: 'Arpeggio & technique mastery',
        summary: 'Fast arpeggios, Hanon at ♩=120.',
        body: [
          'Elite technique is about **relaxation at speed**. If you feel tension in your forearm, slow down. Speed comes from efficiency, not force.',
        ],
        exercises: [
          tempo('l10-2-a', 'Random arpeggio, 3 octaves RH', 'Major or minor, target ♩=112 sixteenths.', () => {
            const r = rand(['C3', 'G3', 'F3', 'D3', 'A3', 'E3']);
            const q: ChordQuality = rand(['maj', 'min']);
            return data(arpeggio(r, q, 3, 'R', 0.25), { keySig: keySignature(r.slice(0, -1), q === 'maj' ? 'major' : 'minor') });
          }, 72, 112),
          tempo('l10-2-b', 'Hanon 1 HT at speed', 'Target ♩=120 sixteenths.', () => {
            const r = hanon1(4, 'R', 7, 0.25);
            const l = hanon1(3, 'L', 7, 0.25);
            return data(r.map((s, i) => stepOf([l[i].spelled[0], s.spelled[0]], s.beats, { hands: ['L', 'R'], fingers: [l[i].fingers?.[0] ?? null, s.fingers?.[0] ?? null] })));
          }, 80, 120),
        ],
      },
      {
        id: 'l10-3', title: 'Elite musicianship',
        summary: 'Sight-reading, ear and harmony at a professional level.',
        body: [
          'Professional pianists sight-read in **any key**, hear chord qualities instantly and can play progressions in all 12 keys. These drills are randomized: a fresh challenge every attempt.',
        ],
        exercises: [
          follow('l10-3-a', 'Sight-reading: any key', 'Up to 6 sharps or flats, wide range, accidentals.', () => {
            const sig = rand([-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
            return data(randomNotes(24, 38, 89, sig, { stepwise: 0.35, chromatic: 0.12 }), { keySig: sig });
          }, { hints: 'staff', showFingers: false }),
          tempo('l10-3-b', 'Sight-reading in time: any key', 'Eighth notes, keep going!', () => {
            const sig = rand([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
            const st = randomNotes(32, 52, 81, sig, { stepwise: 0.65 }).map((s) => ({ ...s, beats: 0.5 }));
            return data(st, { keySig: sig });
          }, 60, 100, { showFingers: false }),
          ear('l10-3-c', 'Ear: seventh chords', 'Maj7, m7, dominant 7, half-diminished, diminished 7.', () =>
            data([], { rounds: earRounds(8, () => chordQualityEcho(['maj7', 'min7', 'dom7', 'm7b5', 'dim7'])) })),
          ear('l10-3-d', 'Ear: melodic dictation', 'Seven-note melodies in a random key.', () => {
            const t = rand(['C4', 'G3', 'F4', 'D4', 'A3']);
            const md = rand(['major', 'minor'] as const);
            return data([], { rounds: earRounds(5, () => melodyEcho(7, t, md)) });
          }),
          follow('l10-3-e', 'ii–V–I in all 12 keys', 'The full cycle, down in fifths.', () =>
            data(['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'F#', 'B', 'E', 'A', 'D', 'G'].flatMap((k) => twoFiveOne(k))), { showFingers: false }),
        ],
      },
      {
        id: 'l10-4', title: 'Repertoire roadmap',
        summary: 'Real pieces to learn alongside this app.',
        body: [
          'Technique and theory serve **music**. Get free scores from **IMSLP.org** and use **Free Play** in this app to monitor evenness and tempo stability while you practise them.',
          '**Early intermediate:** Bach – Minuets from the Anna Magdalena Notebook; Schumann – *Album for the Young* (“Melody”, “Soldier’s March”); Clementi – Sonatina Op. 36 No. 1; Burgmüller – Op. 100 Études.',
          '**Intermediate:** Bach – Two-Part Inventions No. 1 & 8; Chopin – Prelude Op. 28 No. 4 and No. 7; Mozart – Sonata K. 545 (1st mvt); Satie – Gymnopédie No. 1; Beethoven – Für Elise (complete).',
          '**Advanced:** Bach – Preludes & Fugues (WTC I); Chopin – Nocturne Op. 9 No. 2, Waltz Op. 64 No. 2; Beethoven – “Pathétique” Sonata; Debussy – *Clair de lune*; Czerny – Op. 299.',
          '**Elite:** Chopin – Études Op. 10 & 25, Ballade No. 1; Liszt – *Consolations*, Hungarian Rhapsody No. 2; Rachmaninoff – Prelude in C♯ minor; Beethoven – “Appassionata”. Note: some advanced repertoire needs 88 keys; the CT-S1’s 61 keys (C2–C7) cover most pieces through the intermediate level.',
          '**Habits of elite players:** practise daily (even 20 focused minutes beats a 2-hour cram), always start slowly, isolate hard spots, record yourself, and keep the body relaxed.',
        ],
        exercises: [],
      },
    ],
  },
];

export const ALL_EXERCISES: Map<string, { ex: ExerciseDef; lessonId: string; levelId: string }> = new Map();
export const LESSONS: Map<string, { lesson: (typeof LEVELS)[number]['lessons'][number]; level: Level }> = new Map();
for (const lv of LEVELS) {
  for (const ls of lv.lessons) {
    LESSONS.set(ls.id, { lesson: ls, level: lv });
    for (const ex of ls.exercises) ALL_EXERCISES.set(ex.id, { ex, lessonId: ls.id, levelId: lv.id });
  }
}
