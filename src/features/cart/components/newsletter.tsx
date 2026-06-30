"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

const Ic = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    aria-hidden
    dangerouslySetInnerHTML={{ __html: d }}
  />
);

const SPARKLES =
  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>';
const SEND = '<path d="m22 2-7 20-4-9-9-4 20-7z"/>';
const WA =
  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>';

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="store-section pt-0">
      <div className="store-wrap">
        <div className="ui-card news-card">
          <div className="news-glow" />
          <div className="relative z-[1]">
            <div className="eyebrow flex items-center justify-center gap-1.5">
              <Ic d={SPARKLES} size={14} /> Sumate a la comunidad
            </div>
            <h2 className="sec-title mt-2.5 mb-2">
              Enterate de novedades y ofertas
            </h2>
            <p className="text-dim mx-auto mb-6 max-w-[460px] text-sm">
              Lanzamientos, descuentos exclusivos y diseños nuevos directo a tu
              correo. Sin spam.
            </p>

            {done ? (
              <p className="text-success font-medium">
                ¡Gracias! Te sumaste a la comunidad. 🎉
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) setDone(true);
                }}
                className="news-form"
              >
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
                <Button type="submit">
                  <Ic d={SEND} size={16} /> Suscribirme
                </Button>
              </form>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <a
                href="https://wa.me/541155128834"
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Ic d={WA} size={15} /> Comunidad de WhatsApp
              </a>
              <a
                href="https://instagram.com/hefesto3d"
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Ic d={SEND} size={15} /> Seguinos en Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
