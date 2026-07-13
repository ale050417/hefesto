"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Pseudo-aleatorio determinístico (puro): mismo seed → mismo valor. Evita
// Math.random en el render y el mismatch de hidratación.
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Partículas cayendo según la temporada (espejo del index: .season-deco/.flake).
export function SeasonDecoration({
  glyphs,
  intensity,
  durationSec = 0,
}: {
  glyphs: string[];
  intensity: number;
  /** Segundos que corre al entrar; 0 = siempre. Después se desmonta (perf). */
  durationSec?: number;
}) {
  const [visible, setVisible] = useState(true);

  // Con una duración > 0, la decoración corre ese rato al entrar y se apaga
  // sola (no anima para siempre → mejor rendimiento). 0 = siempre encendida.
  useEffect(() => {
    if (!durationSec || durationSec <= 0) return;
    const t = setTimeout(() => setVisible(false), durationSec * 1000);
    return () => clearTimeout(t);
  }, [durationSec]);

  const count = Math.max(0, Math.min(40, intensity || 16));
  const flakes = Array.from({ length: count }, (_, i) => ({
    glyph: glyphs[i % glyphs.length] ?? "•",
    left: rand(i + 1) * 100,
    size: 12 + rand(i + 2) * 16,
    delay: -rand(i + 3) * 12,
    dur: 8 + rand(i + 4) * 8,
    sway: (rand(i + 5) * 2 - 1) * 40,
  }));

  if (count === 0 || !visible) return null;

  return (
    <div className="season-deco" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={
            {
              left: `${f.left}%`,
              fontSize: `${f.size}px`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.dur}s`,
              "--sway": `${f.sway}px`,
            } as CSSProperties
          }
        >
          {f.glyph}
        </span>
      ))}
    </div>
  );
}
