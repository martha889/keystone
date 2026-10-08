// Drum practice gym: any rudiment, groove, reading drill or clock test at any tempo.

import { useState } from 'react';
import { callResponse, concat, groove, randomRhythm, repeat, silent, sticks, type DrumExercise } from '../engine/pattern';
import DrumRunner from '../components/DrumRunner';

const RUDIMENTS: [string, string, number][] = [
  ['Single strokes', 'R L R L R L R L R L R L R L R L', 4],
  ['Double strokes', 'R R L L R R L L R R L L R R L L', 4],
  ['Single paradiddle', 'R L R R L R L L R L R R L R L L', 4],
  ['Double paradiddle', 'R L R L R R L R L R L L', 3],
  ['Paradiddle-diddle', 'R L R R L L R L R R L L', 3],
  ['Triple stroke', 'R R R L L L R R R L L L', 3],
  ['Six-stroke roll', '>R L L R R >L >R L L R R >L', 3],
  ['Flam taps', 'fR R fL L fR R fL L fR R fL L fR R fL L', 4],
  ['Flam accents', 'fR L R fL R L fR L R fL R L', 3],
  ['Accented singles', '>R L R L >R L R L >R L R L >R L R L', 4],
];

const GROOVES: [string, Parameters<typeof groove>[0]][] = [
  ['Rock', { rows: { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...' } }],
  ['Rock (16th hi-hat)', { sub: 4, rows: { hh: 'xxxxxxxxxxxxxxxx', sn: '....x.......x...', bd: 'x.....x.x.......' } }],
  ['Funk ghost notes', { sub: 4, rows: { hh: 'x.x.x.x.x.x.x.x.', sn: '....X..g.g..X..g', bd: 'x.x.......x..x..' } }],
  ['Disco', { rows: { hh: 'x.x.x.x.', ho: '.x.x.x.x', sn: '..x...x.', bd: 'x.x.x.x.' } }],
  ['Shuffle', { sub: 3, rows: { hh: 'x.xx.xx.xx.x', sn: '...x.....x..', bd: 'x.....x.....' } }],
  ['Jazz swing', { sub: 3, rows: { rd: 'x..x.xx..x.x', hp: '...x.....x..' } }],
  ['Half-time', { sub: 4, rows: { hh: 'x.xxx.xxx.xxx.xx', sn: '........X.....g.', bd: 'x.....x..x......' } }],
  ['Bossa nova', { rows: { rd: 'xxxxxxxx|xxxxxxxx', sn: 'x..x..x.|..x..x..', bd: 'x..xx..x|x..xx..x' } }],
];

export function DrumGym() {
  const [kind, setKind] = useState<'rudiment' | 'groove' | 'reading' | 'echo' | 'clock'>('rudiment');
  const [rud, setRud] = useState(0);
  const [gr, setGr] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [bars, setBars] = useState(4);
  const [sub, setSub] = useState<2 | 4>(2);
  const [mode, setMode] = useState<'tempo' | 'follow'>('tempo');
  const [active, setActive] = useState<DrumExercise | null>(null);
  const [runKey, setRunKey] = useState(0);

  const build = (): DrumExercise => {
    const base = { kind: mode, bpm, targetBpm: bpm + 20 } as const;
    if (kind === 'rudiment') {
      const [name, toks, s] = RUDIMENTS[rud];
      const perBar = toks.split(/\s+/).length / (s * 4);
      return { ...base, id: `dgym-rud-${rud}`, title: name, instructions: 'Rudiment on the snare. Follow the sticking.', build: () => sticks(toks, s, { repeat: Math.max(1, Math.round(bars / perBar)) }) };
    }
    if (kind === 'groove') {
      const [name, spec] = GROOVES[gr];
      return { ...base, id: `dgym-gr-${gr}`, title: `${name} groove`, instructions: 'Lock the groove with the click.', build: () => {
        const one = groove(spec);
        return repeat(one, Math.max(1, Math.round(bars / one.bars)));
      } };
    }
    if (kind === 'reading') return { ...base, id: `dgym-read-${sub}`, title: `Reading: ${sub === 2 ? 'eighths' : 'sixteenths'}`, instructions: 'A new rhythm each attempt.', build: () => concat(...Array.from({ length: bars }, () => randomRhythm(sub, sub === 2 ? 0.55 : 0.45))) };
    if (kind === 'echo') return { ...base, kind: 'tempo', id: `dgym-echo-${sub}`, title: 'Call and response', instructions: 'Listen to the grey bar, then copy it.', build: () => callResponse(Math.max(1, Math.round(bars / 2)), sub, 0.5) };
    return {
      ...base, kind: 'tempo', id: 'dgym-clock', title: 'Clock test', instructions: 'Two bars with click, two without. Keep the time steady.',
      build: () => {
        const r = groove({ rows: { hh: 'xxxxxxxx', sn: '..x...x.', bd: 'x...x...' }, repeat: 2 });
        return concat(...Array.from({ length: Math.max(1, Math.round(bars / 4)) }, () => concat(r, silent(r))), groove({ rows: { cr: 'x.......', bd: 'x.......' } }));
      },
    };
  };

  if (active) return <div className="page wide"><DrumRunner key={runKey} def={active} onExit={() => setActive(null)} /></div>;

  const Seg = <T extends string | number>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) => (
    <div className="seg">{opts.map(([o, l]) => <button key={String(o)} className={o === v ? 'on' : ''} onClick={() => set(o)}>{l}</button>)}</div>
  );
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="field"><div className="field-l">{label}</div><div className="field-c">{children}</div></div>
  );

  return (
    <div className="page">
      <h1>Drums: practice gym</h1>
      <p className="lead">Any rudiment, groove or reading drill at any tempo.</p>
      <Seg v={kind} set={setKind} opts={[['rudiment', 'Rudiments'], ['groove', 'Grooves'], ['reading', 'Reading'], ['echo', 'Call & response'], ['clock', 'Clock test']]} />
      <div className="card form">
        {kind === 'rudiment' && <Field label="Rudiment"><select value={rud} onChange={(e) => setRud(Number(e.target.value))}>{RUDIMENTS.map(([n], i) => <option key={n} value={i}>{n}</option>)}</select></Field>}
        {kind === 'groove' && <Field label="Groove"><select value={gr} onChange={(e) => setGr(Number(e.target.value))}>{GROOVES.map(([n], i) => <option key={n} value={i}>{n}</option>)}</select></Field>}
        {(kind === 'reading' || kind === 'echo') && <Field label="Note values"><Seg v={sub} set={setSub} opts={[[2, 'Eighths'], [4, 'Sixteenths']]} /></Field>}
        {(kind === 'rudiment' || kind === 'groove') && <Field label="Mode"><Seg v={mode} set={setMode} opts={[['tempo', 'With metronome'], ['follow', 'Follow (no clock)']]} /></Field>}
        <Field label="Length"><Seg v={bars} set={setBars} opts={[[2, '2 bars'], [4, '4 bars'], [8, '8 bars']]} /></Field>
        <Field label={`Tempo ♩ = ${bpm}`}><input type="range" min={40} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /></Field>
        <div className="row end"><button className="btn primary big" onClick={() => { setActive(build()); setRunKey((k) => k + 1); }}>Start drill →</button></div>
      </div>
    </div>
  );
}
