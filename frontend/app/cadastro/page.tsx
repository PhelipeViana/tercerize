import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function RegisterPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Criar conta empresarial"
      subtitle="Cadastre uma nova empresa prestadora no ambiente multi-empresas."
      footer={
        <>
          Já possui uma conta?{" "}
          <Link href="/login" className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline">
            Entrar na plataforma
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
