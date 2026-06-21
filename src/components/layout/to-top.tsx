"use client";

import { useEffect, useState } from "react";

export function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      className="bg-primary text-primary-fg fixed right-5 bottom-[5.25rem] z-[250] grid h-11 w-11 place-items-center rounded-full shadow-lg"
    >
      ↑
    </button>
  );
}
