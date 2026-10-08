// Drum section: home, level, lesson and exercise pages.

import '../drums.css';
import { useLive } from '../../shared/audio/input';
import { rankFor, streak, today, useProgress, type Progress } from '../../shared/store/progress';
import { go } from '../../app/router';
import Md from '../../shared/components/Md';
import { DRUM_EXERCISES, DRUM_LESSONS, DRUM_LEVELS } from '../curriculum/levels';
import { useDrumSettings } from '../engine/kit';
import { type DrumLevel } from '../engine/pattern';
import DrumRunner from '../components/DrumRunner';
import KitDiagram from '../components/KitDiagram';
import { DRUM_TECHNIQUE_TIPS, DrumPostureDiagram, GripDiagram } from '../components/Figures';

function levelStats(lv: DrumLevel, p: Progress) {
  let total = 0, done = 0, stars = 0;
  for (const ls of lv.lessons)
    for (const ex of ls.exercises) {
      total++;
      const r = p.exercises[ex.id];
      if (r && r.bestStars >= 1) done++;
      stars += r?.bestStars ?? 0;
    }
  return { total, done, stars, maxStars: total * 3 };
}

function nextDrumExercise(p: Progress) {
  for (const lv of DRUM_LEVELS) for (const ls of lv.lessons) for (const ex of ls.exercises) if (!p.exercises[ex.id] || p.exercises[ex.id].bestStars < 1) return ex;
  return null;
}

export function DrumsHome() {
  const p = useProgress();
  const ds = useDrumSettings();
  const live = useLive();
  const rank = rankFor(p.xp);
  const next = nextDrumExercise(p);
  const started = DRUM_LEVELS.some((lv) => levelStats(lv, p).done > 0);
  return (
    <div className="home">
      <section className="hero">
        <div>
          <div className="eyebrow">Alesis Nitro Max · drums</div>
          <h1>{started ? 'Back behind the kit.' : 'Learn drums, from first stroke to elite.'}</h1>
          <p className="lead">
            Ten levels: grip and pads, counting, rudiments, grooves, fills, styles, odd time and elite speed and time benchmarks. Connected by USB, the app reads every pad and
            how hard you hit it, and coaches your timing limb by limb.
          </p>
          <div className="row gap wrap">
            {next && <button className="btn primary big" onClick={() => go(`drums/ex/${next.id}`)}>{started ? 'Continue' : 'Start'}: {next.title} →</button>}
            {!(live.running && live.source === ds.input) && <button className="btn big" onClick={() => go('drums/setup')}>🥁 Connect your kit</button>}
          </div>
        </div>
        <div className="hero-stats">
          <div className="hs">
            <div className="hs-v">{rank.title}</div>
            <div className="hs-l">{p.xp} XP (piano + drums)</div>
            <div className="xpbar"><div style={{ width: `${rank.next > rank.prev ? ((p.xp - rank.prev) / (rank.next - rank.prev)) * 100 : 100}%` }} /></div>
          </div>
          <div className="hs-row">
            <div className="hs"><div className="hs-v">🔥 {streak(p)}</div><div className="hs-l">day streak</div></div>
            <div className="hs"><div className="hs-v">{Math.round((p.days[today()] ?? 0) / 60)}m</div><div className="hs-l">today</div></div>
          </div>
        </div>
      </section>
      <h2 className="section-title">The path</h2>
      <div className="levels">
        {DRUM_LEVELS.map((lv) => {
          const s = levelStats(lv, p);
          const pct = s.total ? s.done / s.total : 0;
          return (
            <button key={lv.id} className={`level-card ${pct === 1 ? 'complete' : ''}`} onClick={() => go(`drums/level/${lv.id}`)}>
              <div className="level-num">{lv.num}</div>
              <div className="level-body">
                <div className="level-name">{lv.name}</div>
                <div className="muted small">{lv.tagline}</div>
                <div className="level-prog">
                  <div className="bar"><div style={{ width: `${pct * 100}%` }} /></div>
                  <span className="small muted">{s.done}/{s.total} · ★ {s.stars}/{s.maxStars}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="mini-stars">{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</span>;
}

export function DrumLevelPage({ id }: { id: string }) {
  const p = useProgress();
  const lv = DRUM_LEVELS.find((l) => l.id === id);
  if (!lv) return <div className="page"><h1>Not found</h1></div>;
  const next = DRUM_LEVELS.find((l) => l.num === lv.num + 1);
  return (
    <div className="page">
      <div className="crumbs"><a href="#/drums">Drums</a> / Level {lv.num}</div>
      <h1>Level {lv.num}: {lv.name}</h1>
      <p className="lead">{lv.tagline}</p>
      <div className="lesson-list">
        {lv.lessons.map((ls, i) => {
          const passed = ls.exercises.filter((e) => (p.exercises[e.id]?.bestStars ?? 0) >= 1).length;
          return (
            <button key={ls.id} className={`lesson-card ${passed === ls.exercises.length ? 'complete' : ''}`} onClick={() => go(`drums/lesson/${ls.id}`)}>
              <div className="lesson-idx">{lv.num}.{i + 1}</div>
              <div><div className="lesson-title">{ls.title}</div><div className="muted small">{ls.summary}</div></div>
              <div className="lesson-meta small muted">{passed}/{ls.exercises.length}</div>
            </button>
          );
        })}
      </div>
      {next && <div className="row end nav-row"><a className="btn ghost" href={`#/drums/level/${next.id}`}>Level {next.num}: {next.name} →</a></div>}
    </div>
  );
}

export function DrumLessonPage({ id }: { id: string }) {
  const p = useProgress();
  const entry = DRUM_LESSONS.get(id);
  if (!entry) return <div className="page"><h1>Not found</h1></div>;
  const { lesson, level } = entry;
  return (
    <div className="page">
      <div className="crumbs"><a href="#/drums">Drums</a> / <a href={`#/drums/level/${level.id}`}>Level {level.num}: {level.name}</a></div>
      <h1>{lesson.title}</h1>
      <div className="lesson-body">{lesson.body.map((t, i) => <p key={i}><Md text={t} /></p>)}</div>
      {lesson.figures?.includes('kit') && (
        <div className="card figure-card"><h3>Your kit</h3><KitDiagram /></div>
      )}
      {lesson.figures?.includes('grip') && (
        <div className="card figure-card"><h3>Grip</h3><GripDiagram /><ul className="tight">{DRUM_TECHNIQUE_TIPS.slice(0, 2).map((t, i) => <li key={i}><Md text={t} /></li>)}</ul></div>
      )}
      {lesson.figures?.includes('posture') && (
        <div className="card figure-card"><h3>Posture</h3><DrumPostureDiagram /><ul className="tight">{DRUM_TECHNIQUE_TIPS.slice(2).map((t, i) => <li key={i}><Md text={t} /></li>)}</ul></div>
      )}
      <h2 className="section-title">Exercises</h2>
      <div className="ex-list">
        {lesson.exercises.map((ex) => {
          const r = p.exercises[ex.id];
          return (
            <button key={ex.id} className="ex-card" onClick={() => go(`drums/ex/${ex.id}`)}>
              <span className={`kind kind-${ex.kind}`}>{ex.kind === 'follow' ? 'Follow' : 'Tempo'}</span>
              <div className="ex-main"><div className="ex-title">{ex.title}</div><div className="muted small"><Md text={ex.instructions} /></div></div>
              <div className="ex-meta">
                <Stars n={r?.bestStars ?? 0} />
                {ex.targetBpm ? <div className="small muted">{r?.bestBpm ? `♩=${r.bestBpm} / ${ex.targetBpm}` : `target ♩=${ex.targetBpm}`}</div> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DrumExercisePage({ id }: { id: string }) {
  const e = DRUM_EXERCISES.get(id);
  if (!e) return <div className="page"><h1>Not found</h1></div>;
  const ids = [...DRUM_EXERCISES.keys()];
  const nextId = ids[ids.indexOf(id) + 1];
  const next = nextId ? DRUM_EXERCISES.get(nextId) : undefined;
  return (
    <div className="page wide">
      <DrumRunner
        key={id}
        def={e.ex}
        onExit={() => go(`drums/lesson/${e.lessonId}`)}
        onNext={next ? () => go(next.lessonId === e.lessonId ? `drums/ex/${nextId}` : `drums/lesson/${next.lessonId}`) : undefined}
        nextTitle={next ? (next.lessonId === e.lessonId ? next.ex.title : 'new lesson') : undefined}
      />
    </div>
  );
}
