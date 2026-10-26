export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="18" y="8" width="20" height="78" rx="10" fill="currentColor" />
      <rect x="18" y="66" width="40" height="20" rx="8" fill="currentColor" />
      <rect x="52" y="44" width="20" height="30" rx="5" fill="var(--green)" />
      <polygon points="40,72 84,72 62,98" fill="var(--green)" />
    </svg>
  );
}
