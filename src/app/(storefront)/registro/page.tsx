import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/components/register-form";

export default function RegistroPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <p className="text-dim mt-4 text-center text-sm">
            ¿Ya tenés cuenta?{" "}
            <Link href="/ingresar" className="text-primary hover:underline">
              Ingresá
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
