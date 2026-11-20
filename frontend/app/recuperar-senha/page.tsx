import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverPasswordForm } from "@/components/auth/recover-password-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function RecoverPasswordPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu e-mail cadastrado para gerar o código de redefinição."
      footer={
        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline">
            Voltar ao login
          </Link>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Link href="/cadastro" className="font-medium text-slate-600 dark:text-slate-400 hover:underline">
            Criar nova conta
          </Link>
        </div>
      }
    >
      <RecoverPasswordForm />
    </AuthShell>
  );
}
