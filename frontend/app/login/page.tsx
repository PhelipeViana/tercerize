import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/dal";

export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Entrar na plataforma"
      subtitle="Autenticação obrigatória via e-mail corporativo e Google Authenticator."
      footer={
        <p className="text-xs text-slate-500 dark:text-slate-400">
          O acesso é concedido exclusivamente pelo administrador Master ou pelo Dono da sua empresa.
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
