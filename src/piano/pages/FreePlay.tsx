// Free play: play anything; see what was heard plus tempo and evenness analysis.

import { useEffect, useRef, useState } from 'react';
import { input, useInputStarter, useLive, type PlayEvent } from '../../shared/audio/input';
import { addPracticeSeconds } from '../../shared/store/progress';
import Keyboard, { type KeyMark } from '../components/Keyboard';
import Staff from '../components/Staff';
import LevelMeter from '../../shared/components/LevelMeter';
import { stepOf } from '../curriculum/build';
import { noteName, spellMidi } from '../music/theory';

export default function FreePlay() {
  const live = useLive();
  const [running, start, err] = useInputStarter();
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [flash, setFlash] = useState<Map<number, KeyMark>>(new Map());
  const lastActive = useRef(0);

  useEffect(
    () =>
      input.on((ev) => {
        if (!ev.notes.length) return;
        lastActive.current = performance.now();
        setEvents((xs) => [...xs, ev].slice(-200));
        setFlash(new Map(ev.notes.map((m) => [m, 'good' as KeyMark])));
        window.setTimeout(() => setFlash(new Map()), 300);
      }),
    [],
  );

  // Log practice time while actively playing
  useEffect(() => {
    const t = window.setInterval(() => {
      if (performance.now() - lastActive.current < 15000) addPracticeSeconds(15);
    }, 15000);
    return () => window.clearInterval(t);
  }, []);

  const marks = new Map<number, KeyMark>();
  for (const m of live.held) marks.set(m, 'live');
  flash.forEach((v, k) => marks.set(k, v));

  // Analysis on the most recent continuous phrase (gaps > 2s break it)
  const phrase: PlayEvent[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (phrase.length && phrase[0].time - events[i].time > 2000) break;
    phrase.unshift(events[i]);
  }
  const iois = phrase.slice(1).map((e, i) => e.time - phrase[i].time).filter((x) => x > 60);
  let tempo: number | null = null, evenness: number | null = null, dyn: number | null = null;
  if (iois.length >= 4) {
    const sorted = [...iois].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    // Assume the most common note value is an eighth if fast, quarter if slow
    const perBeat = med < 330 ? 2 : 1;
    tempo = Math.round(60000 / (med * perBeat));
    const near = iois.filter((x) => Math.abs(x - med) < med * 0.4);
    const mean = near.reduce((a, b) => a + b, 0) / near.length;
    const sd = Math.sqrt(near.reduce((a, b) => a + (b - mean) ** 2, 0) / near.length);
    evenness = Math.max(0, Math.round(100 - (sd / mean) * 300));
    const lv = phrase.map((e) => e.level);
    const lm = lv.reduce((a, b) => a + b, 0) / lv.length;
    dyn = Math.round(Math.sqrt(lv.reduce((a, b) => a + (b - lm) ** 2, 0) / lv.length) * 10) / 10;
  }

  const recent = events.slice(-16);
  const steps = recent.map((e) => stepOf(e.notes.map((m) => spellMidi(m)), 1));

  return (
    <div className="page wide">
      <div className="row between wrap gap">
        <div>
          <h1>Free play</h1>
          <p className="lead">Play anything: a piece from a book, an improvisation, a scale. The app shows what it hears and how steady your playing is.</p>
        </div>
        <LevelMeter />
      </div>
      {!running && <button className="btn primary big" onClick={() => void start()}>Start listening</button>}
      {err && <div className="error">{err}</div>}

      <div className="stage">
        {steps.length ? <Staff steps={steps} timeSig={[4, 4]} /> : <div className="muted center pad">Notes you play will appear here.</div>}
      </div>
      <div className="kb-wrap"><Keyboard marks={marks} showNames={false} /></div>

      <div className="stats">
        <div className="stat"><div className="stat-v">{events.length}</div><div className="stat-l">notes this session</div></div>
        <div className="stat"><div className="stat-v">{tempo ? `♩≈${tempo}` : '—'}</div><div className="stat-l">estimated tempo</div></div>
        <div className={`stat ${evenness !== null ? (evenness > 80 ? 'good' : evenness < 55 ? 'bad' : 'warn') : ''}`}>
          <div className="stat-v">{evenness !== null ? `${evenness}` : '—'}</div><div className="stat-l">rhythmic evenness /100</div>
        </div>
        <div className="stat"><div className="stat-v">{dyn !== null ? `${dyn} dB` : '—'}</div><div className="stat-l">volume variation</div></div>
      </div>
      <p className="small muted">
        Evenness compares the spacing between notes in your latest phrase. It’s meaningful for scales, Hanon, Alberti bass and other steady passages.
        Volume variation should be low for even scales, and higher when you shape a melody.
      </p>
      {events.length > 0 && (
        <div className="row gap">
          <button className="btn ghost small" onClick={() => setEvents([])}>Clear</button>
          <span className="small muted">Last: {events.slice(-8).map((e) => e.notes.map((m) => noteName(m)).join('+')).join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
