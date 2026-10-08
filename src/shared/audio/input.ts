// Input hub: turns microphone audio (or USB-MIDI from the CT-S1) into "play events".

import { useEffect, useState, useSyncExternalStore } from 'react';
import { audioCtx } from './synth';
import { FluxTracker, rmsDb, yin, risingNote, type PitchResult, type Spectrum } from './pitch';
import { getSettings } from '../store/settings';

export interface PlayEvent {
  time: number; // performance.now() of the attack (latency compensated)
  notes: number[]; // mic: the single detected pitch (may be empty); midi: exact notes
  source: 'mic' | 'midi';
  before?: Spectrum | null; // mic: spectrum just before the attack
  spectrum?: Spectrum | null; // mic: spectrum shortly after the attack
  level: number; // dB above noise floor (mic) or velocity*40 (midi)
}

export interface LiveState {
  running: boolean;
  source: 'mic' | 'midi' | null;
  levelDb: number; // current level, dB above noise floor
  pitch: PitchResult | null;
  held: number[]; // midi: keys currently down; mic: currently sounding pitch
  error: string | null;
  midiDevices: string[];
}

type Listener = (e: PlayEvent) => void;

/** A single MIDI note-on, ungrouped (drum pads need every hit with its own time and velocity). */
export interface RawHit {
  note: number;
  vel: number; // 1..127
  time: number; // performance.now()
}
type RawListener = (h: RawHit) => void;

const FLUX_MIN = 90;
const RISE_MIN = 20;

class InputHub {
  private listeners = new Set<Listener>();
  private rawListeners = new Set<RawListener>();
  private liveListeners = new Set<() => void>();
  live: LiveState = { running: false, source: null, levelDb: 0, pitch: null, held: [], error: null, midiDevices: [] };

  // mic
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private timeBuf = new Float32Array(8192);
  private envHist: { t: number; v: number }[] = [];
  private floor = -70;
  private lastOnset = 0;
  private pending: { t0: number; pitches: number[]; before: Spectrum | null; peak: number; fluxOnly: boolean } | null = null;
  private stableMidi: number | null = null;
  private stableCount = 0;
  private stableStart = 0;
  private currentNote: number | null = null;
  private specRing: { t: number; s: Spectrum }[] = [];
  private tick = 0;
  private muteUntil = 0;
  private flux = new FluxTracker(2048);
  private fluxHist: number[] = [];
  private prevFlux = 0;
  debug: { t: number; flux: number; thr: number; env: number }[] | null = null;

  // midi
  private midiAccess: MIDIAccess | null = null;
  private midiHeld = new Set<number>();
  private midiGroup: { t: number; notes: number[]; vel: number; timer: number } | null = null;

  on(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  onRaw(l: RawListener) {
    this.rawListeners.add(l);
    return () => {
      this.rawListeners.delete(l);
    };
  }

  subscribeLive = (l: () => void) => {
    this.liveListeners.add(l);
    return () => {
      this.liveListeners.delete(l);
    };
  };

  getLive = () => this.live;

  private setLive(patch: Partial<LiveState>) {
    this.live = { ...this.live, ...patch };
    this.liveListeners.forEach((l) => l());
  }

  private emit(e: PlayEvent) {
    this.listeners.forEach((l) => l(e));
  }

  /** Ignore microphone attacks until `ms` from now (used while the app itself plays sound). */
  mute(ms: number) {
    this.muteUntil = Math.max(this.muteUntil, performance.now() + ms);
    this.pending = null;
  }

  /** Start listening. `mode` overrides the piano setting (the drums section has its own). */
  async start(mode: 'mic' | 'midi' = getSettings().inputMode): Promise<void> {
    if (this.live.running && this.live.source === mode) return;
    this.stop();
    if (mode === 'midi') return this.startMidi();
    return this.startMic();
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((inp) => (inp.onmidimessage = null));
      this.midiAccess.onstatechange = null;
    }
    this.midiHeld.clear();
    this.setLive({ running: false, source: null, pitch: null, held: [], levelDb: 0 });
  }

  // ---------------- Microphone ----------------

  private async startMic() {
    try {
      const c = audioCtx();
      await c.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      const src = c.createMediaStreamSource(this.stream);
      // Steep low-pass so the metronome's high click doesn't register as a note attack.
      const lp1 = c.createBiquadFilter();
      lp1.type = 'lowpass';
      lp1.frequency.value = 2400;
      const lp2 = c.createBiquadFilter();
      lp2.type = 'lowpass';
      lp2.frequency.value = 2400;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 50;
      const an = c.createAnalyser();
      an.fftSize = 8192;
      an.smoothingTimeConstant = 0;
      src.connect(hp).connect(lp1).connect(lp2).connect(an);
      this.analyser = an;
      this.envHist = [];
      this.floor = -70;
      this.timer = window.setInterval(() => this.process(), 11);
      this.setLive({ running: true, source: 'mic', error: null });
    } catch (err) {
      this.setLive({ running: false, error: micErrorMessage(err) });
      throw err;
    }
  }

  private snapshotSpectrum(): Spectrum | null {
    if (!this.analyser) return null;
    const db = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(db);
    return { db, binHz: this.analyser.context.sampleRate / this.analyser.fftSize };
  }

  /** Fresh spectrum (used by the exercise runner to verify chords a moment after the attack). */
  spectrumNow(): Spectrum | null {
    return this.snapshotSpectrum();
  }

  private process() {
    const an = this.analyser;
    if (!an) return;
    const now = performance.now();
    const sr = an.context.sampleRate;
    an.getFloatTimeDomainData(this.timeBuf);
    const N = this.timeBuf.length;
    // Envelope on the latest ~10ms
    const envWin = Math.round(sr * 0.021); // ≥ one period of the lowest note (C2)
    const env = rmsDb(this.timeBuf, N - envWin, N);
    this.envHist.push({ t: now, v: env });
    while (this.envHist.length && now - this.envHist[0].t > 3000) this.envHist.shift();

    // Noise floor: quietest part of the last 3s. Falls quickly, rises slowly, so that
    // continuous playing (no silence) doesn't drag the floor up and desensitise detection.
    if (this.tick % 10 === 0 && this.envHist.length > 20) {
      const sorted = this.envHist.map((h) => h.v).sort((a, b) => a - b);
      const p5 = sorted[Math.floor(sorted.length * 0.05)];
      // Only let it rise when nothing has been played for a while (i.e. it's really background noise).
      const k = p5 < this.floor ? 0.5 : now - this.lastOnset > 2500 ? 0.1 : 0;
      this.floor = Math.max(-90, Math.min(-25, (1 - k) * this.floor + k * p5));
    }
    const above = env - this.floor;

    // Spectrum ring (for "before attack" comparisons)
    if (this.tick % 3 === 0) {
      const s = this.snapshotSpectrum();
      if (s) {
        this.specRing.push({ t: now, s });
        if (this.specRing.length > 8) this.specRing.shift();
      }
    }
    this.tick++;

    // Pitch on the most recent ~46ms
    const frame = this.timeBuf.subarray(N - 2048);
    const p = above > 8 ? yin(frame, sr, 0.18, 60, 2300) : null;
    const pitch = p && p.clarity > 0.75 ? p : null;

    const muted = now < this.muteUntil;
    const sens = getSettings().sensitivity;
    const latency = getSettings().latencyMs;

    // --- Attack detection: sharp rise in energy, or a burst of new spectral content ---
    let recentMin = Infinity;
    for (let i = this.envHist.length - 1; i >= 0 && now - this.envHist[i].t < 70; i--) recentMin = Math.min(recentMin, this.envHist[i].v);
    const rise = env - recentMin;
    const flux = this.flux.next(frame, sr);
    const fs = [...this.fluxHist].sort((a, b) => a - b);
    const fluxMed = fs.length ? fs[Math.floor(fs.length / 2)] : 0;
    const fluxThr = Math.max(FLUX_MIN, fluxMed * 2.5);
    const fluxPeak = this.prevFlux > fluxThr && flux < this.prevFlux; // just passed a peak
    this.fluxHist.push(flux);
    if (this.fluxHist.length > 50) this.fluxHist.shift();
    this.debug?.push({ t: now, flux, thr: fluxThr, env: above });
    const energyOnset = rise > 7 && above > sens;
    // Spectral attacks must also add a little loudness; sustained chords can "beat" and wobble the spectrum.
    let envBefore = -Infinity;
    for (let i = this.envHist.length - 1; i >= 0; i--) if (now - this.envHist[i].t >= 45) { envBefore = this.envHist[i].v; break; }
    const fluxOnset = fluxPeak && above > sens - 4 && env - envBefore > 1;
    this.prevFlux = flux;
    if (!muted && (energyOnset || fluxOnset) && now - this.lastOnset > 70 && !this.pending) {
      // The attack began ~20ms before we noticed it; the reference spectrum must predate it.
      const prior = [...this.specRing].reverse().find((r) => r.t < now - 45);
      this.pending = { t0: now - (fluxOnset && !energyOnset ? 20 : 8), pitches: [], before: prior ? prior.s : null, peak: above, fluxOnly: !energyOnset };
      this.lastOnset = now;
    }

    if (this.pending) {
      const age = now - this.pending.t0;
      this.pending.peak = Math.max(this.pending.peak, above);
      if (age > 38 && pitch) this.pending.pitches.push(pitch.midi);
      const ps = this.pending.pitches;
      const agree = ps.length >= 2 && ps[ps.length - 1] === ps[ps.length - 2];
      if (agree || age > 110) {
        const yinNote = agree ? ps[ps.length - 1] : mode(ps);
        const spec = this.snapshotSpectrum();
        const rise = spec ? risingNote(spec, this.pending.before) : null;
        let note = yinNote;
        // YIN is precise on clean notes but gets confused when the previous note
        // is still ringing; then trust the note whose partials just grew.
        if (rise && rise.score > 4 && yinNote === null) note = rise.midi;
        // A spectral attack with no loudness jump that "re-detects" the note already sounding is either
        // (a) a new note YIN can't separate from the ringing ones (e.g. broken chords: YIN hears their
        //     common root), recognisable by a clear new note in the spectrum, or (b) noise.
        if (this.pending.fluxOnly && (note === null || note === this.currentNote)) {
          const cur = this.currentNote;
          const fresh = rise && rise.score > RISE_MIN && (cur === null || Math.abs(rise.midi - cur) > 1);
          if (!fresh) {
            this.pending = null;
            return;
          }
          note = rise.midi;
        }
        const notes = note !== null ? [note] : [];
        this.currentNote = notes[0] ?? null;
        this.stableMidi = this.currentNote;
        this.stableCount = 0;
        this.emit({ time: this.pending.t0 - latency, notes, source: 'mic', before: this.pending.before, spectrum: spec, level: this.pending.peak });
        this.pending = null;
      }
    } else if (!muted && pitch && above > sens - 2) {
      // --- Legato pitch change without a strong energy jump ---
      if (pitch.midi === this.stableMidi) {
        this.stableCount++;
      } else {
        this.stableMidi = pitch.midi;
        this.stableCount = 1;
        this.stableStart = now;
      }
      if (this.stableCount === 4 && pitch.midi !== this.currentNote && now - this.lastOnset > 120) {
        this.currentNote = pitch.midi;
        this.lastOnset = now;
        const prior = [...this.specRing].reverse().find((r) => r.t < this.stableStart - 60);
        this.emit({
          time: this.stableStart - 30 - latency,
          notes: [pitch.midi],
          source: 'mic',
          before: prior ? prior.s : null,
          spectrum: this.snapshotSpectrum(),
          level: above,
        });
      }
    }
    if (above < 6) {
      this.currentNote = null;
      this.stableMidi = null;
    }

    if (this.tick % 2 === 0) {
      this.setLive({ levelDb: Math.max(0, above), pitch, held: pitch ? [pitch.midi] : [] });
    }
  }

  // ---------------- MIDI ----------------

  private async startMidi() {
    try {
      if (!navigator.requestMIDIAccess) throw new Error('Web MIDI is not supported in this browser. Use Chrome or Edge, or switch to microphone mode.');
      const access = await navigator.requestMIDIAccess();
      this.midiAccess = access;
      const bind = () => {
        const names: string[] = [];
        access.inputs.forEach((inp) => {
          names.push(inp.name ?? 'MIDI device');
          inp.onmidimessage = (ev) => this.onMidi(ev);
        });
        this.setLive({ midiDevices: names });
      };
      bind();
      access.onstatechange = bind;
      this.setLive({ running: true, source: 'midi', error: null });
    } catch (err) {
      this.setLive({ running: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private onMidi(ev: MIDIMessageEvent) {
    const d = ev.data;
    if (!d || d.length < 3) return;
    const cmd = d[0] & 0xf0;
    const note = d[1];
    const vel = d[2];
    const t = ev.timeStamp || performance.now();
    if (cmd === 0x90 && vel > 0) {
      this.rawListeners.forEach((l) => l({ note, vel, time: t }));
      this.midiHeld.add(note);
      if (this.midiGroup && t - this.midiGroup.t < 45) {
        this.midiGroup.notes.push(note);
        this.midiGroup.vel = Math.max(this.midiGroup.vel, vel);
      } else {
        this.flushMidi();
        const g = { t, notes: [note], vel, timer: 0 };
        g.timer = window.setTimeout(() => this.flushMidi(), 45);
        this.midiGroup = g;
      }
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      this.midiHeld.delete(note);
    } else {
      return;
    }
    this.setLive({ held: [...this.midiHeld].sort((a, b) => a - b) });
  }

  private flushMidi() {
    const g = this.midiGroup;
    if (!g) return;
    window.clearTimeout(g.timer);
    this.midiGroup = null;
    this.emit({ time: g.t, notes: [...new Set(g.notes)].sort((a, b) => a - b), source: 'midi', level: (g.vel / 127) * 40 });
  }
}

function mode(xs: number[]): number | null {
  if (!xs.length) return null;
  const counts = new Map<number, number>();
  let best = xs[0];
  for (const x of xs) {
    const c = (counts.get(x) ?? 0) + 1;
    counts.set(x, c);
    if (c > (counts.get(best) ?? 0)) best = x;
  }
  return best;
}

function micErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'Microphone permission was denied. Allow microphone access in your browser’s site settings, then try again.';
    if (err.name === 'NotFoundError') return 'No microphone was found.';
  }
  return err instanceof Error ? err.message : String(err);
}

export const input = new InputHub();

export function useLive(): LiveState {
  return useSyncExternalStore(input.subscribeLive, input.getLive);
}

/** Subscribe to play events for the lifetime of a component. */
export function usePlayEvents(handler: Listener, deps: unknown[]) {
  useEffect(() => input.on(handler), deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Ensures the input is running; returns [running, start, error]. */
export function useInputStarter(): [boolean, () => Promise<void>, string | null] {
  const live = useLive();
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setErr(null);
    try {
      await input.start();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return [live.running, start, err ?? live.error];
}

// Handy for debugging from the browser console.
(globalThis as unknown as { __keystoneInput?: InputHub }).__keystoneInput = input;
