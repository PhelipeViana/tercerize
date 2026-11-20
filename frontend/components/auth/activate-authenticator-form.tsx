"use client";

import { useActionState, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { completeSetupLinkAction } from "@/app/actions/auth";
import { Field } from "./field";

interface Props {
  token: string;
  email: string;
  name: string;
  companyName: string;
  roleName: string;
  totpSecret: string;
  otpAuthUri: string;
}

export function ActivateAuthenticatorForm({
  token,
  email,
  name,
  companyName,
  roleName,
  totpSecret,
  otpAuthUri,
}: Props) {
  const [state, action, pending] = useActionState(completeSetupLinkAction, undefined);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 dark:border-blue-500/25 bg-blue-50/70 dark:bg-blue-950/35 p-4 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="size-4 text-[#3B68F7] dark:text-blue-400 shrink-0" aria-hidden="true" />
          <span>Olá, {name}</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300">
          E-mail: <strong className="text-slate-900 dark:text-white">{email}</strong>
          {companyName ? (
            <>
              {" "}
              · Empresa: <strong className="text-slate-900 dark:text-white">{companyName}</strong>
            </>
          ) : null}
          {roleName ? (
            <>
              {" "}
              · Função: <strong className="text-slate-900 dark:text-white">{roleName}</strong>
            </>
          ) : null}
        </p>
      </div>

      {/* Passo 1: Adicionar no Google Authenticator SEM QR Code */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-900 dark:text-white">
          1. Adicione sua conta no aplicativo Google Authenticator
        </p>

        <a
          href={otpAuthUri}
          className="w-full min-h-10 rounded-full border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-950/80 px-4 py-2 text-xs font-bold text-[#3B68F7] dark:text-blue-300 flex items-center justify-center gap-2 transition-colors"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span>Abrir direto no Google Authenticator (celular)</span>
        </a>

        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Ou copie a chave de configuração abaixo e no app Google Authenticator toque em{" "}
            <strong>+ → Inserir uma chave de configuração</strong> (tipo: <em>Baseado no horário</em>):
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
            <code className="flex-1 font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-white break-all">
              {totpSecret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-1 text-[11px] font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-600" aria-hidden="true" />
                  <span>Copiada</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" aria-hidden="true" />
                  <span>Copiar chave</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Passo 2: Validar primeiro código de 6 dígitos */}
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        {state?.error && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {state.error}
          </p>
        )}

        <Field
          id="code"
          label="2. Digite o código atual do Google Authenticator *"
          hint="6 dígitos"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />

        <button
          type="submit"
          disabled={pending}
          className="w-full min-h-12 pill-gradient py-3 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          <span>Validar código e acessar plataforma</span>
        </button>
      </form>
    </div>
  );
}
