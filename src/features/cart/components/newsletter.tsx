"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="store-section pt-0">
      <div className="store-wrap">
        <div
          className="ui-card relative overflow-hidden p-10 text-center"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in srgb, var(--gold) 8%, var(--surface-1)), var(--surface-1))",
            borderColor: "rgba(var(--gold-rgb),.25)",
          }}
        >
          <div className="eyebrow">Sumate a la comunidad</div>
          <h2 className="sec-title mt-2 mb-2">Novedades y ofertas</h2>
          <p className="text-dim mx-auto mb-6 max-w-md text-sm">
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
              className="mx-auto flex max-w-md gap-2"
            >
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
              <Button type="submit">Suscribirme</Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
