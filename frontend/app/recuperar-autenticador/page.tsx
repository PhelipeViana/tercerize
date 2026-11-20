import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverAuthenticatorForm } from "@/components/auth/recover-authenticator-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function RecoverAuthenticatorPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Recuperar autenticação"
      subtitle="Valide seu e-mail para receber um novo link de configuração do Google Authenticator."
      footer={
        <Link href="/login" className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <RecoverAuthenticatorForm />
    </AuthShell>
  );
}
