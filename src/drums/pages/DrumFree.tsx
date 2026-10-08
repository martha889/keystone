// Drum free play: live kit view, tempo and evenness.

import { useEffect, useRef, useState } from 'react';
import { input, useLive } from '../../shared/audio/input';
import { addPracticeSeconds } from '../../shared/store/progress';
import { INSTS, INST_ORDER, instForNote, useDrumSettings, type Inst } from '../engine/kit';
import KitDiagram, { type PadMark } from '../components/KitDiagram';

export function DrumFree() {
  const ds = useDrumSettings();
  const live = useLive();
  const [hits, setHits] = useState<{ inst: Inst; time: number; vel: number }[]>([]);
  const [flash, setFlash] = useState<Map<Inst, PadMark>>(new Map());
  const lastActive = useRef(0);

  useEffect(() => {
    const off = input.onRaw((h) => {
      const inst = instForNote(h.note);
      if (!inst) return;
      lastActive.current = performance.now();
      setHits((x) => [...x, { inst, time: h.time, vel: h.vel }].slice(-400));
      setFlash((m) => new Map(m).set(inst, { state: 'good' }));
      window.setTimeout(() => setFlash((m) => { const n = new Map(m); n.delete(inst); return n; }), 200);
    });
    const t = window.setInterval(() => { if (performance.now() - lastActive.current < 15000) addPracticeSeconds(15); }, 15000);
    return () => { off(); window.clearInterval(t); };
  }, []);

  // Tempo & evenness from the most recent phrase of hi-hat/ride (or everything)
  const phrase = hits.filter((h) => performance.now() - h.time < 8000);
  const tk = phrase.filter((h) => h.inst === 'hhClosed' || h.inst === 'ride' || h.inst === 'hhOpen');
  const src = tk.length >= 6 ? tk : phrase;
  const iois = src.slice(1).map((h, i) => h.time - src[i].time).filter((x) => x > 50);
  let bpm: number | null = null, even: number | null = null;
  if (iois.length >= 5) {
    const sorted = [...iois].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const perBeat = med < 200 ? 4 : med < 400 ? 2 : 1;
    bpm = Math.round(60000 / (med * perBeat));
    const near = iois.filter((x) => Math.abs(x - med) < med * 0.35);
    const m = near.reduce((a, b) => a + b, 0) / near.length;
    const sdv = Math.sqrt(near.reduce((a, b) => a + (b - m) ** 2, 0) / near.length);
    even = Math.max(0, Math.round(100 - (sdv / m) * 300));
  }
  const counts = new Map<Inst, number>();
  for (const h of hits) counts.set(h.inst, (counts.get(h.inst) ?? 0) + 1);

  return (
    <div className="page wide">
      <h1>Drums: free play</h1>
      <p className="lead">Play anything. See your pads light up, your tempo and how even your time is.</p>
      {!(live.running && live.source === 'midi') && ds.input === 'midi' && <button className="btn primary" onClick={() => void input.start('midi')}>Connect drums</button>}
      {ds.input === 'mic' && <p className="small muted">Free play needs USB-MIDI to see which pads you hit.</p>}
      <div className="kit-wrap"><KitDiagram marks={flash} /></div>
      <div className="stats">
        <div className="stat"><div className="stat-v">{hits.length}</div><div className="stat-l">hits this session</div></div>
        <div className="stat"><div className="stat-v">{bpm ? `♩≈${bpm}` : '—'}</div><div className="stat-l">estimated tempo</div></div>
        <div className={`stat ${even !== null ? (even > 80 ? 'good' : even < 55 ? 'bad' : 'warn') : ''}`}><div className="stat-v">{even ?? '—'}</div><div className="stat-l">time evenness /100</div></div>
      </div>
      <div className="row gap wrap small muted">
        {INST_ORDER.filter((i) => counts.has(i)).map((i) => <span key={i} className="chip">{INSTS[i].name}: {counts.get(i)}</span>)}
      </div>
    </div>
  );
}
