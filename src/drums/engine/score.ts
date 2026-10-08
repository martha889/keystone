// Matching played hits to the written part, and turning the result into coaching.

import { INSTS, LIMB_NAME, sameFamily, type Inst, type Limb } from './kit';
import type { DrumData, Dyn } from './pattern';

export interface PlayedHit {
  inst: Inst | null; // null = microphone (pad unknown)
  time: number; // performance.now(), latency compensated
  vel: number; // MIDI velocity 1..127 (mic: 64)
}

export interface Expected {
  step: number;
  t: number; // performance.now() when it should sound
  inst: Inst;
  dyn: Dyn;
  flam?: boolean;
  limb: Limb;
  bar: number;
  silent: boolean; // metronome was off in this bar
}

export type HitStatus = 'hit' | 'near' | 'wrong' | 'missed';

export interface HitResult {
  exp: Expected;
  status: HitStatus;
  offset?: number; // ms, + late / − early
  vel?: number;
  playedInst?: Inst;
  flamGap?: number; // ms between grace note and main stroke
}

/** Every hit the student must play (call bars excluded), with absolute times. */
export function expectedHits(d: DrumData, t0: number, beatMs: number): Expected[] {
  const out: Expected[] = [];
  d.steps.forEach((s, i) => {
    const bar = Math.floor(s.pos / d.beatsPerBar + 1e-9);
    if (d.callBars?.includes(bar)) return;
    for (const h of s.hits)
      out.push({ step: i, t: t0 + s.pos * beatMs, inst: h.inst, dyn: h.dyn, flam: h.flam, limb: h.limb ?? 'RH', bar, silent: !!d.silentBars?.includes(bar) });
  });
  return out;
}

/** Matching window around each expected step: half the gap to its neighbours, 35–150 ms. */
export function windows(exp: Expected[]): Map<number, number> {
  const times = [...new Set(exp.map((e) => e.t))].sort((a, b) => a - b);
  const w = new Map<number, number>();
  times.forEach((t, i) => {
    const gap = Math.min(i > 0 ? t - times[i - 1] : Infinity, i + 1 < times.length ? times[i + 1] - t : Infinity);
    w.set(t, Math.max(35, Math.min(150, gap * 0.48)));
  });
  return w;
}

export function scoreRun(exp: Expected[], played: PlayedHit[]): { results: HitResult[]; extras: PlayedHit[] } {
  const win = windows(exp);
  const used = new Set<number>();
  const results: HitResult[] = exp.map((e) => ({ exp: e, status: 'missed' }));
  const byTime = [...played.keys()].sort((a, b) => played[a].time - played[b].time);
  const near = (e: Expected) => byTime.filter((i) => !used.has(i) && Math.abs(played[i].time - e.t) <= win.get(e.t)!);
  const mic = played.some((p) => p.inst === null);

  if (mic) {
    // Microphone: pads can't be told apart, so match one attack per written time step.
    const stepTimes = [...new Set(exp.map((e) => e.t))].sort((a, b) => a - b);
    for (const t of stepTimes) {
      const cands = byTime.filter((i) => !used.has(i) && Math.abs(played[i].time - t) <= win.get(t)!);
      if (!cands.length) continue;
      const best = cands.reduce((a, b) => (Math.abs(played[a].time - t) < Math.abs(played[b].time - t) ? a : b));
      used.add(best);
      results.forEach((r) => {
        if (r.exp.t === t) Object.assign(r, { status: 'hit', offset: Math.round(played[best].time - t), vel: played[best].vel });
      });
    }
  } else {
    // 1) Flams: two hits on the same pad 8–80 ms apart; the later one is the main stroke.
    results.forEach((r) => {
      if (!r.exp.flam) return;
      const c = near(r.exp).filter((i) => played[i].inst && sameFamily(played[i].inst!, r.exp.inst));
      for (let a = 0; a < c.length; a++)
        for (let b = 0; b < c.length; b++) {
          const gap = played[c[b]].time - played[c[a]].time;
          if (r.status === 'missed' && gap >= 8 && gap <= 80) {
            used.add(c[a]);
            used.add(c[b]);
            Object.assign(r, { status: 'hit', offset: Math.round(played[c[b]].time - r.exp.t), vel: played[c[b]].vel, flamGap: Math.round(gap), playedInst: played[c[b]].inst! });
          }
        }
    });
    // 2) Exact pad, nearest in time
    for (const r of results) {
      if (r.status !== 'missed') continue;
      const c = near(r.exp).filter((i) => played[i].inst === r.exp.inst);
      if (!c.length) continue;
      const best = c.reduce((a, b) => (Math.abs(played[a].time - r.exp.t) < Math.abs(played[b].time - r.exp.t) ? a : b));
      used.add(best);
      Object.assign(r, { status: 'hit', offset: Math.round(played[best].time - r.exp.t), vel: played[best].vel, playedInst: r.exp.inst });
    }
    // 3) Same family (open vs closed hi-hat): nearly right
    for (const r of results) {
      if (r.status !== 'missed') continue;
      const c = near(r.exp).filter((i) => played[i].inst && sameFamily(played[i].inst!, r.exp.inst));
      if (!c.length) continue;
      used.add(c[0]);
      Object.assign(r, { status: 'near', offset: Math.round(played[c[0]].time - r.exp.t), vel: played[c[0]].vel, playedInst: played[c[0]].inst! });
    }
    // 4) A different pad at the right moment: wrong pad
    for (const r of results) {
      if (r.status !== 'missed') continue;
      const c = near(r.exp).filter((i) => played[i].inst && !exp.some((e) => e.t === r.exp.t && e.inst === played[i].inst));
      if (!c.length) continue;
      used.add(c[0]);
      Object.assign(r, { status: 'wrong', offset: Math.round(played[c[0]].time - r.exp.t), vel: played[c[0]].vel, playedInst: played[c[0]].inst! });
    }
  }
  const extras = byTime.filter((i) => !used.has(i)).map((i) => played[i]);
  return { results, extras };
}

// ---------- Coaching ----------

export interface DrumReport {
  score: number;
  stars: number;
  headline: string;
  stats: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }[];
  tips: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

export function starsFor(score: number, pass = 0.75) {
  return score >= 0.95 ? 3 : score >= 0.85 ? 2 : score >= pass ? 1 : 0;
}

export function analyseTempo(results: HitResult[], extras: PlayedHit[], opts: { bpm: number; targetBpm?: number; startBpm?: number; mic: boolean }): DrumReport {
  const tips: string[] = [];
  const stats: DrumReport['stats'] = [];
  const total = Math.max(1, results.length);
  const hits = results.filter((r) => r.status === 'hit' || r.status === 'near');
  const wrong = results.filter((r) => r.status === 'wrong');
  const missed = results.filter((r) => r.status === 'missed');

  // Timing score
  let sum = 0;
  for (const r of results) {
    if (r.status !== 'hit' && r.status !== 'near') continue;
    const off = Math.abs(r.offset ?? 0);
    const t = off <= 20 ? 1 : Math.max(0.5, 1 - (off - 20) / 200);
    sum += r.status === 'near' ? t * 0.6 : t;
  }
  let timingScore = sum / total - (extras.length * 0.3) / total;

  // Dynamics (MIDI only)
  let dynScore: number | null = null;
  const velOf = (d: Dyn) => results.filter((r) => r.exp.dyn === d && r.vel !== undefined && r.status === 'hit').map((r) => r.vel!);
  if (!opts.mic) {
    const acc = velOf('a'), nor = velOf('n'), gh = velOf('g');
    const parts: number[] = [];
    if (acc.length && nor.length) {
      const ratio = mean(acc) / Math.max(1, mean(nor));
      parts.push(Math.min(1, Math.max(0, (ratio - 1) / 0.3)));
      stats.push({ label: 'Accent strength', value: `+${Math.round((ratio - 1) * 100)}%`, tone: ratio >= 1.3 ? 'good' : ratio < 1.12 ? 'bad' : 'warn' });
      if (ratio < 1.3) tips.push(`Your accents are only ${Math.round((ratio - 1) * 100)}% louder than the other notes. Aim for a clear difference: raise the stick high for accents (and stop it low afterwards), keep taps low.`);
    }
    if (gh.length) {
      const loud = [...acc, ...nor];
      const ref = loud.length ? mean(loud) : 100;
      const ratio = mean(gh) / ref;
      parts.push(Math.min(1, Math.max(0, (0.75 - ratio) / 0.35)));
      stats.push({ label: 'Ghost-note level', value: `${Math.round(ratio * 100)}%`, tone: ratio <= 0.45 ? 'good' : ratio > 0.65 ? 'bad' : 'warn' });
      if (ratio > 0.45) tips.push(`Ghost notes are at ${Math.round(ratio * 100)}% of your normal volume. Play them from just 2–3 cm above the pad so they're felt more than heard (aim for under 40%).`);
    }
    if (parts.length) dynScore = mean(parts);
  }
  if (dynScore !== null) timingScore = 0.85 * timingScore + 0.15 * dynScore;
  const score = Math.max(0, Math.min(1, timingScore));

  stats.push({ label: 'Hits on time & pad', value: `${hits.length}/${total}`, tone: hits.length === total ? 'good' : hits.length < total * 0.8 ? 'bad' : 'warn' });
  if (!opts.mic) stats.push({ label: 'Wrong pad / missed', value: `${wrong.length} / ${missed.length}`, tone: wrong.length + missed.length === 0 ? 'good' : 'warn' });
  else stats.push({ label: 'Missed', value: String(missed.length), tone: missed.length ? 'warn' : 'good' });

  const hasSilent = hits.some((r) => r.exp.silent);
  const offs = hits.filter((r) => !hasSilent || !r.exp.silent).map((r) => r.offset ?? 0);
  if (offs.length >= 3) {
    const m = mean(offs), s = sd(offs);
    stats.push({ label: 'Average timing', value: `${m > 0 ? '+' : ''}${Math.round(m)} ms`, tone: Math.abs(m) < 15 ? 'good' : 'warn' });
    stats.push({ label: 'Steadiness (±)', value: `${Math.round(s)} ms`, tone: s < 20 ? 'good' : s > 45 ? 'bad' : 'warn' });
    if (m > 20) tips.push(`You're **dragging**: ${Math.round(m)} ms behind the click on average. Lean forward into the beat a little.`);
    else if (m < -20) tips.push(`You're **rushing**: ${Math.round(-m)} ms ahead of the click on average. Relax and let the click come to you.`);
    if (s > 35) tips.push(`Your timing wanders by about ±${Math.round(s)} ms. Count the subdivisions out loud and keep your strokes the same height.`);

    // Per-limb timing and consistency
    if (!opts.mic) {
      const byLimb = (l: Limb) => hits.filter((r) => r.exp.limb === l).map((r) => r.offset ?? 0);
      const limbs = (['RH', 'LH', 'RF', 'LF'] as Limb[]).filter((l) => byLimb(l).length >= 3);
      if (limbs.length >= 2) {
        const avg = Object.fromEntries(limbs.map((l) => [l, mean(byLimb(l))]));
        const hands = limbs.filter((l) => l === 'RH' || l === 'LH');
        const handAvg = hands.length ? mean(hands.map((l) => avg[l])) : 0;
        // Hands against each other, feet against the hands
        if (avg.RH !== undefined && avg.LH !== undefined) {
          const d = avg.LH - avg.RH;
          if (Math.abs(d) > 18) tips.push(`Your **${d > 0 ? 'left' : 'right'} hand** lands ${Math.round(Math.abs(d))} ms after the ${d > 0 ? 'right' : 'left'}. Practise single strokes slowly, listening for perfectly even spacing.`);
        }
        for (const l of limbs.filter((x) => x === 'RF' || x === 'LF')) {
          if (!hands.length) break;
          const rel = avg[l] - handAvg;
          if (Math.abs(rel) > 18) tips.push(`Your **${LIMB_NAME[l].toLowerCase()}** is ${Math.round(Math.abs(rel))} ms ${rel > 0 ? 'behind' : 'ahead of'} your hands. Practise just ${l === 'RF' ? 'kick and hi-hat' : 'hi-hat foot and snare'} together until they land as one sound.`);
        }
        for (const l of limbs) {
          const sdl = sd(byLimb(l));
          if (sdl > 40) tips.push(`Your ${LIMB_NAME[l].toLowerCase()} is the least consistent (±${Math.round(sdl)} ms). Isolate it with the click.`);
        }
      }
      // Hand balance on normal strokes
      const vel = (l: Limb) => hits.filter((r) => r.exp.limb === l && r.exp.dyn === 'n' && r.vel).map((r) => r.vel!);
      const vr = vel('RH'), vl = vel('LH');
      if (vr.length >= 4 && vl.length >= 4) {
        const diff = (mean(vl) - mean(vr)) / mean(vr);
        stats.push({ label: 'Left vs right volume', value: `${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%`, tone: Math.abs(diff) < 0.12 ? 'good' : 'warn' });
        if (Math.abs(diff) >= 0.15) tips.push(`Your **${diff < 0 ? 'left' : 'right'} hand is ${Math.round(Math.abs(diff) * 100)}% softer**. Play a bar with that hand alone, matching the height of the other stick.`);
      }
      // Flams
      const gaps = results.filter((r) => r.flamGap !== undefined).map((r) => r.flamGap!);
      const flamTotal = results.filter((r) => r.exp.flam).length;
      if (flamTotal) {
        stats.push({ label: 'Flams detected', value: `${gaps.length}/${flamTotal}`, tone: gaps.length === flamTotal ? 'good' : 'warn' });
        if (gaps.length < flamTotal) tips.push('Some flams sounded as a single stroke. Keep the grace-note stick low (2–3 cm) and the main stick high, and drop them together.');
        if (gaps.length && mean(gaps) > 50) tips.push(`Your flams are wide (${Math.round(mean(gaps))} ms apart, so they sound like two notes). Bring the sticks closer in height.`);
      }
    }

    // Clock test: silent bars vs bars with click
    const silentOffs = hits.filter((r) => r.exp.silent).map((r) => r.offset ?? 0);
    if (silentOffs.length >= 3) {
      const ms = mean(silentOffs);
      stats.push({ label: 'Drift without click', value: `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`, tone: Math.abs(ms) < 25 ? 'good' : Math.abs(ms) > 60 ? 'bad' : 'warn' });
      if (Math.abs(ms) > 25) tips.push(`When the click disappeared you **${ms < 0 ? 'sped up' : 'slowed down'}** (${Math.round(Math.abs(ms))} ms off on average). Keep counting quarter notes in your head and stay relaxed.`);
      else tips.push('Excellent internal clock: you stayed locked even without the metronome.');
    } else if (offs.length >= 8) {
      const h = Math.floor(offs.length / 2);
      const a = mean(offs.slice(0, h)), b = mean(offs.slice(h));
      if (b - a > 25) tips.push('You **slowed down** towards the end.');
      if (a - b > 25) tips.push('You **sped up** as you went. Classic adrenaline! Stay with the click.');
    }
  }

  // Wrong pads
  if (!opts.mic) {
    const conf: Record<string, number> = {};
    for (const r of [...wrong, ...results.filter((x) => x.status === 'near')]) {
      const k = `${INSTS[r.exp.inst].name}>${INSTS[r.playedInst!].name}`;
      conf[k] = (conf[k] ?? 0) + 1;
    }
    for (const [k, c] of Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 2)) {
      const [e, p] = k.split('>');
      if (e.startsWith('Hi-hat') && p.startsWith('Hi-hat'))
        tips.push(`The hi-hat was **${p.includes('open') ? 'open' : 'closed'}** where it should be ${e.includes('open') ? 'open' : 'closed'}${c > 1 ? ` (${c}×)` : ''}. ${e.includes('open') ? 'Lift your left foot slightly as you hit.' : 'Keep your left foot pressed down.'}`);
      else tips.push(`You hit **${p}** instead of **${e}**${c > 1 ? ` ${c}×` : ''}. Look at the kit diagram and find the move slowly in follow mode.`);
    }
  }
  if (missed.length > total * 0.2) tips.push(`${missed.length} notes were missed. If it's too fast, lower the tempo by 10 bpm. Clean beats fast.`);
  if (extras.length > 2) tips.push(`${extras.length} extra hits were played where nothing is written. Keep the strokes deliberate${opts.mic ? ' (or check for background noise)' : ''}.`);
  if (opts.targetBpm) {
    if (score >= 0.9 && opts.bpm < opts.targetBpm) tips.push(`Solid at ♩=${opts.bpm}. Next time try **♩=${Math.min(opts.targetBpm, opts.bpm + 6)}**. Mastery target: ♩=${opts.targetBpm}.`);
    if (score >= 0.95 && opts.bpm >= opts.targetBpm) tips.push(`**Mastered at the target tempo (♩=${opts.targetBpm}).**`);
    if (score < 0.6) tips.push(`Try ♩=${Math.max(40, opts.bpm - 12)}, or learn the pattern in follow mode first.`);
  }
  if (opts.mic) tips.push('Microphone mode checks **timing only**. It can’t tell which pad you hit. Connect the Nitro Max by USB for full feedback.');
  if (!tips.length) tips.push(score >= 0.95 ? 'Locked in. Great time feel!' : 'Good work. One more clean run will lock it in.');

  let stars = starsFor(score);
  if (opts.startBpm && opts.bpm < opts.startBpm && stars > 2) stars = 2;
  const headline = stars === 3 ? 'In the pocket!' : stars === 2 ? 'Great job!' : stars === 1 ? 'Passed. Keep polishing.' : 'Keep practising';
  return { score, stars, headline, stats, tips };
}
