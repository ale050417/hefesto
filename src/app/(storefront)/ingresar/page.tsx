import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect, error } = await searchParams;
  const safe = redirect && redirect.startsWith("/") ? redirect : "/";
  // Motivo que manda /auth/callback cuando el link del mail o el acceso con
  // Google falla. Sin esto el cliente veía "error" y nada más.
  const aviso = typeof error === "string" ? error.slice(0, 200) : null;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Ingresar</CardTitle>
        </CardHeader>
        <CardContent>
          {aviso ? (
            <p
              role="alert"
              className="border-danger/40 bg-danger/10 text-danger mb-4 rounded-md border p-3 text-sm"
            >
              {aviso}
            </p>
          ) : null}
          <LoginForm redirectTo={safe} />
          <p className="text-dim mt-4 text-center text-sm">
            ¿No tenés cuenta?{" "}
            <Link href="/registro" className="text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
