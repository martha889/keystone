// Drum setup: connect the kit, test pads, teach the app non-standard MIDI notes.

import { useEffect, useRef, useState } from 'react';
import { input, useLive, type RawHit } from '../../shared/audio/input';
import { DEFAULT_MAP, INSTS, INST_ORDER, getDrumSettings, instForNote, updateDrumSettings, useDrumSettings, type Inst } from '../engine/kit';
import KitDiagram, { type PadMark } from '../components/KitDiagram';

export function DrumSetup() {
  const ds = useDrumSettings();
  const live = useLive();
  const [err, setErr] = useState<string | null>(null);
  const [lastHits, setLastHits] = useState<string[]>([]);
  const [flash, setFlash] = useState<Map<Inst, PadMark>>(new Map());
  const [learning, setLearning] = useState<number | null>(null); // index into INST_ORDER
  const learnRef = useRef<number | null>(null);
  learnRef.current = learning;

  const start = async (mode = ds.input) => {
    setErr(null);
    try {
      await input.start(mode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    const off = input.onRaw((h: RawHit) => {
      const li = learnRef.current;
      if (li !== null) {
        const inst = INST_ORDER[li];
        updateDrumSettings({ learned: { ...getDrumSettings().learned, [h.note]: inst } });
        setLastHits((x) => [`${INSTS[inst].name} ← note ${h.note}`, ...x].slice(0, 6));
        setLearning(li + 1 < INST_ORDER.length ? li + 1 : null);
        return;
      }
      const inst = instForNote(h.note);
      setLastHits((x) => [`${inst ? INSTS[inst].name : 'Unknown'} (note ${h.note}, velocity ${h.vel})`, ...x].slice(0, 6));
      if (inst) {
        setFlash(new Map([[inst, { state: 'good' }]]));
        window.setTimeout(() => setFlash(new Map()), 250);
      }
    });
    return off;
  }, []);

  const switchMode = async (mode: 'midi' | 'mic') => {
    input.stop();
    updateDrumSettings({ input: mode });
    await start(mode);
  };

  const running = live.running && live.source === ds.input;
  const learnMarks = new Map<Inst, PadMark>(flash);
  if (learning !== null) learnMarks.set(INST_ORDER[learning], { state: 'next' });

  return (
    <div className="page">
      <h1>Drums: setup</h1>
      <section className="card">
        <h3>1 · Connect the Nitro Max</h3>
        <div className="seg">
          <button className={ds.input === 'midi' ? 'on' : ''} onClick={() => void switchMode('midi')}>🎹 USB-MIDI (recommended)</button>
          <button className={ds.input === 'mic' ? 'on' : ''} onClick={() => void switchMode('mic')}>🎤 Microphone (timing only)</button>
        </div>
        {ds.input === 'midi' ? (
          <ul className="small tight">
            <li>Connect a USB cable from the module’s USB port to this computer, and switch the module on. No driver is needed.</li>
            <li>Use <strong>Chrome or Edge</strong> (Safari doesn’t support Web MIDI).</li>
            <li>Detected devices: {live.midiDevices.length ? live.midiDevices.join(', ') : 'none yet'}</li>
          </ul>
        ) : (
          <ul className="small tight">
            <li>Mesh pads are quiet, so play the module’s sound through speakers near your computer.</li>
            <li>The microphone can only hear <strong>when</strong> you hit, not which pad. Timing is scored, pads and dynamics aren’t.</li>
          </ul>
        )}
        {!running && <button className="btn primary" onClick={() => void start()}>Start {ds.input === 'midi' ? 'MIDI' : 'microphone'}</button>}
        {(err || live.error) && <div className="error">{err ?? live.error}</div>}
      </section>

      <section className="card">
        <h3>2 · Test your pads</h3>
        <p className="small muted">Hit each pad: it should light up in the right place. If a pad shows as the wrong drum or “Unknown”, teach the app your kit below.</p>
        <KitDiagram marks={learnMarks} />
        <div className="small muted">Recent hits: {lastHits.join(' · ') || 'none yet'}</div>
      </section>

      {ds.input === 'midi' && (
        <section className="card">
          <h3>3 · Teach the app my kit</h3>
          <p className="small muted">
            The Nitro Max uses the standard General MIDI drum notes, which the app already knows. If you’ve changed the module’s note assignments (or use another kit), hit each pad when it
            lights up.
          </p>
          {learning === null ? (
            <div className="row gap wrap">
              <button className="btn" onClick={() => { if (!running) void start(); setLearning(0); }}>Start teaching</button>
              {Object.keys(ds.learned).length > 0 && <button className="btn ghost" onClick={() => updateDrumSettings({ learned: {} })}>Reset to default notes</button>}
              <span className="small muted">{Object.keys(ds.learned).length} learned notes · {Object.keys(DEFAULT_MAP).length} default notes</span>
            </div>
          ) : (
            <div className="row gap wrap">
              <strong>Hit: {INSTS[INST_ORDER[learning]].name}</strong>
              <button className="btn ghost small" onClick={() => setLearning(learning + 1 < INST_ORDER.length ? learning + 1 : null)}>Skip (I don’t have this pad)</button>
              <button className="btn ghost small" onClick={() => setLearning(null)}>Done</button>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h3>4 · Metronome</h3>
        <label className="field">
          <div className="field-l">Click volume</div>
          <div className="field-c"><input type="range" min={0} max={1} step={0.05} value={ds.clickVolume} onChange={(e) => updateDrumSettings({ clickVolume: Number(e.target.value) })} /></div>
        </label>
        <p className="small muted">Tip: wear the Nitro Max’s headphones and let the click play from your computer speakers, or plug your computer’s audio into the module’s AUX input to hear both in your headphones.</p>
      </section>
    </div>
  );
}
