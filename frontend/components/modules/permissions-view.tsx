"use client";

import { useActionState, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from "lucide-react";
import {
  addMemberStateAction,
  deleteRoleAction,
  removeMemberAction,
  resendMemberLinkAction,
  saveRoleStateAction,
  toggleUserBlockAction,
  updateMemberRoleAction,
} from "@/app/actions/auth";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import type { TenantMemberRow, TenantRoleRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  ownerName: string;
  ownerEmail: string;
  currentUserId: string;
  isMaster: boolean;
  roles: TenantRoleRow[];
  members: TenantMemberRow[];
}

const MODULE_PERMISSIONS = [
  { module: "Clientes e contratos", viewKey: "contracts:view", writeKey: "contracts:write" },
  { module: "Ordens de serviço", viewKey: "service_orders:view", writeKey: "service_orders:write" },
  { module: "Colaboradores e escalas", viewKey: "employees:view", writeKey: "employees:write" },
  { module: "Controle de EPIs", viewKey: "epis:view", writeKey: "epis:write" },
  { module: "Almoxarifado e ativos", viewKey: "inventory:view", writeKey: "inventory:write" },
  { module: "Gestão financeira", viewKey: "finance:view", writeKey: "finance:write" },
];

export function PermissionsView({
  tenantName,
  ownerName,
  ownerEmail,
  currentUserId,
  isMaster,
  roles,
  members,
}: Props) {
  const [tab, setTab] = useState<"membros" | "roles">("membros");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TenantRoleRow | null>(null);
  const [confirmBlockMember, setConfirmBlockMember] = useState<TenantMemberRow | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<TenantMemberRow | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<TenantRoleRow | null>(null);
  const [banner, setBanner] = useState<{ ok?: string; warning?: string; error?: string } | null>(null);

  const [memberState, addMemberAction, memberPending] = useActionState(addMemberStateAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState(resendMemberLinkAction, undefined);
  const [roleState, saveRoleAction, rolePending] = useActionState(saveRoleStateAction, undefined);

  // A função Dono da empresa é única e definida exclusivamente pelo Master em Gestão de empresas
  const assignableRoles = roles.filter((r) => r.key !== "owner");

  useEffect(() => {
    if (memberState?.ok && memberState.message) {
      setBanner({ ok: memberState.message, warning: memberState.warning });
      setInviteOpen(false);
    }
  }, [memberState]);

  useEffect(() => {
    if (resendState?.ok && resendState.message) {
      setBanner({ ok: resendState.message });
    } else if (resendState?.error) {
      setBanner({ error: resendState.error });
    }
  }, [resendState]);

  useEffect(() => {
    if (roleState?.ok && roleState.message) {
      setBanner({ ok: roleState.message });
      setRoleModalOpen(false);
      setEditingRole(null);
    }
  }, [roleState]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-balance">
            Roles e permissões
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Gestão exclusiva do Dono ({ownerName}) ou acesso Master para <strong>{tenantName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEditingRole(null);
              setRoleModalOpen(true);
            }}
            className="min-h-11 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            <span>Nova função</span>
          </button>

          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 pill-gradient px-5 py-2 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            <span>Convidar usuário</span>
          </button>
        </div>
      </div>

      {/* Feedback */}
      {banner?.ok && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-800 dark:text-emerald-200 space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {banner.ok}
            </span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs font-semibold hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
          {banner.warning && (
            <p className="text-amber-800 dark:text-amber-200 flex items-center gap-1.5 pl-6">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {banner.warning}
            </p>
          )}
        </div>
      )}
      {banner?.error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {banner.error}
        </p>
      )}

      {/* Faixa de KPIs estruturada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-white/10 rounded-[24px] solid-surface overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
            <Users className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Acessos na empresa</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{members.length}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Funções configuradas</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{roles.length}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex items-center gap-3.5 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dono / Responsável</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{ownerName}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{ownerEmail}</p>
          </div>
        </div>
      </div>

      {/* Superfície principal full-width */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Gerenciar membros ou funções"
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "membros"}
              onClick={() => setTab("membros")}
              className={`min-h-9 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "membros"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300"
              }`}
            >
              Membros ({members.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "roles"}
              onClick={() => setTab("roles")}
              className={`min-h-9 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] ${
                tab === "roles"
                  ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-2xs"
                  : "font-medium text-slate-600 dark:text-slate-300"
              }`}
            >
              Funções e matriz ({roles.length})
            </button>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400">
            Regra ativa: 1 função única por e-mail nesta empresa
          </span>
        </div>

        {tab === "membros" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <th className="rounded-l-xl px-4 py-3.5">Usuário / E-mail</th>
                  <th className="px-4 py-3.5">Função nesta empresa</th>
                  <th className="px-4 py-3.5">Acesso / Authenticator</th>
                  <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {members.map((m) => {
                  const isOwnerRow =
                    m.roleKey === "owner" ||
                    (Boolean(ownerEmail) && m.userEmail.toLowerCase() === ownerEmail.toLowerCase());
                  const isSelf = m.userId === currentUserId;
                  const roleLocked = isOwnerRow || isSelf;
                  const accessed = m.loginCount > 0 || m.totpConfigured;
                  return (
                    <tr key={m.membershipId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <span className="block font-bold text-slate-900 dark:text-white">
                          {m.userName}
                          {isSelf && (
                            <span className="ml-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              Você
                            </span>
                          )}
                        </span>
                        <span className="block font-mono text-xs text-slate-500 dark:text-slate-400">
                          {m.userEmail}
                        </span>
                        {m.otherCompaniesCount > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Também atua em +{m.otherCompaniesCount} empresa(s)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {roleLocked ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-950/80 px-3 py-1 text-xs font-bold text-[#3B68F7] dark:text-blue-300">
                              <Lock className="size-3" aria-hidden="true" />
                              <span>{m.roleName}</span>
                            </span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {isOwnerRow
                                ? "Titular fixo · gerido pelo Master"
                                : "Você não pode alterar a própria função"}
                            </p>
                          </div>
                        ) : (
                          <form action={updateMemberRoleAction} className="inline-flex items-center gap-1.5">
                            <input type="hidden" name="membershipId" value={m.membershipId} />
                            <select
                              name="roleId"
                              defaultValue={m.roleId}
                              onChange={(e) => e.currentTarget.form?.requestSubmit()}
                              aria-label={`Alterar função de ${m.userName}`}
                              className="min-h-9 rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                            >
                              {assignableRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </form>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {m.blocked ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              <span className="size-1.5 rounded-full bg-rose-600" aria-hidden="true" />
                              Acesso bloqueado
                            </span>
                          ) : accessed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              Já acessou
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <Clock className="size-3.5" aria-hidden="true" />
                              Nunca acessou
                            </span>
                          )}
                          {m.lastLoginAt && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              Último: {m.lastLoginAt} ({m.loginCount}x)
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {!m.blocked && (
                            <form action={resendAction}>
                              <input type="hidden" name="userId" value={m.userId} />
                              <button
                                type="submit"
                                disabled={resendPending}
                                title="Enviar link do Google Authenticator por e-mail"
                                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                              >
                                <Mail className="size-3.5" aria-hidden="true" />
                                <span>Enviar link</span>
                              </button>
                            </form>
                          )}

                          {!m.isMaster && !isSelf && (isMaster || !isOwnerRow) && (
                            m.blocked ? (
                              <form action={toggleUserBlockAction}>
                                <input type="hidden" name="userId" value={m.userId} />
                                <button
                                  type="submit"
                                  className="min-h-9 inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                >
                                  <Unlock className="size-3.5" aria-hidden="true" />
                                  <span>Desbloquear</span>
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmBlockMember(m)}
                                className="min-h-9 inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                              >
                                <Ban className="size-3.5" aria-hidden="true" />
                                <span>Bloquear</span>
                              </button>
                            )
                          )}

                          {!isOwnerRow && !isSelf && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveMember(m)}
                              aria-label={`Remover acesso de ${m.userName}`}
                              title="Revogar acesso nesta empresa"
                              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
            {roles.map((r) => (
              <div key={r.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{r.name}</p>
                    {r.isSystem && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Padrão
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {r.membersCount} usuário(s)
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">{r.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {MODULE_PERMISSIONS.map((mod) => {
                      const canView = r.key === "owner" || Boolean(r.permissions[mod.viewKey]);
                      const canWrite = r.key === "owner" || Boolean(r.permissions[mod.writeKey]);
                      if (!canView && !canWrite) return null;
                      return (
                        <span
                          key={mod.module}
                          className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                          {mod.module}: {canWrite ? "Editar" : "Ver"}
                        </span>
                      );
                    })}
                    {(r.key === "owner" || Boolean(r.permissions["ai_chat:use"])) && (
                      <span className="rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-[11px] font-bold text-[#3B68F7] dark:text-blue-300">
                        Assistente IA: Liberado
                      </span>
                    )}
                  </div>
                </div>

                {r.key !== "owner" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(r);
                        setRoleModalOpen(true);
                      }}
                      className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      <span>Editar permissões</span>
                    </button>

                    {!r.isSystem && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRole(r)}
                        aria-label={`Excluir função ${r.name}`}
                        className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: Convidar usuário / conceder subpermissão */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Convidar usuário para esta empresa"
        description="Um e-mail pode atuar em várias empresas, mas terá sempre apenas 1 função única por empresa."
        size="md"
      >
        <form action={addMemberAction} className="space-y-4">
          {memberState?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {memberState.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="invite-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Nome completo *
            </label>
            <input
              id="invite-name"
              name="name"
              required
              placeholder="Ex.: Mariana Souza…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              E-mail de acesso *
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              spellCheck={false}
              required
              placeholder="usuario@empresa.com.br…"
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Função (Role) nesta empresa *
            </label>
            <select
              id="invite-role"
              name="roleId"
              required
              defaultValue={assignableRoles[0]?.id ?? ""}
              className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
            >
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={memberPending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {memberPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              <span>Conceder acesso e enviar link</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Criar ou editar Role e matriz granular */}
      <Modal
        open={roleModalOpen}
        onClose={() => {
          setRoleModalOpen(false);
          setEditingRole(null);
        }}
        title={editingRole ? `Editar função: ${editingRole.name}` : "Criar nova função (Role)"}
        description="Defina quais módulos esta função pode visualizar e editar dentro da empresa."
        size="lg"
      >
        <form key={editingRole?.id ?? "new-role"} action={saveRoleAction} className="space-y-4">
          <input type="hidden" name="id" value={editingRole?.id ?? ""} />

          {roleState?.error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {roleState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="role-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nome da função *
              </label>
              <input
                id="role-name"
                name="name"
                required
                defaultValue={editingRole?.name ?? ""}
                placeholder="Ex.: Supervisor de Campo…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="role-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Descrição
              </label>
              <input
                id="role-desc"
                name="description"
                defaultValue={editingRole?.description ?? ""}
                placeholder="Ex.: Acompanha ordens de serviço e EPIs…"
                className="w-full min-h-11 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                  <th className="px-4 py-3">Módulo operacional</th>
                  <th className="px-4 py-3 text-center">Visualizar</th>
                  <th className="px-4 py-3 text-center">Criar / Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {MODULE_PERMISSIONS.map((mod) => (
                  <tr key={mod.module}>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {mod.module}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`perm_${mod.viewKey}`}
                        aria-label={`Visualizar ${mod.module}`}
                        defaultChecked={Boolean(editingRole?.permissions[mod.viewKey])}
                        className="size-4 rounded border-slate-300 text-[#3B68F7] focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`perm_${mod.writeKey}`}
                        aria-label={`Editar ${mod.module}`}
                        defaultChecked={Boolean(editingRole?.permissions[mod.writeKey])}
                        className="size-4 rounded border-slate-300 text-[#3B68F7] focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                  <td className="px-4 py-3">
                    <span className="block font-bold text-slate-900 dark:text-white">
                      Assistente IA e relatórios
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Lê somente dados desta empresa nos módulos marcados como &ldquo;Visualizar&rdquo; acima.
                    </span>
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-center">
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        name="perm_ai_chat:use"
                        aria-label="Liberar uso do Assistente IA e relatórios"
                        defaultChecked={Boolean(editingRole?.permissions["ai_chat:use"])}
                        className="size-4 rounded border-slate-300 text-[#3B68F7] focus-visible:ring-2 focus-visible:ring-[#3B68F7] cursor-pointer"
                      />
                      <span>Liberar chat IA</span>
                    </label>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setRoleModalOpen(false);
                setEditingRole(null);
              }}
              className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={rolePending}
              className="min-h-11 inline-flex items-center gap-2 pill-gradient px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {rolePending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : editingRole ? (
                <Save className="size-4" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              <span>{editingRole ? "Salvar alterações" : "Criar função"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modais de confirmação crítica */}
      <ConfirmModal
        open={Boolean(confirmBlockMember)}
        onClose={() => setConfirmBlockMember(null)}
        title={`Bloquear acesso de ${confirmBlockMember?.userName ?? "usuário"}?`}
        description="O usuário será desconectado imediatamente de todas as sessões ativas e ficará impedido de fazer login ou recuperar o autenticador até ser desbloqueado."
        confirmLabel="Bloquear agora"
        tone="warning"
        formAction={toggleUserBlockAction}
        hiddenFields={confirmBlockMember ? { userId: confirmBlockMember.userId } : undefined}
      />

      <ConfirmModal
        open={Boolean(confirmRemoveMember)}
        onClose={() => setConfirmRemoveMember(null)}
        title={`Revogar acesso de ${confirmRemoveMember?.userName ?? "usuário"}?`}
        description={`Este usuário perderá o vínculo com ${tenantName}. Caso ele atue em outras empresas, os demais vínculos permanecerão intactos.`}
        confirmLabel="Revogar acesso"
        tone="danger"
        formAction={removeMemberAction}
        hiddenFields={confirmRemoveMember ? { membershipId: confirmRemoveMember.membershipId } : undefined}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteRole)}
        onClose={() => setConfirmDeleteRole(null)}
        title={`Excluir função ${confirmDeleteRole?.name ?? ""}?`}
        description="Esta função personalizada será removida permanentemente da empresa (só é possível excluir funções sem usuários vinculados)."
        confirmLabel="Excluir função"
        tone="danger"
        formAction={deleteRoleAction}
        hiddenFields={confirmDeleteRole ? { id: confirmDeleteRole.id } : undefined}
      />
    </div>
  );
}
