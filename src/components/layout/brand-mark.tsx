export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="hef-brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#A8863A" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="11"
        fill="#0A0A0F"
        stroke="url(#hef-brand-g)"
        strokeWidth="1.5"
      />
      <path
        d="M16 14v20M32 14v20M16 24h16"
        stroke="url(#hef-brand-g)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="2.6" fill="url(#hef-brand-g)" />
    </svg>
  );
}
