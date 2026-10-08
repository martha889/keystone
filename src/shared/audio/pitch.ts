// Monophonic pitch detection (YIN) and spectral helpers for chord verification.

import { freqToMidiFloat, midiToFreq } from '../../piano/music/theory';

export interface PitchResult {
  freq: number;
  midi: number; // nearest MIDI note
  cents: number; // deviation from nearest note
  clarity: number; // 0..1, higher = more confident
}

/**
 * YIN pitch detector (de Cheveigné & Kawahara, 2002).
 * `buf` is a mono time-domain frame; returns null if no clear pitch.
 */
export function yin(buf: Float32Array, sampleRate: number, threshold = 0.15, minFreq = 60, maxFreq = 2200): PitchResult | null {
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const W = buf.length - maxTau;
  const d = new Float32Array(maxTau + 1);

  for (let tau = minTau; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = tau < minTau ? 1 : running === 0 ? 1 : (d[tau] * tau) / running;
  }
  // Absolute threshold: first dip below threshold, then walk to local min
  let tauEst = -1;
  for (let tau = minTau + 1; tau < maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) return null;

  // Sub-harmonic guard: if a period 1/2, 1/3 or 1/4 as long also fits well, the
  // detector latched onto a multiple of the true period (common when the previous
  // note is still ringing). Prefer the shortest good period.
  for (const k of [4, 3, 2]) {
    const t = Math.round(tauEst / k);
    if (t <= minTau) continue;
    let bestT = t;
    for (let u = Math.max(minTau, t - 2); u <= Math.min(maxTau - 1, t + 2); u++) if (cmnd[u] < cmnd[bestT]) bestT = u;
    if (cmnd[bestT] < Math.max(0.3, cmnd[tauEst] + 0.12)) {
      tauEst = bestT;
      break;
    }
  }

  // Parabolic interpolation
  let better = tauEst;
  if (tauEst > 1 && tauEst < maxTau) {
    const s0 = cmnd[tauEst - 1];
    const s1 = cmnd[tauEst];
    const s2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tauEst + (s2 - s0) / denom;
  }
  const freq = sampleRate / better;
  if (freq < minFreq || freq > maxFreq) return null;
  const mf = freqToMidiFloat(freq);
  const midi = Math.round(mf);
  return { freq, midi, cents: Math.round((mf - midi) * 100), clarity: 1 - cmnd[tauEst] };
}

export function rmsDb(buf: Float32Array, start = 0, end = buf.length): number {
  let s = 0;
  for (let i = start; i < end; i++) s += buf[i] * buf[i];
  const rms = Math.sqrt(s / Math.max(1, end - start));
  return 20 * Math.log10(rms + 1e-9);
}

/** A magnitude spectrum snapshot (dB values from AnalyserNode). */
export interface Spectrum {
  db: Float32Array;
  binHz: number;
}

function peakDbNear(spec: Spectrum, freq: number, cents = 40): number {
  const lo = Math.max(1, Math.floor((freq * Math.pow(2, -cents / 1200)) / spec.binHz));
  const hi = Math.min(spec.db.length - 1, Math.ceil((freq * Math.pow(2, cents / 1200)) / spec.binHz));
  let best = -200;
  for (let k = lo; k <= hi; k++) if (spec.db[k] > best) best = spec.db[k];
  return best;
}

/**
 * Level of a genuine spectral peak (local maximum, interpolated) within ±cents of freq.
 * Unlike peakDbNear this ignores the skirt of a neighbouring note's peak.
 */
function localPeakNear(spec: Spectrum, freq: number, cents = 35): number {
  const lo = Math.max(2, Math.floor((freq * Math.pow(2, -cents / 1200)) / spec.binHz) - 1);
  const hi = Math.min(spec.db.length - 3, Math.ceil((freq * Math.pow(2, cents / 1200)) / spec.binHz) + 1);
  let best = -200;
  for (let k = lo; k <= hi; k++) {
    const v = spec.db[k];
    if (v >= spec.db[k - 1] && v >= spec.db[k + 1]) {
      const a = spec.db[k - 1], c = spec.db[k + 1];
      const p = (0.5 * (a - c)) / (a - 2 * v + c || 1);
      const f = (k + p) * spec.binHz;
      if (Math.abs(1200 * Math.log2(f / freq)) <= cents && v > best) best = v;
    }
  }
  return best;
}

/** Strength of a note: its fundamental, or for bass notes also the 2nd/3rd harmonics (weak bass fundamentals). */
export function noteStrength(spec: Spectrum, midi: number): number {
  const f = midiToFreq(midi);
  const a = localPeakNear(spec, f);
  // Above ~D3 the fundamental is reliable; using harmonics there would let other
  // chord tones' overtones (e.g. C's 3rd harmonic = G) masquerade as the note.
  if (midi >= 50) return a;
  const b = localPeakNear(spec, 2 * f) - 3;
  const c = localPeakNear(spec, 3 * f) - 6;
  return Math.max(a, b, c);
}

/**
 * The note whose partials grew the most between `before` and `spec`:
 * robust for legato playing where the previous note is still ringing.
 */
export function risingNote(spec: Spectrum, before: Spectrum | null, lo = 36, hi = 96): { midi: number; score: number } | null {
  let maxDb = -200;
  for (let k = 2; k < spec.db.length; k++) if (spec.db[k] > maxDb) maxDb = spec.db[k];
  let best: { midi: number; score: number } | null = null;
  for (let m = lo; m <= hi; m++) {
    const f = midiToFreq(m);
    let score = 0;
    for (let h = 1; h <= 5; h++) {
      if (f * h > 5000) break;
      const now = localPeakNear(spec, f * h, 30);
      if (now < maxDb - 45) continue;
      const prev = before ? peakDbNear(before, f * h, 30) : -120;
      const gain = Math.min(30, Math.max(0, now - Math.max(prev, maxDb - 60)));
      score += (gain * (now - maxDb + 60)) / 60 / h;
    }
    // Penalise candidates whose fundamental is missing (sub-octave ghosts), except deep bass
    if (m >= 50 && localPeakNear(spec, f, 30) < maxDb - 30) score *= 0.3;
    if (!best || score > best.score) best = { midi: m, score };
  }
  return best;
}

interface Peak {
  freq: number;
  db: number;
}

function findPeaks(spec: Spectrum, fMin: number, fMax: number, floorDb: number): Peak[] {
  const peaks: Peak[] = [];
  const lo = Math.max(2, Math.floor(fMin / spec.binHz));
  const hi = Math.min(spec.db.length - 3, Math.ceil(fMax / spec.binHz));
  for (let k = lo; k <= hi; k++) {
    const v = spec.db[k];
    if (v > floorDb && v > spec.db[k - 1] && v >= spec.db[k + 1] && v > spec.db[k - 2] && v >= spec.db[k + 2]) {
      // Quadratic interpolation for frequency accuracy
      const a = spec.db[k - 1], b = v, c = spec.db[k + 1];
      const p = (0.5 * (a - c)) / (a - 2 * b + c || 1);
      peaks.push({ freq: (k + p) * spec.binHz, db: v });
    }
  }
  return peaks;
}

export interface ChordCheck {
  ok: boolean;
  missing: number[]; // expected MIDI notes not heard
  extraPcs: number[]; // pitch classes heard that weren't expected
  confidence: number;
}

/**
 * Verify that the expected notes are sounding in a spectrum.
 * This is verification (we know what *should* be played), which is far more
 * reliable than blind polyphonic transcription.
 * `before` is an optional spectrum from just before the onset; notes must have
 * risen relative to it (so a still-ringing earlier note doesn't count).
 */
export function verifyNotes(spec: Spectrum, expectedIn: number[], before?: Spectrum | null, anyOctave = false): ChordCheck {
  let maxDb = -200;
  const lo = Math.floor(55 / spec.binHz), hi = Math.ceil(4200 / spec.binHz);
  for (let k = lo; k < hi; k++) if (spec.db[k] > maxDb) maxDb = spec.db[k];

  const octaves = (m: number) => (anyOctave ? [-24, -12, 0, 12, 24].map((d) => m + d).filter((x) => x >= 36 && x <= 96) : [m]);
  // When any octave is accepted, explain peaks against every octave of each pitch class.
  const expected = anyOctave ? [...new Set(expectedIn.flatMap(octaves))] : expectedIn;

  const missing: number[] = [];
  let strengthSum = 0;
  for (const m0 of expectedIn) {
    // Pick the octave that sounds strongest (only matters when anyOctave)
    let m = m0;
    let s = -200;
    for (const c of octaves(m0)) {
      const v = noteStrength(spec, c);
      if (v > s) {
        s = v;
        m = c;
      }
    }
    const rel = s - maxDb;
    let rose = true;
    if (before) {
      const prev = noteStrength(before, m);
      rose = s - prev > 2.5 || prev < maxDb - 30;
    }
    if (rel < -32 || !rose) missing.push(m0);
    else strengthSum += Math.max(0, 32 + rel) / 32;
  }

  // Unexplained strong peaks → wrong notes
  const peaks = findPeaks(spec, 60, 2200, maxDb - 16);
  const extraPcs = new Set<number>();
  const expPcs = new Set(expected.map((m) => ((m % 12) + 12) % 12));
  for (const pk of peaks) {
    let explained = false;
    for (const m of expected) {
      const f0 = midiToFreq(m);
      for (let h = 1; h <= 10 && !explained; h++) {
        const cents = 1200 * Math.log2(pk.freq / (f0 * h));
        if (Math.abs(cents) < 45 + h * 4) explained = true;
      }
      // also allow sub-octaves (piano-ish "phantom" partials / octave errors in voicing)
      if (!explained && Math.abs(1200 * Math.log2(pk.freq / (f0 / 2))) < 40) explained = true;
      if (explained) break;
    }
    if (!explained) {
      // Only count if this peak itself rose (i.e. it's new)
      if (before) {
        const prevDb = peakDbNear(before, pk.freq, 30);
        if (pk.db - prevDb < 3) continue;
      }
      const p = Math.round(freqToMidiFloat(pk.freq));
      const pcv = ((p % 12) + 12) % 12;
      if (!expPcs.has(pcv) && pk.db > maxDb - 12) extraPcs.add(pcv);
    }
  }
  const ok = missing.length === 0 && extraPcs.size === 0;
  return { ok, missing, extraPcs: [...extraPcs], confidence: expected.length ? strengthSum / expected.length : 0 };
}

// ---------- Spectral flux (attack detection) ----------

const hannCache = new Map<number, Float32Array>();
function hann(n: number): Float32Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

/** In-place radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr0 = Math.cos(ang), wi0 = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j, b = a + half;
        const vr = re[b] * wr - im[b] * wi;
        const vi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const t = wr * wr0 - wi * wi0;
        wi = wr * wi0 + wi * wr0;
        wr = t;
      }
    }
  }
}

/**
 * Tracks positive spectral change between successive short frames.
 * A new note adds energy in new frequency bins even when overall loudness barely
 * changes (legato), which makes this far better than an energy envelope for fast passages.
 */
export class FluxTracker {
  private prev: Float32Array | null = null;
  private re: Float64Array;
  private im: Float64Array;
  private n: number;
  constructor(n = 2048) {
    this.n = n;
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
  }
  next(frame: Float32Array, sampleRate: number): number {
    const n = this.n;
    const w = hann(n);
    const off = frame.length - n;
    for (let i = 0; i < n; i++) {
      this.re[i] = frame[off + i] * w[i];
      this.im[i] = 0;
    }
    fft(this.re, this.im);
    const lo = Math.max(1, Math.floor(55 / (sampleRate / n)));
    const hi = Math.min(n / 2 - 1, Math.ceil(4000 / (sampleRate / n)));
    const cur = new Float32Array(hi + 1);
    let flux = 0;
    for (let k = lo; k <= hi; k++) {
      cur[k] = Math.log1p(200 * Math.hypot(this.re[k], this.im[k]));
      if (this.prev) {
        const d = cur[k] - this.prev[k];
        if (d > 0) flux += d;
      }
    }
    this.prev = cur;
    return flux;
  }
}
