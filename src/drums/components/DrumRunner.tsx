// Runs one drum exercise: follow mode (waits for you) or tempo mode (with metronome).

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { input, useLive, type PlayEvent, type RawHit } from '../../shared/audio/input';
import { audioCtx, Metronome, perfToCtxTime, setClickVolume } from '../../shared/audio/synth';
import { recordAttempt, useProgress } from '../../shared/store/progress';
import Md from '../../shared/components/Md';
import { INSTS, LIMB_NAME, getDrumSettings, instForNote, sameFamily, updateDrumSettings, useDrumSettings, type Inst, type Limb } from '../engine/kit';
import RepeatPicker from '../../shared/components/RepeatPicker';
import { assignLimbs, concat, totalBeats, type DrumData, type DrumExercise, type DStep } from '../engine/pattern';
import { analyseTempo, expectedHits, scoreRun, starsFor, type DrumReport, type Expected, type PlayedHit } from '../engine/score';
import { playDrum } from '../engine/sound';
import DrumStaff, { type StepMark } from './DrumStaff';
import KitDiagram, { type PadMark } from './KitDiagram';
import { DRUM_TECHNIQUE_TIPS, DrumPostureDiagram, GripDiagram } from './Figures';

type Phase = 'ready' | 'countin' | 'playing' | 'done';

interface Props {
  def: DrumExercise;
  onExit: () => void;
  onNext?: () => void;
  nextTitle?: string;
}

/** The exercise played `n` times in a row (random drills get fresh material each pass). */
function build(def: DrumExercise, n = 1): DrumData {
  return assignLimbs(n <= 1 ? def.build() : concat(...Array.from({ length: n }, () => def.build())));
}

const VEL = { n: 0.75, a: 1, g: 0.3 } as const;

export default function DrumRunner({ def, onExit, onNext, nextTitle }: Props) {
  const ds = useDrumSettings();
  const live = useLive();
  const progress = useProgress();
  const rec = progress.exercises[def.id];
  const mode = ds.input;
  const running = live.running && live.source === mode;

  const [data, setData] = useState<DrumData>(() => build(def, getDrumSettings().repeats));
  const [phase, setPhase] = useState<Phase>('ready');
  const [bpm, setBpm] = useState(() => (rec?.bestBpm && def.bpm ? Math.min(def.targetBpm ?? 999, Math.max(def.bpm, rec.bestBpm)) : def.bpm ?? 80));
  const [coach, setCoach] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [flash, setFlash] = useState<Map<Inst, PadMark>>(new Map());
  const [stepMarks, setStepMarks] = useState<Map<number, StepMark>>(new Map());
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [report, setReport] = useState<(DrumReport & { xp: number }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;
  const g = useRef({
    t0: 0, beatMs: 0, startedAt: 0, expected: [] as Expected[], played: [] as PlayedHit[],
    idx: 0, remaining: [] as Inst[], lastDone: { inst: null as Inst | null, time: 0 }, wrong: 0, wrongs: [] as { want: Inst; got: Inst }[], stepHadWrong: false, followSteps: [] as number[],
  });
  const metro = useRef<Metronome | null>(null);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const flashTimer = useRef(0);

  useEffect(() => setClickVolume(ds.clickVolume), [ds.clickVolume]);
  useEffect(
    () => () => {
      metro.current?.stop();
      cancelAnimationFrame(raf.current);
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const doFlash = (insts: Inst[], state: 'good' | 'bad') => {
    window.clearTimeout(flashTimer.current);
    setFlash(new Map(insts.map((i) => [i, { state }])));
    flashTimer.current = window.setTimeout(() => setFlash(new Map()), 260);
  };

  const ensureInput = async () => {
    setErr(null);
    if (running) return true;
    try {
      await input.start(mode);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  // ---------------- Start ----------------

  // Randomised drills (reading, call and response…) can be regenerated with "New version"
  const isRandom = useMemo(() => {
    const a = JSON.stringify(def.build());
    for (let i = 0; i < 6; i++) if (JSON.stringify(def.build()) !== a) return true;
    return false;
  }, [def]);
  const [regenerated, setRegenerated] = useState(false);

  /** Rebuild; with `different`, keep trying until the result actually differs from what's on screen. */
  const reset = (rebuild: boolean, different = false) => {
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (rebuild) {
      let d = build(def, getDrumSettings().repeats);
      for (let i = 0; different && i < 10 && JSON.stringify(d.steps) === JSON.stringify(data.steps); i++) d = build(def, getDrumSettings().repeats);
      setData(d);
    }
    setPhase('ready');
    setReport(null);
    setCoach(null);
    setPlayhead(null);
    setCountBeat(null);
    setStepMarks(new Map());
  };

  const begin = async () => {
    if (!(await ensureInput())) return;
    audioCtx();
    const st = g.current;
    st.played = [];
    st.wrong = 0;
    st.wrongs = [];
    st.startedAt = performance.now();
    setReport(null);
    setStepMarks(new Map());
    if (def.kind === 'follow') {
      st.followSteps = data.steps.map((_, i) => i).filter((i) => !data.callBars?.includes(Math.floor(data.steps[i].pos / data.beatsPerBar)));
      st.idx = 0;
      st.remaining = data.steps[st.followSteps[0]].hits.map((h) => h.inst);
      st.stepHadWrong = false;
      setPhase('playing');
      setCoach({ text: 'Hit the highlighted pads. Take your time.', tone: 'info' });
    } else startTempo();
  };

  const startTempo = () => {
    const st = g.current;
    const bpb = data.beatsPerBar;
    const m = new Metronome(bpm, bpb);
    metro.current = m;
    st.beatMs = 60000 / bpm;
    const countIn = bpb;
    m.shouldClick = (b) => b < countIn || !data.silentBars?.includes(Math.floor((b - countIn) / bpb));
    setPhase('countin');
    const startPerf = m.start((b) => {
      if (b < countIn) setCountBeat(b + 1);
      else if (phaseRef.current === 'countin') {
        setCountBeat(null);
        setPhase('playing');
      }
    });
    st.t0 = startPerf + countIn * st.beatMs;
    st.expected = expectedHits(data, st.t0, st.beatMs);
    // Handy for debugging (and automated tests) from the browser console
    (globalThis as unknown as { __drumRun?: unknown }).__drumRun = { t0: st.t0, beatMs: st.beatMs, expected: st.expected };
    // The app plays the "call" bars itself
    if (data.callBars?.length) {
      for (const s of data.steps) {
        const bar = Math.floor(s.pos / bpb);
        if (!data.callBars.includes(bar)) continue;
        for (const h of s.hits) playDrum(h.inst, perfToCtxTime(st.t0 + s.pos * st.beatMs), VEL[h.dyn]);
      }
      if (mode === 'mic')
        for (const bar of data.callBars) {
          const at = st.t0 + bar * bpb * st.beatMs - performance.now() - 40;
          timers.current.push(window.setTimeout(() => input.mute(bpb * st.beatMs + 80), Math.max(0, at)));
        }
    }
    const end = st.t0 + totalBeats(data) * st.beatMs + 700;
    const loop = () => {
      const now = performance.now();
      setPlayhead((now - st.t0) / st.beatMs);
      if (now > end) return finishTempo();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  // ---------------- Hits ----------------

  const onHit = (hit: PlayedHit) => {
    const st = g.current;
    const ph = phaseRef.current;
    if (hit.inst) doFlash([hit.inst], 'good');
    if (ph === 'playing' && def.kind === 'follow') return followHit(hit);
    if ((ph === 'playing' || ph === 'countin') && def.kind === 'tempo') {
      if (hit.time < st.t0 - st.beatMs * 0.6) return;
      st.played.push(hit);
      // Live feedback against the nearest written hit
      const cands = st.expected.filter((e) => Math.abs(e.t - hit.time) < Math.min(160, st.beatMs * 0.5));
      if (!cands.length) {
        if (hit.time < st.t0 + totalBeats(data) * st.beatMs) setCoach({ text: 'Extra hit (nothing written there)', tone: 'bad' });
        return;
      }
      const same = hit.inst === null ? cands : cands.filter((e) => e.inst === hit.inst || sameFamily(e.inst, hit.inst!));
      const best = (same.length ? same : cands).reduce((a, b) => (Math.abs(a.t - hit.time) < Math.abs(b.t - hit.time) ? a : b));
      const off = Math.round(hit.time - best.t);
      const okPad = same.length > 0;
      setStepMarks((m) => new Map(m).set(best.step, okPad ? (Math.abs(off) <= 30 ? 'good' : 'warn') : 'bad'));
      if (!okPad) {
        doFlash([hit.inst!], 'bad');
        setCoach({ text: `Wrong pad: ${INSTS[hit.inst!].name} (wanted ${INSTS[best.inst].name})`, tone: 'bad' });
      } else setCoach(Math.abs(off) <= 30 ? { text: 'In the pocket', tone: 'good' } : { text: off > 0 ? `Late by ${off} ms` : `Early by ${-off} ms`, tone: 'info' });
    }
  };

  const followHit = (hit: PlayedHit) => {
    const st = g.current;
    const si = st.followSteps[st.idx];
    const step = data.steps[si];
    if (!step) return;
    // Ignore the second stroke of a flam (or a double trigger) right after finishing a step
    if (hit.time - st.lastDone.time < 45 && (hit.inst === null || hit.inst === st.lastDone.inst)) return;
    const k = hit.inst === null ? 0 : st.remaining.findIndex((i) => i === hit.inst || sameFamily(i, hit.inst!));
    if (k >= 0) {
      // The microphone can't tell pads apart: one attack completes the whole step
      if (hit.inst === null) st.remaining = [];
      else st.remaining.splice(k, 1);
      st.lastDone = { inst: hit.inst, time: hit.time };
      if (!st.remaining.length) {
        setStepMarks((m) => new Map(m).set(si, st.stepHadWrong ? 'warn' : 'good'));
        st.idx++;
        st.stepHadWrong = false;
        if (st.idx >= st.followSteps.length) return finishFollow();
        st.remaining = data.steps[st.followSteps[st.idx]].hits.map((h) => h.inst);
        setCoach({ text: 'Good', tone: 'good' });
      } else setCoach({ text: `Now also: ${st.remaining.map((i) => INSTS[i].name).join(' + ')}`, tone: 'info' });
      force();
    } else {
      st.wrong++;
      st.stepHadWrong = true;
      st.wrongs.push({ want: st.remaining[0], got: hit.inst! });
      doFlash([hit.inst!], 'bad');
      setCoach({ text: `That was ${INSTS[hit.inst!].name}. Next: ${describeStep(step).join(', ')}`, tone: 'bad' });
    }
  };

  // Subscribe to input
  const handler = useRef(onHit);
  handler.current = onHit;
  useEffect(() => {
    const offRaw = input.onRaw((h: RawHit) => {
      const inst = instForNote(h.note);
      if (!inst) {
        setCoach({ text: `Unknown pad (MIDI note ${h.note}). Teach the app your kit in Drums › Setup.`, tone: 'info' });
        return;
      }
      handler.current({ inst, time: h.time, vel: h.vel });
    });
    const offMic = input.on((ev: PlayEvent) => {
      if (ev.source === 'mic') handler.current({ inst: null, time: ev.time, vel: 64 });
    });
    return () => {
      offRaw();
      offMic();
    };
  }, []);

  // Space / Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.code === 'Space' && (phaseRef.current === 'ready' || phaseRef.current === 'done')) {
        e.preventDefault();
        void begin();
      } else if (e.code === 'Escape' && phaseRef.current !== 'ready') reset(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------- Finish ----------------

  const finishTempo = () => {
    if (phaseRef.current === 'done') return;
    phaseRef.current = 'done';
    metro.current?.stop();
    cancelAnimationFrame(raf.current);
    const st = g.current;
    const { results, extras } = scoreRun(st.expected, st.played);
    const marks = new Map<number, StepMark>();
    const rank = { good: 0, warn: 1, bad: 2 } as const;
    for (const r of results) {
      const m: StepMark = r.status === 'hit' ? (Math.abs(r.offset ?? 0) <= 30 ? 'good' : 'warn') : r.status === 'near' ? 'warn' : 'bad';
      const prev = marks.get(r.exp.step) as keyof typeof rank | undefined;
      if (!prev || rank[m as keyof typeof rank] > rank[prev]) marks.set(r.exp.step, m);
    }
    setStepMarks(marks);
    const rep = analyseTempo(results, extras, { bpm, targetBpm: def.targetBpm, startBpm: def.bpm, mic: mode === 'mic' });
    const { xp } = recordAttempt(def.id, { score: rep.score, stars: rep.stars, bpm, seconds: (performance.now() - st.startedAt) / 1000, repeats: getDrumSettings().repeats });
    setReport({ ...rep, xp });
    setPhase('done');
    setPlayhead(null);
    setCoach(null);
  };

  const finishFollow = () => {
    phaseRef.current = 'done';
    const st = g.current;
    const total = st.followSteps.length;
    const score = total / (total + st.wrong);
    const stars = starsFor(score);
    const tips: string[] = [];
    const conf: Record<string, number> = {};
    for (const w of st.wrongs) {
      const k = `${INSTS[w.want].name}>${INSTS[w.got].name}`;
      conf[k] = (conf[k] ?? 0) + 1;
    }
    for (const [k, c] of Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      const [a, b] = k.split('>');
      tips.push(`You hit **${b}** when **${a}** was next${c > 1 ? ` (${c}×)` : ''}. Find it on the kit diagram before you start.`);
    }
    tips.push(score >= 0.95 ? 'Coordination is solid. Now try it with the metronome (tempo exercise).' : 'Play it through slowly once more, saying the limbs out loud (“right hand, left hand, foot…”).');
    const rep: DrumReport = {
      score, stars, headline: stars === 3 ? 'Superb!' : stars >= 1 ? 'Nice work' : 'Keep practising',
      stats: [
        { label: 'Steps', value: String(total) },
        { label: 'Wrong pads', value: String(st.wrong), tone: st.wrong ? 'warn' : 'good' },
      ],
      tips,
    };
    const { xp } = recordAttempt(def.id, { score, stars, seconds: (performance.now() - st.startedAt) / 1000, repeats: getDrumSettings().repeats });
    setReport({ ...rep, xp });
    setPhase('done');
    setCoach(null);
  };

  // ---------------- Demo ----------------

  const demo = () => {
    const c = audioCtx();
    const beat = 60 / (def.kind === 'tempo' ? bpm : 80);
    const t = c.currentTime + 0.1;
    // Demo one pass only, even when the exercise is repeated
    const passBeats = totalBeats(data) / Math.max(1, ds.repeats);
    for (const s of data.steps) if (s.pos < passBeats) for (const h of s.hits) playDrum(h.inst, t + s.pos * beat, VEL[h.dyn]);
    if (mode === 'mic') input.mute(passBeats * beat * 1000 + 400);
  };

  // ---------------- Render ----------------

  const st = g.current;
  let nextStep: DStep | undefined;
  let curIdx = -1;
  if (phase === 'playing' && def.kind === 'follow') {
    curIdx = st.followSteps[st.idx];
    nextStep = data.steps[curIdx];
  } else if ((phase === 'playing' || phase === 'countin') && def.kind === 'tempo') {
    const now = performance.now();
    const e = st.expected.find((x) => x.t > now - 40);
    if (e) nextStep = data.steps[e.step];
  } else if (phase === 'ready') nextStep = data.steps.find((s) => !data.callBars?.includes(Math.floor(s.pos / data.beatsPerBar)));

  const padMarks = new Map<Inst, PadMark>();
  if (nextStep)
    for (const h of nextStep.hits) {
      const remaining = def.kind === 'follow' && phase === 'playing' ? st.remaining.includes(h.inst) : true;
      if (remaining) padMarks.set(h.inst, { state: 'next', limb: h.limb });
    }
  flash.forEach((v, k) => padMarks.set(k, { ...padMarks.get(k), ...v }));

  // Which limb plays which pads in this exercise (for the ready card)
  const limbMap = new Map<Limb, Set<string>>();
  for (const s of data.steps)
    for (const h of s.hits) {
      if (!h.limb) continue;
      if (!limbMap.has(h.limb)) limbMap.set(h.limb, new Set());
      limbMap.get(h.limb)!.add(INSTS[h.inst].name);
    }

  const progressPct =
    def.kind === 'follow' ? (st.idx / Math.max(1, st.followSteps.length)) * 100 : playhead !== null ? Math.min(100, (Math.max(0, playhead) / totalBeats(data)) * 100) : 0;

  return (
    <div className="runner">
      <div className="runner-head">
        <button className="btn ghost" onClick={onExit}>← Back</button>
        <div className="runner-title">
          <div className="eyebrow">{def.kind === 'follow' ? 'Follow mode: the app waits for you' : 'Tempo mode: with metronome'}</div>
          <h2>{def.title}</h2>
        </div>
      </div>
      <p className="instructions"><Md text={def.instructions} /></p>

      <div className="stage">
        <DrumStaff
          data={data}
          marks={stepMarks}
          current={def.kind === 'follow' && phase === 'playing' ? curIdx : -1}
          playheadBeat={def.kind === 'tempo' && (phase === 'playing' || phase === 'countin') ? playhead : null}
        />
        {phase === 'countin' && countBeat !== null && <div className="countin">{countBeat}</div>}
        {coach && phase !== 'ready' && phase !== 'done' && <div className={`coach coach-${coach.tone}`}>{coach.text}</div>}
        {nextStep && phase === 'playing' && (
          <div className="next-finger">
            {describeStep(nextStep, def.kind === 'follow' ? st.remaining : undefined).map((d, i) => (
              <span key={i}>{i ? ' · ' : ''}<Md text={d} /></span>
            ))}
          </div>
        )}

        {phase === 'ready' && (
          <div className="ready">
            {def.kind === 'tempo' && (
              <label className="bpm">
                <span>Tempo ♩ = <strong>{bpm}</strong>{data.timeSig[1] === 8 ? ' (eighth-note clicks)' : ''}</span>
                <input type="range" min={30} max={(def.targetBpm ?? 120) + 50} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                <span className="muted small">Start {def.bpm} · target {def.targetBpm}{rec?.bestBpm ? ` · your best ${rec.bestBpm}` : ''}</span>
              </label>
            )}
            <RepeatPicker
              value={ds.repeats}
              seconds={def.kind === 'tempo' ? (totalBeats(data) + data.beatsPerBar) * (60 / bpm) : undefined}
              onChange={(n) => {
                updateDrumSettings({ repeats: n });
                setData(build(def, n));
              }}
            />
            <div className="handpos">
              <div className="muted small" style={{ gridColumn: '1 / -1' }}>Who plays what:</div>
              {(['RH', 'LH', 'RF', 'LF'] as Limb[]).filter((l) => limbMap.has(l)).map((l) => (
                <div key={l} style={{ display: 'contents' }}>
                  <div className={`hp-hand limb-text-${l}`}>{LIMB_NAME[l]}</div>
                  <div>{[...limbMap.get(l)!].join(', ')}</div>
                </div>
              ))}
              {data.callBars?.length ? <div className="muted small" style={{ gridColumn: '1 / -1' }}>Grey bars are played by the app: listen, then copy in the next bar.</div> : null}
            </div>
            <div className="row center gap wrap">
              <button className="btn primary big" onClick={() => void begin()}>{running ? '▶ Start' : mode === 'midi' ? '🥁 Connect drums & start' : '🎤 Enable microphone & start'}</button>
              <button className="btn" onClick={demo}>🔊 Listen first</button>
              {isRandom && (
                <button
                  className="btn ghost"
                  title="Generate a different version of this drill"
                  onClick={() => {
                    reset(true, true);
                    setRegenerated(true);
                    window.setTimeout(() => setRegenerated(false), 1600);
                  }}
                >
                  ↻ New version
                </button>
              )}
              {regenerated && <span className="muted small" role="status">New version ready</span>}
            </div>
            {(err || live.error) && <div className="error">{err ?? live.error}</div>}
            {mode === 'midi' && running && !live.midiDevices.length && (
              <div className="error">No MIDI device found. Connect the Nitro Max module’s USB port to this computer and turn it on.</div>
            )}
            <div className="muted small center">Press <kbd>Space</kbd> to start, <kbd>Esc</kbd> to stop.</div>
            <details className="howto">
              <summary>Grip, stroke and posture</summary>
              <GripDiagram />
              <DrumPostureDiagram />
              <ul>{DRUM_TECHNIQUE_TIPS.map((t, i) => <li key={i}><Md text={t} /></li>)}</ul>
            </details>
          </div>
        )}

        {phase === 'done' && report && (
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
              <button className="btn primary" onClick={() => reset(true)}>↻ Try again</button>
              {onNext && <button className="btn" onClick={onNext}>Next: {nextTitle ?? 'exercise'} →</button>}
              <button className="btn ghost" onClick={onExit}>Back to lesson</button>
            </div>
          </div>
        )}
      </div>

      <div className="kit-wrap">
        <KitDiagram marks={padMarks} />
        <div className="limb-legend">
          <span className="lg lg-RH">R</span> right hand <span className="lg lg-LH">L</span> left hand <span className="lg lg-RF">RF</span> right foot <span className="lg lg-LF">LF</span> left foot
        </div>
      </div>

      {(phase === 'playing' || phase === 'countin') && (
        <div className="row between runner-foot">
          <div className="progress-bar"><div style={{ width: `${progressPct}%` }} /></div>
          <div className="row gap">
            <button className="btn ghost small" onClick={() => reset(false)}>■ Stop</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Right hand → **Hi-hat**", one entry per hit (optionally only those still to play). */
function describeStep(step: DStep, only?: Inst[]): string[] {
  return step.hits
    .filter((h) => !only || only.includes(h.inst))
    .map((h) => `${h.limb ? LIMB_NAME[h.limb] : 'Hit'} → **${INSTS[h.inst].name}**${h.dyn === 'a' ? ' (accent)' : h.dyn === 'g' ? ' (ghost, soft)' : ''}${h.flam ? ' (flam)' : ''}`);
}
