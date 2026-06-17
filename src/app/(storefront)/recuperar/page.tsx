import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetForm } from "@/features/auth/components/reset-form";

export default function RecuperarPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <ResetForm />
          <p className="text-dim mt-4 text-center text-sm">
            <Link href="/ingresar" className="text-primary hover:underline">
              Volver a ingresar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
