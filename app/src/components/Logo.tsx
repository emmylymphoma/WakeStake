export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className={`logo logo-${size}`}>
      <span className="logo-mark" aria-hidden>
        ⏰
      </span>
      <span className="logo-word">
        Wake<span>Stake</span>
      </span>
    </div>
  );
}
