// Synthesised drum sounds for demos and call-and-response exercises.

import { audioCtx, out } from '../../shared/audio/synth';
import type { Inst } from './kit';

let noiseBuf: AudioBuffer | null = null;
function noise(): AudioBuffer {
  const c = audioCtx();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseHit(t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 0.8) {
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noise();
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out());
  src.start(t);
  src.stop(t + dur + 0.05);
}

function toneHit(t: number, f0: number, f1: number, dur: number, gain: number) {
  const c = audioCtx();
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out());
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Play one drum hit at AudioContext time `when` (default: now). velocity 0..1. */
export function playDrum(inst: Inst, when?: number, velocity = 0.8) {
  const c = audioCtx();
  const t = when ?? c.currentTime + 0.01;
  const v = Math.max(0.05, velocity);
  switch (inst) {
    case 'kick':
      toneHit(t, 150, 45, 0.35, 0.9 * v);
      break;
    case 'snare':
      toneHit(t, 220, 160, 0.12, 0.35 * v);
      noiseHit(t, 0.18, 0.5 * v, 'bandpass', 1800, 0.6);
      break;
    case 'hhClosed':
      noiseHit(t, 0.05, 0.3 * v, 'highpass', 7000);
      break;
    case 'hhOpen':
      noiseHit(t, 0.35, 0.25 * v, 'highpass', 6500);
      break;
    case 'hhPedal':
      noiseHit(t, 0.04, 0.2 * v, 'highpass', 5000);
      break;
    case 'tom1':
      toneHit(t, 260, 180, 0.3, 0.6 * v);
      break;
    case 'tom2':
      toneHit(t, 200, 135, 0.35, 0.6 * v);
      break;
    case 'tom3':
      toneHit(t, 140, 90, 0.45, 0.7 * v);
      break;
    case 'crash':
      noiseHit(t, 1.4, 0.3 * v, 'highpass', 4000, 0.5);
      break;
    case 'ride':
      noiseHit(t, 0.6, 0.15 * v, 'bandpass', 5500, 1.5);
      toneHit(t, 3200, 3100, 0.4, 0.04 * v);
      break;
  }
}
