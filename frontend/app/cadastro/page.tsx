import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function RegisterPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Cadastrar Empresa Prestadora"
      subtitle="Configure uma nova empresa no ambiente multi-tenant."
      footer={
        <>
          Já possui acesso?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
