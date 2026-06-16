import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sections = [
  {
    href: "/admin/productos",
    title: "Productos",
    description: "Crear, editar y publicar productos del catálogo.",
  },
  {
    href: "/admin/categorias",
    title: "Categorías",
    description: "Organizar el catálogo en categorías.",
  },
];

export default function AdminHome() {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">Panel</p>
      <h1 className="font-display text-fg mt-2 text-3xl">Administración</h1>
      <p className="text-dim mt-2">Gestioná el catálogo de Hefesto 3D.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-primary text-sm">Ir →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
