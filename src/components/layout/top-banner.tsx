export function TopBanner() {
  return (
    <div className="store-banner">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="15"
        height="15"
        aria-hidden="true"
      >
        <path d="M1 3h13v13H1z" />
        <path d="M14 8h4l3 3v5h-7z" />
        <circle cx="5.5" cy="18.5" r="2" />
        <circle cx="17.5" cy="18.5" r="2" />
      </svg>
      <span>Envío gratis en compras +$30.000</span>
    </div>
  );
}
