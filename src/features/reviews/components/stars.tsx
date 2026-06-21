export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex"
      style={{ color: "var(--gold)" }}
      aria-label={`${value} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
        </svg>
      ))}
    </span>
  );
}
