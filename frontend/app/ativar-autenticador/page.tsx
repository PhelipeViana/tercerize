import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ActivateAuthenticatorForm } from "@/components/auth/activate-authenticator-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api/server";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

interface SetupLinkData {
  email: string;
  name: string;
  companyName: string;
  roleName: string;
  totpSecret: string;
  otpAuthUri: string;
  message?: string;
}

export default async function ActivateAuthenticatorPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  let data: SetupLinkData | null = null;
  let errorMsg = "";

  if (!token) {
    errorMsg = "Link de ativação ausente. Abra o link enviado para o seu e-mail.";
  } else {
    try {
      const res = await apiFetch(`/api/auth/setup-link?token=${encodeURIComponent(token)}`);
      const json = (await res.json().catch(() => ({}))) as SetupLinkData;
      if (!res.ok || !json.totpSecret) {
        errorMsg = json.message ?? "Este link de ativação é inválido ou já foi utilizado.";
      } else {
        data = json;
      }
    } catch {
      errorMsg = "Não foi possível validar o link agora. Tente novamente em instantes.";
    }
  }

  return (
    <AuthShell
      title="Configurar Google Authenticator"
      subtitle="Ative seu autenticador usando o link recebido no seu e-mail."
      footer={
        <Link href="/login" className="font-bold text-[#3B68F7] dark:text-blue-400 hover:underline">
          Já configurei — ir para o login
        </Link>
      }
    >
      {data && token ? (
        <ActivateAuthenticatorForm
          token={token}
          email={data.email}
          name={data.name}
          companyName={data.companyName}
          roleName={data.roleName}
          totpSecret={data.totpSecret}
          otpAuthUri={data.otpAuthUri}
        />
      ) : (
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{errorMsg}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Você pode solicitar um novo link de configuração diretamente na tela de login.
          </p>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center pill-gradient px-6 py-2 text-xs"
          >
            Voltar ao login
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
