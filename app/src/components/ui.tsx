import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = true,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`}
    >
      {loading ? <span className="spinner" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Card({ children, className = '', tone }: { children: ReactNode; className?: string; tone?: 'danger' | 'lime' }) {
  return <div className={`card ${tone ? `card-${tone}` : ''} ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

interface ChipOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chip-group" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`chip ${o.value === value ? 'chip-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          <span className="chip-label">{o.label}</span>
          {o.hint ? <span className="chip-hint">{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </span>
      <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Stat({
  label,
  value,
  tone,
  delta,
}: {
  label: string;
  value: ReactNode;
  tone?: 'danger' | 'lime';
  delta?: string;
}) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta ? <div className="stat-delta">{delta}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'lime' }: { value: number; max: number; tone?: 'lime' | 'danger' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={`progress-fill progress-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function MockBadge({ children = 'DEMO · MOCK DATA' }: { children?: ReactNode }) {
  return <span className="mock-badge">{children}</span>;
}
