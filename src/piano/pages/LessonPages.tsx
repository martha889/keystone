import { ALL_EXERCISES, LESSONS, LEVELS } from '../curriculum/levels';
import { useProgress } from '../../shared/store/progress';
import { go } from '../../app/router';
import Md from '../../shared/components/Md';
import ExerciseRunner from '../components/ExerciseRunner';
import { HandsDiagram, PostureDiagram, POSTURE_TIPS } from '../components/Hands';
import { levelStats } from './Home';

const KIND_LABEL = { follow: 'Follow', tempo: 'Tempo', ear: 'Ear' } as const;

function Stars({ n }: { n: number }) {
  return (
    <span className="mini-stars" aria-label={`${n} stars`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}
    </span>
  );
}

export function LevelPage({ id }: { id: string }) {
  const p = useProgress();
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) return <NotFound />;
  const s = levelStats(lv, p);
  const prev = LEVELS.find((l) => l.num === lv.num - 1);
  const next = LEVELS.find((l) => l.num === lv.num + 1);
  return (
    <div className="page">
      <div className="crumbs"><a href="#/">Home</a> / Level {lv.num}</div>
      <h1>Level {lv.num}: {lv.name}</h1>
      <p className="lead">{lv.tagline}</p>
      <div className="muted small">{s.done}/{s.total} exercises passed · ★ {s.stars}/{s.maxStars}</div>
      <div className="lesson-list">
        {lv.lessons.map((ls, i) => {
          const exs = ls.exercises;
          const passed = exs.filter((e) => (p.exercises[e.id]?.bestStars ?? 0) >= 1).length;
          return (
            <button key={ls.id} className={`lesson-card ${exs.length && passed === exs.length ? 'complete' : ''}`} onClick={() => go(`lesson/${ls.id}`)}>
              <div className="lesson-idx">{lv.num}.{i + 1}</div>
              <div>
                <div className="lesson-title">{ls.title}</div>
                <div className="muted small">{ls.summary}</div>
              </div>
              <div className="lesson-meta small muted">{exs.length ? `${passed}/${exs.length}` : 'Reading'}</div>
            </button>
          );
        })}
      </div>
      <div className="row between nav-row">
        {prev ? <a className="btn ghost" href={`#/level/${prev.id}`}>← Level {prev.num}</a> : <span />}
        {next && <a className="btn ghost" href={`#/level/${next.id}`}>Level {next.num}: {next.name} →</a>}
      </div>
    </div>
  );
}

export function LessonPage({ id }: { id: string }) {
  const p = useProgress();
  const entry = LESSONS.get(id);
  if (!entry) return <NotFound />;
  const { lesson, level } = entry;
  const idx = level.lessons.findIndex((l) => l.id === id);
  const nextLesson = level.lessons[idx + 1] ?? LEVELS.find((l) => l.num === level.num + 1)?.lessons[0];
  return (
    <div className="page">
      <div className="crumbs"><a href="#/">Home</a> / <a href={`#/level/${level.id}`}>Level {level.num}: {level.name}</a></div>
      <h1>{lesson.title}</h1>
      <div className="lesson-body">
        {lesson.body.map((para, i) => <p key={i}><Md text={para} /></p>)}
      </div>
      {lesson.figures?.includes('posture') && (
        <div className="card figure-card">
          <h3>Hand shape</h3>
          <PostureDiagram />
          <ul className="tight">{POSTURE_TIPS.map((t, i) => <li key={i}><Md text={t} /></li>)}</ul>
        </div>
      )}
      {lesson.figures?.includes('hands') && (
        <div className="card figure-card">
          <h3>Finger numbers</h3>
          <HandsDiagram activeL={[1, 2, 3, 4, 5]} activeR={[1, 2, 3, 4, 5]} />
        </div>
      )}
      {lesson.exercises.length > 0 && <h2 className="section-title">Exercises</h2>}
      <div className="ex-list">
        {lesson.exercises.map((ex) => {
          const r = p.exercises[ex.id];
          return (
            <button key={ex.id} className="ex-card" onClick={() => go(`ex/${ex.id}`)}>
              <span className={`kind kind-${ex.kind}`}>{KIND_LABEL[ex.kind]}</span>
              <div className="ex-main">
                <div className="ex-title">{ex.title}</div>
                <div className="muted small"><Md text={ex.instructions} /></div>
              </div>
              <div className="ex-meta">
                <Stars n={r?.bestStars ?? 0} />
                {r?.bestBpm ? <div className="small muted">♩={r.bestBpm}{ex.targetBpm ? ` / ${ex.targetBpm}` : ''}</div> : ex.targetBpm ? <div className="small muted">target ♩={ex.targetBpm}</div> : null}
              </div>
            </button>
          );
        })}
      </div>
      {nextLesson && (
        <div className="row end nav-row">
          <a className="btn ghost" href={`#/lesson/${nextLesson.id}`}>Next lesson: {nextLesson.title} →</a>
        </div>
      )}
    </div>
  );
}

export function ExercisePage({ id }: { id: string }) {
  const entry = ALL_EXERCISES.get(id);
  if (!entry) return <NotFound />;
  const { ex, lessonId } = entry;
  // Next exercise in curriculum order
  const ids = [...ALL_EXERCISES.keys()];
  const nextId = ids[ids.indexOf(id) + 1];
  const next = nextId ? ALL_EXERCISES.get(nextId) : undefined;
  return (
    <div className="page wide">
      <ExerciseRunner
        key={id}
        def={ex}
        onExit={() => go(`lesson/${lessonId}`)}
        onNext={next ? () => go(next.lessonId === lessonId ? `ex/${nextId}` : `lesson/${next.lessonId}`) : undefined}
        nextTitle={next ? (next.lessonId === lessonId ? next.ex.title : `new lesson`) : undefined}
      />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <h1>Not found</h1>
      <a href="#/">Go home</a>
    </div>
  );
}
