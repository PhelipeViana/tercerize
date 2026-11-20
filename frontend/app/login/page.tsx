import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Entrar na plataforma"
      subtitle="Gerencie contratos, equipes, almoxarifado e ordens de serviço."
      footer={
        <div className="space-y-1.5">
          <p>
            Ainda não possui conta?{" "}
            <Link href="/cadastro" className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline">
              Criar conta empresarial
            </Link>
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
