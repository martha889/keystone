// Runs one exercise: follow mode, tempo (metronome) mode, or ear training.

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ExerciseData, ExerciseDef, Step } from '../curriculum/types';
import { input, useInputStarter, useLive, type PlayEvent } from '../../shared/audio/input';
import { audioCtx, Metronome, playChord, setClickVolume } from '../../shared/audio/synth';
import { isChordStep, matchChord, matchNow, type MatchOutcome } from '../practice/match';
import { analyse, type Report, type RunResult, type StepResult } from '../practice/feedback';
import { recordAttempt, useProgress } from '../../shared/store/progress';
import { getSettings, useSettings } from '../../shared/store/settings';
import { accSymbol, LETTERS, noteName, spelledName } from '../music/theory';
import Staff from './Staff';
import Keyboard, { rangeFor, type FingerMark, type KeyMark } from './Keyboard';
import { analyseHands, autoFinger, describePlacement, handOf } from '../music/fingering';
import { HandsDiagram, POSTURE_TIPS, PostureDiagram } from './Hands';
import Md from '../../shared/components/Md';
import RepeatPicker from '../../shared/components/RepeatPicker';
import { updateSettings } from '../../shared/store/settings';

type Phase = 'ready' | 'countin' | 'playing' | 'done';
type EarPhase = 'listen' | 'answer' | 'reveal';

interface Props {
  def: ExerciseDef;
  onExit: () => void;
  onNext?: () => void;
  nextTitle?: string;
}

interface Game {
  steps: Step[];
  results: StepResult[];
  idx: number;
  lastTime: number;
  startedAt: number;
  busy: boolean;
  strays: number;
  // tempo
  t0: number;
  beatMs: number;
  expected: number[];
  windows: number[];
  // ear
  round: number;
  roundWrongs: number;
  roundScores: number[];
  allSteps: Step[];
  allResults: StepResult[];
}

const PRAISE = ['Good!', 'Yes!', 'Nice.', 'Correct.', 'That’s it.', 'Well done.'];

function prepare(d: ExerciseData, kind: ExerciseDef['kind']): ExerciseData {
  const steps = kind === 'tempo' ? d.steps : d.steps.filter((s) => s.notes.length > 0);
  // Every exercise gets fingering: hand-written where the lesson provides it, computed otherwise.
  return { ...d, steps: autoFinger(steps), rounds: d.rounds?.map((r) => ({ ...r, steps: autoFinger(r.steps) })) };
}

/**
 * Build the exercise `n` times in a row. Randomised drills get fresh material each time
 * (as long as key and metre stay the same); the end of each pass is padded with a rest
 * so bar lines (and pickups) line up on every repetition.
 */
export function buildRepeated(def: ExerciseDef, n: number): ExerciseData {
  const first = def.build();
  if (n <= 1) return first;
  if (def.kind === 'ear') {
    const rounds = [...(first.rounds ?? [])];
    for (let i = 1; i < n; i++) rounds.push(...(def.build().rounds ?? []));
    return { ...first, rounds };
  }
  const ts = first.timeSig ?? [4, 4];
  const barBeats = (ts[0] * 4) / ts[1];
  const steps: Step[] = [];
  for (let i = 0; i < n; i++) {
    let b = i === 0 ? first : def.build();
    if (b.keySig !== first.keySig || (b.timeSig ?? [4, 4]).join() !== ts.join()) b = first;
    steps.push(...b.steps);
    if (i < n - 1) {
      const len = b.steps.reduce((a, st) => a + st.beats, 0);
      const pad = (barBeats - (len % barBeats)) % barBeats;
      if (pad > 1e-6) steps.push({ notes: [], spelled: [], beats: pad });
    }
  }
  return { ...first, steps };
}

function stepLabel(st: Step, withOctave = true) {
  return st.spelled.map((s) => spelledName(s, withOctave)).join(' + ');
}

function beatPositions(steps: Step[]) {
  const out: number[] = [];
  let b = 0;
  for (const s of steps) {
    out.push(b);
    b += s.beats;
  }
  return { pos: out, total: b };
}

export default function ExerciseRunner({ def, onExit, onNext, nextTitle }: Props) {
  const settings = useSettings();
  const progress = useProgress();
  const live = useLive();
  const [running, startInput, inputErr] = useInputStarter();
  const rec = progress.exercises[def.id];

  const [data, setData] = useState<ExerciseData>(() => prepare(buildRepeated(def, getSettings().repeats), def.kind));
  const [phase, setPhase] = useState<Phase>('ready');
  const [earPhase, setEarPhase] = useState<EarPhase>('listen');
  const [bpm, setBpm] = useState<number>(() => (rec?.bestBpm && def.bpm ? Math.min(def.targetBpm ?? 999, Math.max(def.bpm, rec.bestBpm)) : def.bpm ?? 80));
  const [coach, setCoach] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [flash, setFlash] = useState<Map<number, KeyMark>>(new Map());
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [report, setReport] = useState<(Report & { xp: number }) | null>(null);
  const [reveal, setReveal] = useState(false); // show target after repeated misses
  const [, force] = useReducer((x: number) => x + 1, 0);

  const game = useRef<Game>(newGame(data));
  const metro = useRef<Metronome | null>(null);
  const raf = useRef<number>(0);
  const flashTimer = useRef<number>(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const earPhaseRef = useRef(earPhase);
  earPhaseRef.current = earPhase;

  function newGame(d: ExerciseData): Game {
    const steps = def.kind === 'ear' ? d.rounds?.[0]?.steps ?? [] : d.steps;
    return {
      steps,
      results: steps.map((s) => ({ status: s.notes.length ? 'pending' : 'rest', wrong: [] })),
      idx: 0, lastTime: 0, startedAt: 0, busy: false, strays: 0,
      t0: 0, beatMs: 0, expected: [], windows: [],
      round: 0, roundWrongs: 0, roundScores: [], allSteps: [], allResults: [],
    };
  }

  // Cleanup on unmount
  useEffect(() => () => {
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => setClickVolume(settings.clickVolume), [settings.clickVolume]);

  const doFlash = (notes: number[], mark: KeyMark) => {
    window.clearTimeout(flashTimer.current);
    setFlash(new Map(notes.map((m) => [m, mark])));
    flashTimer.current = window.setTimeout(() => setFlash(new Map()), 450);
  };

  // ---------------- Start / restart ----------------

  // Randomised drills (sight-reading, random keys…) can be regenerated with "New version"
  const isRandom = useMemo(() => {
    const a = JSON.stringify(def.build());
    for (let i = 0; i < 6; i++) if (JSON.stringify(def.build()) !== a) return true;
    return false;
  }, [def]);
  const [regenerated, setRegenerated] = useState(false);

  /** Rebuild; with `different`, keep trying until the result actually differs from what's on screen. */
  const restart = (rebuild = true, different = false) => {
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
    let d = rebuild ? prepare(buildRepeated(def, getSettings().repeats), def.kind) : data;
    for (let i = 0; different && i < 10 && JSON.stringify(d.steps) === JSON.stringify(data.steps); i++)
      d = prepare(buildRepeated(def, getSettings().repeats), def.kind);
    setData(d);
    game.current = newGame(d);
    setPhase('ready');
    setReport(null);
    setCoach(null);
    setPlayhead(null);
    setCountBeat(null);
    setReveal(false);
  };

  const begin = async () => {
    if (!running) await startInput();
    if (!input.live.running) return;
    audioCtx();
    const g = newGame(data);
    game.current = g;
    setReport(null);
    setReveal(false);
    g.startedAt = performance.now();
    g.lastTime = performance.now();
    if (def.kind === 'follow') {
      setPhase('playing');
      setCoach({ text: def.hints === 'name' ? 'Find the named note.' : 'Play the highlighted note.', tone: 'info' });
    } else if (def.kind === 'tempo') {
      startTempo(g);
    } else {
      setPhase('playing');
      startRound(g, 0);
    }
  };

  // ---------------- Tempo ----------------

  const startTempo = (g: Game) => {
    const timeSig = data.timeSig ?? [4, 4];
    const barBeats = (timeSig[0] * 4) / timeSig[1];
    const countIn = barBeats < 2 ? barBeats * 2 : barBeats;
    const pickup = data.pickup ?? 0;
    const m = new Metronome(bpm, Math.round(barBeats < 2 ? barBeats * 2 : barBeats));
    metro.current = m;
    g.beatMs = 60000 / bpm;
    const { pos, total } = beatPositions(g.steps);
    setPhase('countin');
    const startPerf = m.start((beat) => {
      const rel = beat - (countIn - pickup);
      if (rel < 0) setCountBeat(beat + 1);
      else if (phaseRef.current === 'countin') {
        setCountBeat(null);
        setPhase('playing');
      }
    });
    g.t0 = startPerf + (countIn - pickup) * g.beatMs;
    g.expected = pos.map((p) => g.t0 + p * g.beatMs);
    // Matching window: half the gap to the nearest neighbouring note
    const playIdx = g.steps.map((s, i) => (s.notes.length ? i : -1)).filter((i) => i >= 0);
    g.windows = g.steps.map(() => 250);
    playIdx.forEach((i, k) => {
      const prev = k > 0 ? g.expected[i] - g.expected[playIdx[k - 1]] : Infinity;
      const next = k + 1 < playIdx.length ? g.expected[playIdx[k + 1]] - g.expected[i] : Infinity;
      g.windows[i] = Math.max(60, Math.min(320, 0.5 * Math.min(prev, next)));
    });
    const endTime = g.t0 + total * g.beatMs + 400;
    const loop = () => {
      const now = performance.now();
      setPlayhead((now - g.t0) / g.beatMs);
      let changed = false;
      g.steps.forEach((_, i) => {
        if (g.results[i].status === 'pending' && now > g.expected[i] + g.windows[i] + 250) {
          g.results[i].status = 'missed';
          changed = true;
        }
      });
      if (changed) force();
      if (now > endTime) {
        finish();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const onTempoEvent = (ev: PlayEvent) => {
    const g = game.current;
    const t = ev.time;
    if (t < g.t0 - g.beatMs * 0.6) return; // count-in noise
    const cands = g.steps
      .map((_, i) => i)
      .filter((i) => g.steps[i].notes.length && (g.results[i].status === 'pending' || g.results[i].status === 'wrong') && Math.abs(t - g.expected[i]) <= g.windows[i])
      .sort((a, b) => Math.abs(t - g.expected[a]) - Math.abs(t - g.expected[b]));
    if (!cands.length) {
      const last = g.expected[g.expected.length - 1] ?? 0;
      if (t > g.t0 - g.beatMs * 0.3 && t < last + 400) {
        g.strays++;
        setCoach({ text: 'Extra note (nothing expected there).', tone: 'bad' });
      }
      return;
    }
    const settle = (i: number, r: MatchOutcome) => {
      const R = g.results[i];
      if (r.partial || r.unclear) return;
      const off = Math.round(t - g.expected[i]);
      if (r.correct) {
        R.status = R.status === 'wrong' ? 'fixed' : 'correct';
        R.offsetMs = off;
        R.octaveOff = R.octaveOff || r.octaveOff;
        doFlash(g.steps[i].notes, 'good');
        setCoach(Math.abs(off) <= 45 ? { text: 'On time', tone: 'good' } : { text: off > 0 ? `Late by ${off} ms` : `Early by ${-off} ms`, tone: 'info' });
      } else {
        if (R.status === 'pending') R.status = 'wrong';
        R.wrong.push(r.heard);
        if (r.missing.length && g.steps[i].notes.length > 1) R.missingNotes = r.missing;
        R.octaveOff = R.octaveOff || r.octaveOff;
        doFlash(r.extra.length ? r.extra : r.heard, 'bad');
        setCoach({ text: wrongText(r, g.steps[i], true), tone: 'bad' });
      }
      force();
    };
    // Try candidates, preferring a correct match
    const lenient = getSettings().octaveLenient;
    const chordCand = cands.find((i) => ev.source === 'mic' && isChordStep(g.steps[i]));
    for (const i of cands) {
      const r = matchNow(ev, g.steps[i], input.live.held, lenient);
      if (r && (r.correct || r.partial)) return settle(i, r);
    }
    if (chordCand !== undefined) {
      window.setTimeout(() => settle(chordCand, matchChord(ev, input.spectrumNow(), g.steps[chordCand])), 140);
      return;
    }
    const best = cands[0];
    const r = matchNow(ev, g.steps[best], input.live.held, lenient);
    if (r) settle(best, r);
  };

  // ---------------- Follow ----------------

  const applyFollow = (ev: PlayEvent, r: MatchOutcome) => {
    const g = game.current;
    const st = g.steps[g.idx];
    if (!st) return;
    const R = g.results[g.idx];
    if (r.partial) {
      setCoach({ text: `Keep going: still need ${r.missing.map((m) => noteName(m)).join(', ')}`, tone: 'info' });
      return;
    }
    if (r.unclear) {
      setCoach({ text: 'Didn’t catch that. Strike the keys together, firmly.', tone: 'info' });
      return;
    }
    if (r.correct) {
      R.status = R.wrong.length ? 'fixed' : 'correct';
      R.timeMs = Math.max(0, ev.time - g.lastTime);
      R.octaveOff = R.octaveOff || r.octaveOff;
      g.lastTime = ev.time;
      doFlash(st.notes, 'good');
      setReveal(false);
      g.idx++;
      setCoach(
        r.octaveOff
          ? { text: 'Right note, but a different octave. Check where you are.', tone: 'info' }
          : { text: PRAISE[Math.floor(Math.random() * PRAISE.length)], tone: 'good' },
      );
      if (g.idx >= g.steps.length) {
        if (def.kind === 'ear') endRound(true);
        else finish();
      }
    } else {
      R.wrong.push(r.heard);
      if (r.missing.length && st.notes.length > 1) R.missingNotes = r.missing;
      R.octaveOff = R.octaveOff || r.octaveOff;
      if (def.kind === 'ear') g.roundWrongs++;
      doFlash(r.extra.length ? r.extra : r.heard, 'bad');
      setCoach({ text: wrongText(r, st, def.hints !== 'staff' || R.wrong.length >= 2, def.kind === 'ear'), tone: 'bad' });
      if (R.wrong.length >= 2 && def.kind !== 'ear') setReveal(true);
    }
    force();
  };

  const onFollowEvent = (ev: PlayEvent) => {
    const g = game.current;
    if (g.busy) return;
    const st = g.steps[g.idx];
    if (!st) return;
    const r = matchNow(ev, st, input.live.held, getSettings().octaveLenient);
    if (r) return applyFollow(ev, r);
    g.busy = true;
    window.setTimeout(() => {
      g.busy = false;
      if (phaseRef.current === 'playing') applyFollow(ev, matchChord(ev, input.spectrumNow(), st));
    }, 170);
  };

  // ---------------- Ear ----------------

  const playPrompt = (round: number) => {
    const rounds = data.rounds ?? [];
    const rd = rounds[round];
    if (!rd) return;
    setEarPhase('listen');
    const c = audioCtx();
    const step = rd.prompt.length > 1 ? 0.75 : 1.2;
    let t = c.currentTime + 0.1;
    for (const grp of rd.prompt) {
      playChord(grp, step * 0.95, t);
      t += step;
    }
    const ms = (t - c.currentTime) * 1000;
    input.mute(ms + 450);
    window.setTimeout(() => {
      if (phaseRef.current === 'playing' && game.current.round === round) {
        setEarPhase('answer');
        setCoach({ text: 'Your turn: play it back.', tone: 'info' });
      }
    }, ms + 300);
  };

  const startRound = (g: Game, round: number) => {
    const rd = data.rounds?.[round];
    if (!rd) return finish();
    g.round = round;
    g.steps = rd.steps;
    g.results = rd.steps.map(() => ({ status: 'pending', wrong: [] }));
    g.idx = 0;
    g.roundWrongs = 0;
    g.lastTime = performance.now();
    setCoach({ text: 'Listen…', tone: 'info' });
    force();
    playPrompt(round);
  };

  const endRound = (completed: boolean) => {
    const g = game.current;
    const score = !completed ? 0 : g.roundWrongs === 0 ? 1 : g.roundWrongs <= 2 ? 0.6 : 0.3;
    g.roundScores.push(score);
    g.allSteps.push(...g.steps);
    g.allResults.push(...g.results.map((r) => (completed ? r : { ...r, status: r.status === 'pending' ? ('missed' as const) : r.status })));
    setEarPhase('reveal');
    const rd = data.rounds?.[g.round];
    setCoach({ text: `${score === 1 ? 'Perfect!' : completed ? 'Got it.' : 'Answer:'} ${rd?.answer ?? ''}`, tone: score === 1 ? 'good' : 'info' });
    force();
    if (score === 1) window.setTimeout(() => nextRound(g.round), 1600);
  };

  const nextRound = (fromRound: number) => {
    const g = game.current;
    if (g.round !== fromRound || phaseRef.current !== 'playing') return;
    if (fromRound + 1 >= (data.rounds?.length ?? 0)) finish();
    else startRound(g, fromRound + 1);
  };

  // ---------------- Finish ----------------

  const finish = () => {
    const g = game.current;
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
    if (phaseRef.current === 'done') return;
    phaseRef.current = 'done';
    setPhase('done');
    setPlayhead(null);
    const seconds = (performance.now() - g.startedAt) / 1000;
    const run: RunResult = {
      kind: def.kind,
      steps: def.kind === 'ear' ? g.allSteps : g.steps,
      results: def.kind === 'ear' ? g.allResults : g.results.map((r) => (r.status === 'pending' ? { ...r, status: 'missed' } : r)),
      strays: g.strays,
      seconds,
      bpm: def.kind === 'tempo' ? bpm : undefined,
      keySig: data.keySig,
      roundScores: def.kind === 'ear' ? g.roundScores : undefined,
    };
    game.current.results = run.results;
    const rep = analyse(run, def);
    // Tempo exercises below the starting tempo can't earn more than 2 stars
    if (def.kind === 'tempo' && def.bpm && bpm < def.bpm && rep.stars > 2) rep.stars = 2;
    const { xp } = recordAttempt(def.id, { score: rep.score, stars: rep.stars, bpm: def.kind === 'tempo' ? bpm : undefined, seconds, confusions: rep.confusions, repeats: getSettings().repeats });
    setReport({ ...rep, xp });
    setCoach(null);
  };

  // ---------------- Event subscription ----------------

  const handlerRef = useRef<(ev: PlayEvent) => void>(() => {});
  handlerRef.current = (ev: PlayEvent) => {
    if (phaseRef.current === 'playing' || (def.kind === 'tempo' && phaseRef.current === 'countin')) {
      if (def.kind === 'tempo') onTempoEvent(ev);
      else if (def.kind === 'follow') onFollowEvent(ev);
      else if (earPhaseRef.current === 'answer') onFollowEvent(ev);
    }
  };
  useEffect(() => input.on((ev) => handlerRef.current(ev)), []);

  // Keyboard shortcuts: space = start/restart, Esc = stop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (phaseRef.current === 'ready' || phaseRef.current === 'done') void begin();
      } else if (e.code === 'Escape' && phaseRef.current !== 'ready') {
        restart(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------- Demo playback ----------------

  const demo = () => {
    const c = audioCtx();
    const all = data.steps.length ? data.steps : data.rounds?.[0]?.steps ?? [];
    // Demo one pass only, even when the exercise is repeated
    const steps = data.steps.length ? all.slice(0, Math.ceil(all.length / Math.max(1, settings.repeats))) : all;
    const spb = 60 / (def.kind === 'tempo' ? bpm : 90);
    let t = c.currentTime + 0.1;
    for (const s of steps) {
      if (s.notes.length) playChord(s.notes, Math.max(0.2, s.beats * spb * 0.95), t);
      t += s.beats * spb;
    }
    input.mute((t - c.currentTime) * 1000 + 400);
  };

  // ---------------- Render ----------------

  const g = game.current;
  const viewSteps = def.kind === 'ear' ? g.steps : data.steps;
  const statuses = g.results.map((r) => r.status);
  const curStep = phase === 'playing' && def.kind !== 'tempo' ? g.steps[g.idx] : undefined;

  const allNotes = useMemo(() => {
    const ns = def.kind === 'ear' ? (data.rounds ?? []).flatMap((r) => r.steps.flatMap((s) => s.notes)) : data.steps.flatMap((s) => s.notes);
    return ns;
  }, [data, def.kind]);
  const [lo, hi] = rangeFor(allNotes, 24);
  const handInfo = useMemo(() => (def.kind === 'ear' ? null : analyseHands(data.steps)), [data, def.kind]);

  const fingerOn = settings.showFingering && def.hints !== 'name';
  const marks = new Map<number, KeyMark>();
  const fingers = new Map<number, FingerMark>();
  const showTargets = (def.hints === 'keys' || reveal) && def.kind !== 'ear';

  // The step the student is about to play
  let focusIdx = -1;
  if (def.kind === 'follow' && phase === 'playing') focusIdx = g.idx;
  if (def.kind === 'tempo' && (phase === 'playing' || phase === 'countin'))
    focusIdx = g.steps.findIndex((st, i) => st.notes.length && g.results[i]?.status === 'pending' && (g.expected[i] ?? 0) + (g.windows[i] ?? 0) > performance.now());
  if (phase === 'ready') focusIdx = 0;
  const focusStep = focusIdx >= 0 ? g.steps[focusIdx] : undefined;

  // Hand positions: resting fingers as outlines, the finger to play now filled in
  if (fingerOn && handInfo && (phase === 'ready' || def.hints === 'keys' || reveal)) {
    const placements = phase === 'ready' ? handInfo.start : handInfo.positions.get(focusIdx) ?? handInfo.start;
    for (const pl of placements) for (const [f, m] of pl.fingers) fingers.set(m, { f, hand: pl.hand, ghost: true });
  }
  if (focusStep && (showTargets || (def.kind === 'tempo' && def.hints === 'keys')) && phase !== 'ready') {
    focusStep.notes.forEach((m, k) => {
      marks.set(m, 'target');
      const f = focusStep.fingers?.[k];
      if (fingerOn && f) fingers.set(m, { f, hand: handOf(focusStep, k) });
    });
  }
  const activeR: number[] = [];
  const activeL: number[] = [];
  if (focusStep && phase !== 'ready')
    focusStep.notes.forEach((_, k) => {
      const f = focusStep.fingers?.[k];
      if (f) (handOf(focusStep, k) === 'R' ? activeR : activeL).push(f);
    });
  // Hand moves coming up (this note or the next two) so the student can prepare
  const cue =
    fingerOn && handInfo && focusIdx >= 0 && phase !== 'ready'
      ? handInfo.shifts.filter((sh) => sh.step >= focusIdx && sh.step <= focusIdx + (def.kind === 'tempo' ? 2 : 0))
      : [];
  for (const m of live.held) if (!marks.has(m)) marks.set(m, 'live');
  flash.forEach((v, k) => marks.set(k, v));

  const doneCount = g.results.filter((r) => r.status === 'correct' || r.status === 'fixed').length;
  const playable = g.results.filter((r) => r.status !== 'rest').length;
  const rounds = data.rounds?.length ?? 0;

  return (
    <div className="runner">
      <div className="runner-head">
        <button className="btn ghost" onClick={onExit}>← Back</button>
        <div className="runner-title">
          <div className="eyebrow">{def.kind === 'follow' ? 'Follow mode: the app waits for you' : def.kind === 'tempo' ? 'Tempo mode: with metronome' : 'Ear training'}</div>
          <h2>{def.title}</h2>
        </div>
      </div>

      <p className="instructions"><Md text={def.instructions} /></p>

      {/* Main display */}
      <div className="stage">
        {def.hints === 'name' && phase === 'playing' && curStep ? (
          <div className="name-prompt">
            <div className="name-big">{curStep.label ?? curStep.spelled.map((s) => `${LETTERS[s.letter]}${accSymbol(s.acc)}`).join(' ')}</div>
            <div className="muted">{curStep.anyOctave ? (curStep.notes.length > 1 ? 'any voicing, any octave' : 'any octave') : `octave ${curStep.spelled[0].octave}`}</div>
          </div>
        ) : def.kind === 'ear' && phase === 'playing' ? (
          <div className="ear-stage">
            <div className="ear-round">Round {g.round + 1} / {rounds}</div>
            <Staff steps={viewSteps} keySig={0} timeSig={[4, 4]} statuses={statuses} current={earPhase === 'answer' ? g.idx : -1} hidden={earPhase !== 'reveal'} showFingers={fingerOn && earPhase === 'reveal'} />
            <div className="row center gap">
              <button className="btn" onClick={() => playPrompt(g.round)} disabled={earPhase === 'listen'}>🔊 Replay</button>
              {earPhase === 'answer' && <button className="btn ghost" onClick={() => endRound(false)}>Show answer</button>}
              {earPhase === 'reveal' && <button className="btn primary" onClick={() => nextRound(g.round)}>Next round →</button>}
            </div>
          </div>
        ) : def.kind !== 'ear' ? (
          <Staff
            steps={viewSteps}
            keySig={data.keySig}
            timeSig={data.timeSig}
            pickup={data.pickup}
            statuses={phase === 'ready' ? undefined : statuses}
            current={def.kind === 'follow' && phase === 'playing' ? g.idx : -1}
            playheadBeat={def.kind === 'tempo' && (phase === 'playing' || phase === 'countin') ? playhead : null}
            showFingers={fingerOn}
          />
        ) : (
          <div className="ear-stage"><div className="ear-round">{rounds} rounds. Listen, then play back what you hear.</div></div>
        )}

        {phase === 'countin' && countBeat !== null && <div className="countin">{countBeat}</div>}

        {coach && phase !== 'done' && phase !== 'ready' && <div className={`coach coach-${coach.tone}`}>{coach.text}</div>}

        {cue.map((c) => (
          <div key={`${c.step}${c.hand}`} className="cue">{c.step === focusIdx ? '↪ ' : 'Coming up: '}{c.text}</div>
        ))}
        {fingerOn && focusStep && phase === 'playing' && def.kind !== 'ear' && (
          <div className="next-finger">
            {(['L', 'R'] as const).map((h) => {
              const fs = focusStep.notes.map((m, k) => ({ m, k, f: focusStep.fingers?.[k] })).filter((x) => x.f && handOf(focusStep, x.k) === h);
              if (!fs.length) return null;
              const showNotes = showTargets;
              return (
                <span key={h}>
                  {h === 'R' ? ' Right hand ' : ' Left hand '}
                  <strong className={h}>finger{fs.length > 1 ? 's' : ''} {fs.map((x) => x.f).join('-')}</strong>
                  {showNotes ? ` on ${fs.map((x) => noteName(x.m)).join(' ')}` : ''}
                  {h === 'L' && focusStep.notes.some((_, k) => handOf(focusStep, k) === 'R') ? ' ·' : ''}
                </span>
              );
            })}
          </div>
        )}

        {phase === 'ready' && (
          <div className="ready">
            {def.kind === 'tempo' && (
              <label className="bpm">
                <span>Tempo ♩ = <strong>{bpm}</strong></span>
                <input type="range" min={30} max={(def.targetBpm ?? 120) + 40} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                <span className="muted small">
                  Start {def.bpm} · target {def.targetBpm}
                  {rec?.bestBpm ? ` · your best ${rec.bestBpm}` : ''}
                </span>
              </label>
            )}
            <RepeatPicker
              value={settings.repeats}
              unit={def.kind === 'ear' ? 'set' : 'time'}
              seconds={def.kind === 'tempo' ? (data.steps.reduce((a, st) => a + st.beats, 0) + (data.timeSig?.[0] ?? 4)) * (60 / bpm) : undefined}
              onChange={(n) => {
                updateSettings({ repeats: n });
                const d = prepare(buildRepeated(def, n), def.kind);
                setData(d);
                game.current = newGame(d);
              }}
            />
            {fingerOn && handInfo && handInfo.start.length > 0 && (
              <div className="handpos" aria-label="Starting hand position">
                <div className="muted small" style={{ gridColumn: '1 / -1' }}>Place your hands before you start:</div>
                {handInfo.start.map((pl) => (
                  <div key={pl.hand} style={{ display: 'contents' }}>
                    <div className={`hp-hand hp-${pl.hand}`}>{pl.hand === 'R' ? 'Right hand' : 'Left hand'}</div>
                    <div>{describePlacement(pl)}</div>
                  </div>
                ))}
                {handInfo.shifts.length > 0 && (
                  <div className="muted small" style={{ gridColumn: '1 / -1' }}>
                    Your hand moves {handInfo.shifts.length} time{handInfo.shifts.length > 1 ? 's' : ''} in this exercise. The app warns you just before each move.
                  </div>
                )}
              </div>
            )}
            <div className="row center gap wrap">
              <button className="btn primary big" onClick={() => void begin()}>
                {running ? '▶ Start' : settings.inputMode === 'midi' ? '🎹 Connect MIDI & start' : '🎤 Enable microphone & start'}
              </button>
              {def.kind !== 'ear' && <button className="btn" onClick={demo}>🔊 Listen first</button>}
              {def.kind !== 'ear' && isRandom && (
                <button
                  className="btn ghost"
                  title="Generate a different version of this drill"
                  onClick={() => {
                    restart(true, true);
                    setRegenerated(true);
                    window.setTimeout(() => setRegenerated(false), 1600);
                  }}
                >
                  ↻ New version
                </button>
              )}
              {regenerated && <span className="muted small" role="status">New version ready</span>}
            </div>
            {inputErr && <div className="error">{inputErr}</div>}
            <div className="muted small center">Press <kbd>Space</kbd> to start, <kbd>Esc</kbd> to stop.</div>
            <details className="howto">
              <summary>How to hold your hands</summary>
              <PostureDiagram />
              <ul>{POSTURE_TIPS.map((t, i) => <li key={i}><Md text={t} /></li>)}</ul>
            </details>
          </div>
        )}

        {phase === 'done' && report && (
          <Results report={report} onRetry={() => restart(true)} onNext={onNext} nextTitle={nextTitle} onExit={onExit} />
        )}
      </div>

      <div className="kb-row">
        {fingerOn && def.kind !== 'ear' && <HandsDiagram activeL={activeL} activeR={activeR} compact />}
        <div className="kb-wrap" style={{ flexBasis: Math.max(560, whiteCount(lo, hi) * 40) }}>
          <Keyboard lo={lo} hi={hi} marks={marks} fingers={fingers} showNames={settings.showNoteNames && def.hints === 'keys'} />
        </div>
      </div>

      {(phase === 'playing' || phase === 'countin') && (
        <div className="row between runner-foot">
          <div className="progress-bar">
            <div style={{ width: `${def.kind === 'ear' ? (g.round / Math.max(1, rounds)) * 100 : (doneCount / Math.max(1, playable)) * 100}%` }} />
          </div>
          <div className="row gap">
            {def.kind === 'follow' && (
              <button className="btn ghost small" onClick={() => setReveal(true)}>Hint</button>
            )}
            <button className="btn ghost small" onClick={() => restart(false)}>■ Stop</button>
            {def.kind === 'follow' && g.idx > 0 && <button className="btn ghost small" onClick={finish}>Finish now</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function whiteCount(lo: number, hi: number) {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) n++;
  return n;
}

function wrongText(r: MatchOutcome, st: Step, revealTarget: boolean, isEar = false): string {
  if (st.notes.length > 1) {
    const parts: string[] = [];
    if (r.missing.length) parts.push(`missing ${r.missing.map((m) => noteName(m)).join(', ')}`);
    if (r.extra.length) parts.push(`extra ${r.extra.map((m) => noteName(m)).join(', ')}`);
    return `Not quite: ${parts.join('; ') || 'try again'}. Play all notes together.`;
  }
  const h = r.heard[0];
  if (h === undefined) return 'Couldn’t hear that clearly. Play a bit firmer.';
  const target = st.notes[0];
  if (r.octaveOff) return `Right letter, wrong octave. Heard ${noteName(h)}${revealTarget && !isEar ? `, need ${stepLabel(st)}` : ''}.`;
  const dir = h < target ? 'higher' : 'lower';
  if (isEar) return `Heard ${noteName(h)}. Try ${dir}.`;
  return revealTarget ? `Heard ${noteName(h)}. Looking for ${stepLabel(st, !st.anyOctave)}.` : `Heard ${noteName(h)}. Try ${dir}.`;
}

function Results({ report, onRetry, onNext, nextTitle, onExit }: { report: Report & { xp: number }; onRetry: () => void; onNext?: () => void; nextTitle?: string; onExit: () => void }) {
  return (
    <div className="results">
      <div className="stars" aria-label={`${report.stars} of 3 stars`}>
        {[1, 2, 3].map((i) => <span key={i} className={i <= report.stars ? 'star on' : 'star'}>★</span>)}
      </div>
      <h3>{report.headline}</h3>
      <div className="score">{Math.round(report.score * 100)}%<span className="xp">+{report.xp} XP</span></div>
      <div className="stats">
        {report.stats.map((s) => (
          <div key={s.label} className={`stat ${s.tone ?? ''}`}>
            <div className="stat-v">{s.value}</div>
            <div className="stat-l">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="tips">
        <h4>Coach’s notes</h4>
        <ul>{report.tips.map((t, i) => <li key={i}><Md text={t} /></li>)}</ul>
      </div>
      <div className="row center gap wrap">
        <button className="btn primary" onClick={onRetry}>↻ Try again</button>
        {onNext && <button className="btn" onClick={onNext}>Next: {nextTitle ?? 'exercise'} →</button>}
        <button className="btn ghost" onClick={onExit}>Back to lesson</button>
      </div>
    </div>
  );
}
