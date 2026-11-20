"use client";

import { useActionState, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Plus,
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
import type { TenantMemberRow, TenantRoleRow } from "@/lib/operations/repository";

interface Props {
  tenantName: string;
  ownerName: string;
  ownerEmail: string;
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
  isMaster,
  roles,
  members,
}: Props) {
  const [tab, setTab] = useState<"membros" | "roles">("membros");
  const [editingRole, setEditingRole] = useState<TenantRoleRow | null>(null);

  const [memberState, addMemberAction, memberPending] = useActionState(addMemberStateAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState(resendMemberLinkAction, undefined);
  const [roleState, saveRoleAction, rolePending] = useActionState(saveRoleStateAction, undefined);

  const assignableRoles = roles.filter((r) => isMaster || r.key !== "owner");

  return (
    <div className="space-y-5">
      {/* Cabeçalho com indicação de governança exclusiva (Dono da empresa ou Master) */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Roles e permissões
          </h1>
          <p className="mt-1 text-xs sm:text-[15px] font-normal text-slate-600 dark:text-slate-400">
            Gestão exclusiva do Dono ({ownerName}) ou acesso Master para a empresa <strong>{tenantName}</strong>.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/40 px-4 py-2 text-xs font-bold text-[#3B68F7] dark:text-blue-300">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>1 função única por e-mail nesta empresa</span>
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-blue-100/80 via-blue-50/65 to-white/85 dark:from-blue-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7] dark:text-blue-300">
            <Users className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Acessos na empresa</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {members.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-purple-100/80 via-purple-50/65 to-white/85 dark:from-purple-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-300">
            <KeyRound className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Funções (Roles)</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {roles.length}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 dark:border-white/10 bg-gradient-to-br from-emerald-100/80 via-emerald-50/65 to-white/85 dark:from-emerald-950/55 dark:via-slate-900/70 dark:to-slate-900/80 backdrop-blur-xl p-5 flex items-center gap-4">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <ShieldCheck className="size-6 stroke-[1.75]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Dono / Responsável</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">{ownerName}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{ownerEmail}</p>
          </div>
        </div>
      </div>

      {/* Main Solid Surface */}
      <section className="rounded-[28px] solid-surface p-5 sm:p-7 space-y-6">
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
            className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
              tab === "membros"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                : "font-medium text-slate-600 dark:text-slate-300"
            }`}
          >
            Membros e subpermissões ({members.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "roles"}
            onClick={() => setTab("roles")}
            className={`rounded-full px-5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
              tab === "roles"
                ? "bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white shadow-xs"
                : "font-medium text-slate-600 dark:text-slate-300"
            }`}
          >
            Funções (Roles) e permissões ({roles.length})
          </button>
        </div>

        {resendState?.ok && resendState.message && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{resendState.message}</span>
          </div>
        )}
        {resendState?.error && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
          >
            {resendState.error}
          </p>
        )}

        {tab === "membros" ? (
          <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <th className="rounded-l-xl px-4 py-3.5">Usuário / E-mail</th>
                    <th className="px-4 py-3.5">Função única nesta empresa</th>
                    <th className="px-4 py-3.5">Google Authenticator</th>
                    <th className="rounded-r-xl px-4 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {members.map((m) => {
                    const isOwnerRow = m.roleKey === "owner";
                    return (
                      <tr key={m.membershipId} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="px-4 py-4">
                          <span className="block font-bold text-slate-900 dark:text-white">{m.userName}</span>
                          <span className="block font-mono text-xs text-slate-500 dark:text-slate-400">
                            {m.userEmail}
                          </span>
                          {m.otherCompaniesCount > 0 && (
                            <span className="mt-1 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              Também atua em +{m.otherCompaniesCount} outra(s) empresa(s)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {isOwnerRow && !isMaster ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-950/80 px-3 py-1 text-xs font-bold text-[#3B68F7] dark:text-blue-300">
                              {m.roleName}
                            </span>
                          ) : (
                            <form action={updateMemberRoleAction} className="inline-flex items-center gap-1.5">
                              <input type="hidden" name="membershipId" value={m.membershipId} />
                              <select
                                name="roleId"
                                defaultValue={m.roleId}
                                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                                aria-label={`Alterar função de ${m.userName}`}
                                className="rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-white"
                              >
                                {roles
                                  .filter((r) => isMaster || r.key !== "owner" || r.id === m.roleId)
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                              </select>
                            </form>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {m.blocked ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              <span className="size-1.5 rounded-full bg-rose-600" aria-hidden="true" />
                              Acesso bloqueado
                            </span>
                          ) : m.totpConfigured ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                              Ativado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <span className="size-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                              Aguardando ativação
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!m.blocked && (
                              <form action={resendAction}>
                                <input type="hidden" name="userId" value={m.userId} />
                                <button
                                  type="submit"
                                  disabled={resendPending}
                                  title="Enviar link do Google Authenticator por e-mail"
                                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] cursor-pointer"
                                >
                                  <Mail className="size-3" aria-hidden="true" />
                                  <span>Enviar link</span>
                                </button>
                              </form>
                            )}

                            {!m.isMaster && (isMaster || !isOwnerRow) && (
                              <form action={toggleUserBlockAction}>
                                <input type="hidden" name="userId" value={m.userId} />
                                <button
                                  type="submit"
                                  title={
                                    m.blocked
                                      ? "Desbloquear acesso do usuário"
                                      : "Bloquear usuário e encerrar todas as sessões imediatamente"
                                  }
                                  className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${
                                    m.blocked
                                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                                      : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                                  }`}
                                >
                                  {m.blocked ? (
                                    <>
                                      <Unlock className="size-3" aria-hidden="true" />
                                      <span>Desbloquear</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="size-3" aria-hidden="true" />
                                      <span>Bloquear</span>
                                    </>
                                  )}
                                </button>
                              </form>
                            )}

                            {!isOwnerRow && (
                              <form action={removeMemberAction}>
                                <input type="hidden" name="membershipId" value={m.membershipId} />
                                <button
                                  type="submit"
                                  title="Revogar acesso nesta empresa"
                                  aria-label={`Remover acesso de ${m.userName}`}
                                  className="inline-flex min-h-8 items-center justify-center rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 text-rose-600 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" aria-hidden="true" />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Formulário: Conceder subpermissão na empresa ativa */}
            <form
              action={addMemberAction}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-5 space-y-3.5 h-fit"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-[#3B68F7]">
                  <UserPlus className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Conceder acesso / subpermissão
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    O mesmo e-mail pode atuar em outras empresas, mas jamais terá 2 funções em {tenantName}.
                  </p>
                </div>
              </div>

              {memberState?.ok && memberState.message && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200 space-y-1"
                >
                  <p>{memberState.message}</p>
                  {memberState.warning && (
                    <p className="text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                      {memberState.warning}
                    </p>
                  )}
                </div>
              )}

              {memberState?.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {memberState.error}
                </p>
              )}

              <div className="space-y-1">
                <label htmlFor="member-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Nome completo *
                </label>
                <input
                  id="member-name"
                  name="name"
                  required
                  placeholder="Ex.: Mariana Lopes"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="member-email" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  E-mail corporativo *
                </label>
                <input
                  id="member-email"
                  name="email"
                  type="email"
                  required
                  placeholder="usuario@empresa.com.br"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="member-role" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Função única na empresa {tenantName} *
                </label>
                <select
                  id="member-role"
                  name="roleId"
                  required
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={memberPending}
                className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {memberPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                <span>Adicionar acesso e enviar link por e-mail</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Lista de Roles da empresa */}
            <div className="space-y-3">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{r.name}</h3>
                        <span className="rounded-full bg-slate-200/80 dark:bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                          {r.membersCount} usuário(s)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.description}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {r.key !== "owner" && (
                        <button
                          type="button"
                          onClick={() => setEditingRole(r)}
                          className="rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#3B68F7] cursor-pointer"
                        >
                          Editar permissões
                        </button>
                      )}
                      {!r.isSystem && r.membersCount === 0 && (
                        <form action={deleteRoleAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            aria-label={`Excluir função ${r.name}`}
                            className="rounded-full border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {MODULE_PERMISSIONS.map((mp) => {
                      const canWrite = Boolean(r.permissions[mp.writeKey]);
                      const canView = Boolean(r.permissions[mp.viewKey]);
                      if (!canView && !canWrite) return null;
                      return (
                        <span
                          key={mp.module}
                          className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                        >
                          {mp.module}: <strong>{canWrite ? "Visualizar e Gerenciar" : "Somente leitura"}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Formulário de Criação / Edição de Role e Matriz de Permissões */}
            <form
              key={editingRole?.id ?? "new-role"}
              action={async (fd) => {
                await saveRoleAction(fd);
                setEditingRole(null);
              }}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-5 space-y-4 h-fit"
            >
              <input type="hidden" name="id" value={editingRole?.id ?? ""} />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingRole ? `Editar função: ${editingRole.name}` : "Criar nova função (Role)"}
                </h3>
                {editingRole && (
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>

              {roleState?.ok && roleState.message && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
                >
                  {roleState.message}
                </p>
              )}
              {roleState?.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                >
                  {roleState.error}
                </p>
              )}

              <div className="space-y-1">
                <label htmlFor="role-name" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Nome da função *
                </label>
                <input
                  id="role-name"
                  name="name"
                  required
                  defaultValue={editingRole?.name ?? ""}
                  placeholder="Ex.: Supervisor de Almoxarifado"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="role-desc" className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Descrição
                </label>
                <input
                  id="role-desc"
                  name="description"
                  defaultValue={editingRole?.description ?? ""}
                  placeholder="Resumo das responsabilidades desta função"
                  className="w-full rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Matriz de permissões por módulo</p>
                <div className="divide-y divide-slate-200/70 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                  {MODULE_PERMISSIONS.map((mp) => (
                    <div key={mp.module} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{mp.module}</span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`perm_${mp.viewKey}`}
                            defaultChecked={Boolean(editingRole?.permissions[mp.viewKey])}
                            className="rounded border-slate-300 text-[#3B68F7]"
                          />
                          <span>Ver</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`perm_${mp.writeKey}`}
                            defaultChecked={Boolean(editingRole?.permissions[mp.writeKey])}
                            className="rounded border-slate-300 text-[#3B68F7]"
                          />
                          <span>Gerenciar</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={rolePending}
                className="w-full min-h-10 pill-gradient py-2.5 px-5 text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {rolePending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                <span>{editingRole ? "Salvar alterações da função" : "Criar função nesta empresa"}</span>
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
