// Practice Gym: build any drill on demand.

import { useState } from 'react';
import type { ExerciseDef, ExerciseData } from '../curriculum/types';
import { arpeggio, chordQualityEcho, data, earRounds, intervalEcho, melodyEcho, noteEcho, progressionEcho, rand, randomNotes, scaleSteps, stepOf } from '../curriculum/build';
import { chromaticSteps, randomScaleData } from '../curriculum/levels';
import { ALL_MAJOR_KEYS, ALL_MINOR_KEYS, chord, chordName, keySignature, SCALE_LABEL, type ChordQuality, type ScaleType } from '../music/theory';
import ExerciseRunner from '../components/ExerciseRunner';

type Kind = 'scale' | 'arpeggio' | 'reading' | 'chords' | 'ear';

const BEATS: Record<string, number> = { quarter: 1, eighth: 0.5, sixteenth: 0.25 };

export default function Gym() {
  const [kind, setKind] = useState<Kind>('scale');
  const [active, setActive] = useState<ExerciseDef | null>(null);
  const [runKey, setRunKey] = useState(0);

  // Scale
  const [sType, setSType] = useState<ScaleType>('major');
  const [sKey, setSKey] = useState('random');
  const [hand, setHand] = useState<'R' | 'L' | 'B'>('R');
  const [octaves, setOctaves] = useState(1);
  const [value, setValue] = useState('eighth');
  const [mode, setMode] = useState<'follow' | 'tempo'>('tempo');
  const [bpm, setBpm] = useState(72);
  // Arpeggio
  const [aQual, setAQual] = useState<ChordQuality>('maj');
  // Reading
  const [clef, setClef] = useState<'treble' | 'bass' | 'grand'>('treble');
  const [sig, setSig] = useState<number | 'random'>(0);
  const [accidentals, setAccidentals] = useState(false);
  const [length, setLength] = useState(16);
  // Chords
  const [cQuals, setCQuals] = useState<ChordQuality[]>(['maj', 'min']);
  const [showNotation, setShowNotation] = useState(false);
  // Ear
  const [earType, setEarType] = useState<'notes' | 'intervals' | 'triads' | 'sevenths' | 'melody' | 'progressions'>('intervals');

  const minorType = sType !== 'major' && sType !== 'chromatic' && sType !== 'majorPentatonic';

  const build = (): ExerciseDef => {
    const id = `gym-${kind}`;
    const beats = BEATS[value];
    if (kind === 'scale') {
      const keys = sKey === 'random' ? (minorType ? ALL_MINOR_KEYS : ALL_MAJOR_KEYS) : [sKey];
      const label = `${sKey === 'random' ? 'Random' : sKey.replace('#', '♯').replace('b', '♭')} ${SCALE_LABEL[sType]} · ${hand === 'B' ? 'hands together' : hand === 'R' ? 'RH' : 'LH'} · ${octaves} oct`;
      const b = (): ExerciseData => {
        if (sType === 'chromatic') return data(chromaticSteps(`${rand(keys)}${hand === 'L' ? 3 : 4}`, hand === 'L' ? 'L' : 'R', octaves, beats));
        if (sType === 'majorPentatonic' || sType === 'blues') {
          const t = rand(keys);
          return data(scaleSteps(`${t}${hand === 'L' ? 3 : 4}`, sType, hand === 'L' ? 'L' : 'R', Math.min(octaves, 2), beats));
        }
        return randomScaleData(sType, keys, hand, octaves, beats);
      };
      return { id: `${id}-${sType}`, title: label, kind: mode, instructions: 'Play the scale shown. Follow the fingering numbers.', build: b, bpm, targetBpm: bpm + 20, hints: mode === 'follow' ? 'keys' : 'staff', showFingers: true };
    }
    if (kind === 'arpeggio') {
      const roots = sKey === 'random' ? ['C', 'G', 'D', 'A', 'E', 'F'] : [sKey];
      return {
        id: `${id}-${aQual}`, title: `${sKey === 'random' ? 'Random' : sKey} ${aQual === 'maj' ? 'major' : aQual === 'min' ? 'minor' : aQual} arpeggio`, kind: mode,
        instructions: 'Glide the arm sideways; thumb passes under smoothly.',
        build: () => {
          const r = rand(roots);
          const h = hand === 'L' ? 'L' : 'R';
          const st = arpeggio(`${r}${h === 'L' ? 2 : 3}`, aQual, Math.min(octaves, 3), h, beats);
          const ks = aQual === 'min' ? (ALL_MINOR_KEYS.includes(r) ? keySignature(r, 'minor') : 0) : ALL_MAJOR_KEYS.includes(r) ? keySignature(r, 'major') : 0;
          return data(st, { keySig: ks });
        },
        bpm, targetBpm: bpm + 20, hints: mode === 'follow' ? 'keys' : 'staff', showFingers: true,
      };
    }
    if (kind === 'reading') {
      const [lo, hi, h] = clef === 'treble' ? [60, 81, 'R' as const] : clef === 'bass' ? [40, 60, 'L' as const] : [41, 81, undefined];
      return {
        id: `${id}-${clef}`, title: `Sight-reading: ${clef}${sig === 'random' ? ', random key' : ''}`, kind: mode,
        instructions: 'Read each note from the staff. No keyboard hints.',
        build: () => {
          const ks = sig === 'random' ? rand([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]) : sig;
          const st = randomNotes(length, lo, hi, ks, { stepwise: 0.55, chromatic: accidentals ? 0.15 : 0, hand: h }).map((s) => ({ ...s, beats: mode === 'tempo' ? beats : 1 }));
          return data(st, { keySig: ks });
        },
        bpm, targetBpm: bpm + 20, hints: 'staff', showFingers: false,
      };
    }
    if (kind === 'chords') {
      return {
        id: `${id}`, title: 'Chord-symbol drill', kind: 'follow',
        instructions: showNotation ? 'Play each chord as written.' : 'Read the chord symbol and play it, **any inversion, any octave**.',
        build: () => {
          const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'Ab', 'F#', 'Db'];
          const st = Array.from({ length: 12 }, () => {
            const r = rand(roots);
            const q = rand(cQuals);
            const tones = chord(`${r}4`, q);
            const shifted = tones[0].midi > 66 ? chord(`${r}3`, q) : tones;
            return stepOf(shifted, 2, { label: chordName(`${r}4`, q), anyOctave: !showNotation });
          });
          return data(st);
        },
        hints: showNotation ? 'staff' : 'name', showFingers: false,
      };
    }
    // Ear
    const gen = {
      notes: () => noteEcho(55, 79, false),
      intervals: () => intervalEcho([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      triads: () => chordQualityEcho(['maj', 'min', 'dim', 'aug']),
      sevenths: () => chordQualityEcho(['maj7', 'min7', 'dom7', 'm7b5', 'dim7']),
      melody: () => melodyEcho(rand([4, 5, 6]), rand(['C4', 'G3', 'F4', 'D4'])),
      progressions: () => progressionEcho(rand(['C', 'G', 'F', 'D'])),
    }[earType];
    return { id: `${id}-${earType}`, title: `Ear training: ${earType}`, kind: 'ear', instructions: 'Listen, then play back what you hear.', build: () => data([], { rounds: earRounds(8, gen) }), hints: 'staff' };
  };

  if (active) {
    return (
      <div className="page wide">
        <ExerciseRunner key={runKey} def={active} onExit={() => setActive(null)} />
      </div>
    );
  }

  const Seg = <T extends string | number>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) => (
    <div className="seg">
      {opts.map(([o, l]) => <button key={String(o)} className={o === v ? 'on' : ''} onClick={() => set(o)}>{l}</button>)}
    </div>
  );

  const keyOptions = kind === 'scale' && minorType ? ALL_MINOR_KEYS : ALL_MAJOR_KEYS;

  return (
    <div className="page">
      <h1>Practice Gym</h1>
      <p className="lead">Build any drill: any key, any tempo. Results are tracked separately from the lessons.</p>
      <Seg v={kind} set={setKind} opts={[['scale', 'Scales'], ['arpeggio', 'Arpeggios'], ['reading', 'Sight-reading'], ['chords', 'Chord symbols'], ['ear', 'Ear training']]} />

      <div className="card form">
        {kind === 'scale' && (
          <Field label="Scale type">
            <select value={sType} onChange={(e) => { setSType(e.target.value as ScaleType); setSKey('random'); }}>
              {(Object.keys(SCALE_LABEL) as ScaleType[]).map((t) => <option key={t} value={t}>{SCALE_LABEL[t]}</option>)}
            </select>
          </Field>
        )}
        {kind === 'arpeggio' && (
          <Field label="Quality"><Seg v={aQual} set={setAQual} opts={[['maj', 'Major'], ['min', 'Minor'], ['dom7', 'Dominant 7'], ['dim7', 'Dim 7']]} /></Field>
        )}
        {(kind === 'scale' || kind === 'arpeggio') && (
          <>
            <Field label="Key">
              <select value={sKey} onChange={(e) => setSKey(e.target.value)}>
                <option value="random">Random</option>
                {keyOptions.map((k) => <option key={k} value={k}>{k.replace('#', '♯').replace('b', '♭')}</option>)}
              </select>
            </Field>
            <Field label="Hand"><Seg v={hand} set={setHand} opts={kind === 'scale' ? [['R', 'Right'], ['L', 'Left'], ['B', 'Together']] : [['R', 'Right'], ['L', 'Left']]} /></Field>
            <Field label="Octaves"><Seg v={octaves} set={setOctaves} opts={[[1, '1'], [2, '2'], [3, '3']]} /></Field>
          </>
        )}
        {kind === 'reading' && (
          <>
            <Field label="Clef"><Seg v={clef} set={setClef} opts={[['treble', 'Treble'], ['bass', 'Bass'], ['grand', 'Grand staff']]} /></Field>
            <Field label="Key signature">
              <select value={String(sig)} onChange={(e) => setSig(e.target.value === 'random' ? 'random' : Number(e.target.value))}>
                <option value="random">Random</option>
                {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{s === 0 ? 'None (C / Am)' : s > 0 ? `${s} sharp${s > 1 ? 's' : ''}` : `${-s} flat${s < -1 ? 's' : ''}`}</option>)}
              </select>
            </Field>
            <Field label="Accidentals"><Seg v={accidentals ? 1 : 0} set={(x) => setAccidentals(x === 1)} opts={[[0, 'Off'], [1, 'On']]} /></Field>
            <Field label="Length"><Seg v={length} set={setLength} opts={[[8, '8'], [16, '16'], [32, '32']]} /></Field>
          </>
        )}
        {kind === 'chords' && (
          <>
            <Field label="Chord types">
              <div className="seg">
                {(['maj', 'min', 'dim', 'aug', 'sus4', 'dom7', 'maj7', 'min7', 'm7b5'] as ChordQuality[]).map((q) => (
                  <button key={q} className={cQuals.includes(q) ? 'on' : ''} onClick={() => setCQuals(cQuals.includes(q) ? (cQuals.length > 1 ? cQuals.filter((x) => x !== q) : cQuals) : [...cQuals, q])}>
                    {chordName('C4', q)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Show notation"><Seg v={showNotation ? 1 : 0} set={(x) => setShowNotation(x === 1)} opts={[[0, 'Symbol only'], [1, 'Show notes']]} /></Field>
          </>
        )}
        {kind === 'ear' && (
          <Field label="Drill">
            <Seg v={earType} set={setEarType} opts={[['notes', 'Single notes'], ['intervals', 'Intervals'], ['triads', 'Triads'], ['sevenths', '7th chords'], ['melody', 'Melodies'], ['progressions', 'Progressions']]} />
          </Field>
        )}
        {(kind === 'scale' || kind === 'arpeggio' || kind === 'reading') && (
          <>
            <Field label="Mode"><Seg v={mode} set={setMode} opts={[['follow', 'Follow (no clock)'], ['tempo', 'With metronome']]} /></Field>
            {mode === 'tempo' && (
              <>
                <Field label="Note value"><Seg v={value} set={setValue} opts={[['quarter', '♩ Quarter'], ['eighth', '♪ Eighth'], ['sixteenth', '♬ Sixteenth']]} /></Field>
                <Field label={`Tempo ♩ = ${bpm}`}><input type="range" min={30} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /></Field>
              </>
            )}
          </>
        )}
        <div className="row end">
          <button className="btn primary big" onClick={() => { setActive(build()); setRunKey((k) => k + 1); }}>Start drill →</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field-l">{label}</div>
      <div className="field-c">{children}</div>
    </div>
  );
}
