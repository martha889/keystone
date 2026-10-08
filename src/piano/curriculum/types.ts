import type { Spelled } from '../music/theory';

export interface Step {
  notes: number[]; // MIDI notes to strike together; empty = rest
  spelled: Spelled[]; // same order as notes, for the staff
  beats: number; // duration in quarter-note beats
  fingers?: (number | null)[]; // per note
  hand?: 'R' | 'L'; // forces clef (R = treble, L = bass); otherwise by pitch
  hands?: ('R' | 'L')[]; // per-note hand, for two-hand passages
  label?: string; // chord symbol / lyric / prompt
  anyOctave?: boolean; // accept the right pitch class(es) in any octave
}

export interface EarRound {
  prompt: number[][]; // groups the app plays (each group sounds together)
  steps: Step[]; // what the student must play back
  answer: string; // e.g. "Major 3rd" — shown after the round
}

export interface ExerciseData {
  steps: Step[];
  keySig?: number;
  timeSig?: [number, number];
  pickup?: number; // beats before the first bar line
  rounds?: EarRound[]; // ear training
}

export type ExerciseKind = 'follow' | 'tempo' | 'ear';

export interface ExerciseDef {
  id: string;
  title: string;
  kind: ExerciseKind;
  instructions: string;
  build: () => ExerciseData;
  bpm?: number; // starting tempo for 'tempo'
  targetBpm?: number; // mastery tempo
  hints?: 'keys' | 'staff' | 'name'; // what guides the student: keyboard highlights (+staff), staff only, or name only
  showFingers?: boolean;
  passAccuracy?: number; // 0..1, defaults to 0.75
  tips?: string[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: string[]; // paragraphs of teaching text (supports **bold**)
  figures?: ('hands' | 'posture')[]; // diagrams shown after the text
  exercises: ExerciseDef[];
}

export interface Level {
  id: string;
  num: number;
  name: string;
  tagline: string;
  lessons: Lesson[];
}
