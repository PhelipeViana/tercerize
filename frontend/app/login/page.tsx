import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Plataforma de Gestão de Terceirização e Serviços"
      subtitle="Rastreabilidade completa de contratos, equipes, EPIs, almoxarifado, OS e financeiro."
      footer={
        <>
          Deseja cadastrar uma nova empresa prestadora?{" "}
          <Link href="/cadastro" className="font-semibold text-primary hover:underline">
            Criar conta empresarial
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
