import type { ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  /** Sticky bottom area (primary actions). */
  footer?: ReactNode;
  onBack?: () => void;
  /** Right side of the top bar. */
  topRight?: ReactNode;
  /** Onboarding step indicator, e.g. { current: 1, total: 3 }. */
  step?: { current: number; total: number };
  tone?: 'default' | 'alarm' | 'danger';
}

export function Screen({ children, footer, onBack, topRight, step, tone = 'default' }: ScreenProps) {
  const showBar = onBack || topRight || step;
  return (
    <div className={`screen screen-${tone}`}>
      {showBar ? (
        <header className="topbar">
          {onBack ? (
            <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
              ←
            </button>
          ) : (
            <span className="icon-btn-spacer" />
          )}
          {step ? (
            <div className="steps" aria-label={`Step ${step.current} of ${step.total}`}>
              {Array.from({ length: step.total }, (_, i) => (
                <span key={i} className={`step-dot ${i < step.current ? 'step-dot-on' : ''}`} />
              ))}
            </div>
          ) : (
            <span />
          )}
          {topRight ?? <span className="icon-btn-spacer" />}
        </header>
      ) : null}
      <main className="screen-body">{children}</main>
      {footer ? <footer className="screen-footer">{footer}</footer> : null}
    </div>
  );
}
