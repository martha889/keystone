// "Repeat ×N" selector shown before an exercise starts.

export const REPEAT_OPTIONS = [1, 2, 3, 4, 6, 8];

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(5, Math.round(seconds / 5) * 5)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round((seconds % 60) / 15) * 15;
  return s ? `${m} min ${s === 60 ? '' : `${s} s`}`.trim() : `${m} min`;
}

export default function RepeatPicker({ value, onChange, seconds, unit = 'time' }: { value: number; onChange: (n: number) => void; seconds?: number; unit?: string }) {
  return (
    <div className="repeat-picker">
      <span className="small">Repeat</span>
      <div className="seg" role="radiogroup" aria-label="Repeat the exercise">
        {REPEAT_OPTIONS.map((n) => (
          <button key={n} role="radio" aria-checked={n === value} className={n === value ? 'on' : ''} onClick={() => onChange(n)}>
            {n}×
          </button>
        ))}
      </div>
      <span className="muted small">
        {value > 1 ? `${value} ${unit}s in a row` : `once`}
        {seconds ? ` · about ${formatDuration(seconds)}` : ''}
      </span>
    </div>
  );
}
