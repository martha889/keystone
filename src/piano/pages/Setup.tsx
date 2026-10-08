// Sound check, input settings, timing calibration, data management.

import { useEffect, useRef, useState } from 'react';
import { input, useInputStarter, useLive, type PlayEvent } from '../../shared/audio/input';
import { Metronome, audioCtx } from '../../shared/audio/synth';
import { updateSettings, useSettings } from '../../shared/store/settings';
import { exportProgress, importProgress, resetProgress } from '../../shared/store/progress';
import Keyboard, { type KeyMark } from '../components/Keyboard';
import LevelMeter from '../../shared/components/LevelMeter';
import { noteName } from '../music/theory';

export default function Setup() {
  const s = useSettings();
  const live = useLive();
  const [running, start, err] = useInputStarter();
  const [lastEvents, setLastEvents] = useState<PlayEvent[]>([]);
  const [flash, setFlash] = useState<Map<number, KeyMark>>(new Map());

  useEffect(
    () =>
      input.on((ev) => {
        setLastEvents((xs) => [ev, ...xs].slice(0, 8));
        setFlash(new Map(ev.notes.map((m) => [m, 'good' as KeyMark])));
        window.setTimeout(() => setFlash(new Map()), 350);
      }),
    [],
  );

  const marks = new Map<number, KeyMark>();
  for (const m of live.held) marks.set(m, 'live');
  flash.forEach((v, k) => marks.set(k, v));

  const switchMode = async (mode: 'mic' | 'midi') => {
    input.stop();
    updateSettings({ inputMode: mode });
    await start();
  };

  return (
    <div className="page">
      <h1>Sound check & settings</h1>

      <section className="card">
        <div className="row between wrap gap">
          <h3>1 · Input</h3>
          <LevelMeter />
        </div>
        <div className="seg">
          <button className={s.inputMode === 'mic' ? 'on' : ''} onClick={() => void switchMode('mic')}>🎤 Microphone</button>
          <button className={s.inputMode === 'midi' ? 'on' : ''} onClick={() => void switchMode('midi')}>🎹 USB-MIDI (CT-S1 USB port)</button>
        </div>
        {s.inputMode === 'mic' ? (
          <ul className="small tight">
            <li>On the CT-S1: choose the <strong>Grand Piano</strong> tone, Transpose 0, volume about halfway.</li>
            <li>Place your computer or phone close to the keyboard’s speakers, in a quiet room.</li>
            <li>Your browser will ask for microphone permission. Choose <strong>Allow</strong>.</li>
          </ul>
        ) : (
          <ul className="small tight">
            <li>Connect the CT-S1’s USB port to your computer with a USB cable. No driver is needed.</li>
            <li>Use <strong>Chrome or Edge</strong> (Safari doesn’t support Web MIDI).</li>
            <li>Detected devices: {live.midiDevices.length ? live.midiDevices.join(', ') : 'none yet'}</li>
          </ul>
        )}
        {!running && <button className="btn primary" onClick={() => void start()}>Start {s.inputMode === 'mic' ? 'microphone' : 'MIDI'}</button>}
        {err && <div className="error">{err}</div>}
      </section>

      <section className="card">
        <h3>2 · Play some notes</h3>
        <p className="small muted">Play single notes slowly across the keyboard. Each attack should light up once, on the right key.</p>
        <div className="big-note">{live.pitch ? noteName(live.pitch.midi) : lastEvents[0]?.notes.length ? noteName(lastEvents[0].notes[0]) : '—'}
          {live.pitch && <span className="cents">{live.pitch.cents > 0 ? '+' : ''}{live.pitch.cents}¢</span>}
        </div>
        <div className="kb-wrap"><Keyboard marks={marks} showNames={false} /></div>
        <div className="small muted">Recent attacks: {lastEvents.map((e) => (e.notes.length ? e.notes.map((m) => noteName(m)).join('+') : '?')).join(' · ') || 'none yet'}</div>
        {s.inputMode === 'mic' && (
          <label className="field">
            <div className="field-l">Sensitivity</div>
            <div className="field-c">
              <input type="range" min={6} max={26} value={32 - s.sensitivity} onChange={(e) => updateSettings({ sensitivity: 32 - Number(e.target.value) })} />
              <div className="small muted">Raise it if quiet notes are missed; lower it if notes trigger twice or noise triggers notes.</div>
            </div>
          </label>
        )}
      </section>

      <Calibrate />

      <section className="card">
        <h3>4 · Preferences</h3>
        <label className="check"><input type="checkbox" checked={s.showFingering} onChange={(e) => updateSettings({ showFingering: e.target.checked })} /> Show fingering, hand positions and hand-move cues</label>
        <label className="check"><input type="checkbox" checked={s.showNoteNames} onChange={(e) => updateSettings({ showNoteNames: e.target.checked })} /> Show note names on the on-screen keyboard (early lessons)</label>
        <label className="check"><input type="checkbox" checked={s.octaveLenient} onChange={(e) => updateSettings({ octaveLenient: e.target.checked })} /> Accept the right note in the wrong octave (useful if your mic often gets octaves wrong)</label>
        <label className="field">
          <div className="field-l">Metronome volume</div>
          <div className="field-c"><input type="range" min={0} max={1} step={0.05} value={s.clickVolume} onChange={(e) => updateSettings({ clickVolume: Number(e.target.value) })} /></div>
        </label>
      </section>

      <DataSection />
    </div>
  );
}

function Calibrate() {
  const s = useSettings();
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [beat, setBeat] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const beats = useRef<number[]>([]);
  const hits = useRef<number[]>([]);
  const metro = useRef<Metronome | null>(null);

  useEffect(() => () => metro.current?.stop(), []);
  useEffect(
    () =>
      input.on((ev) => {
        if (state === 'running') hits.current.push(ev.time + s.latencyMs); // raw time
      }),
    [state, s.latencyMs],
  );

  const run = async () => {
    if (!input.live.running) await input.start().catch(() => {});
    if (!input.live.running) return;
    audioCtx();
    beats.current = [];
    hits.current = [];
    setResult(null);
    setState('running');
    const m = new Metronome(80, 4);
    metro.current = m;
    m.start((b, perf) => {
      setBeat(b + 1);
      beats.current.push(perf);
      if (b >= 15) {
        m.stop();
        window.setTimeout(() => finish(), 600);
      }
    });
  };

  const finish = () => {
    setState('done');
    const bs = beats.current.slice(4); // skip count-in
    const offs: number[] = [];
    for (const h of hits.current) {
      let best = Infinity;
      for (const b of bs) if (Math.abs(h - b) < Math.abs(best)) best = h - b;
      if (Math.abs(best) < 300) offs.push(best);
    }
    if (offs.length < 5) {
      setResult(`Only ${offs.length} notes were detected on the beat. Try again, playing one firm note on every click.`);
      return;
    }
    offs.sort((a, b) => a - b);
    const med = offs[Math.floor(offs.length / 2)];
    const lat = Math.max(0, Math.min(300, Math.round(med)));
    updateSettings({ latencyMs: lat });
    setResult(`Measured delay: ${Math.round(med)} ms across ${offs.length} notes. Timing compensation set to ${lat} ms.`);
  };

  return (
    <section className="card">
      <h3>3 · Timing calibration</h3>
      <p className="small muted">
        Microphones and audio drivers add a small delay. Press start, wait for the 4 count-in clicks, then play middle C <strong>exactly on each of the next 12 clicks</strong>. Current compensation: <strong>{s.latencyMs} ms</strong>.
      </p>
      <div className="row gap">
        <button className="btn" onClick={() => void run()} disabled={state === 'running'}>{state === 'running' ? `Beat ${beat}${beat <= 4 ? ' (count-in)' : ''}` : 'Start calibration'}</button>
        <label className="row gap small">
          Manual: <input type="number" min={0} max={300} value={s.latencyMs} onChange={(e) => updateSettings({ latencyMs: Number(e.target.value) })} style={{ width: 70 }} /> ms
        </label>
      </div>
      {result && <p className="small">{result}</p>}
    </section>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const doExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `keystone-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (f: File) => {
    try {
      importProgress(await f.text());
      setMsg('Progress imported.');
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <section className="card">
      <h3>5 · Your data</h3>
      <p className="small muted">Progress is stored in this browser only. Export it to back it up or move it to another device.</p>
      <div className="row gap wrap">
        <button className="btn" onClick={doExport}>Export progress</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import…</button>
        <button className="btn danger" onClick={() => { if (confirm('Erase all progress? This cannot be undone.')) resetProgress(); }}>Reset progress</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
