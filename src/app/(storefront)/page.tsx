import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder temporal (Fase 1). La Home real se construye en el Paso 16.
export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Fase 1 · en construcción</p>
      <h1 className="font-display text-fg mt-3 text-3xl">
        Bienvenido a Hefesto 3D
      </h1>
      <p className="text-dim mt-2 max-w-prose">
        Esta es una vista temporal: ya funcionan el header, el footer y los
        primitivos de UI. El catálogo llega en los próximos pasos.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Maceta geométrica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Badge variant="danger">Oferta</Badge>
              <Badge variant="info">Nuevo</Badge>
            </div>
            <p className="text-dim">
              <span className="text-faint line-through">$4.500</span>{" "}
              <span className="text-fg text-xl">$3.800</span>
            </p>
            <Button>Ver producto</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lámpara lunar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="neutral">2 tamaños</Badge>
            <p className="text-dim">
              desde <span className="text-fg text-xl">$7.800</span>
            </p>
            <Button variant="outline">Ver producto</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
