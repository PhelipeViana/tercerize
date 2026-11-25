import { AssistantView, type AllowedModuleInfo } from "@/components/modules/assistant-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { listAIConversations, listAIMessages } from "@/lib/ai/repository";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

interface AssistantPageProps {
  searchParams: Promise<{ c?: string }>;
}

const MODULE_DEFINITIONS: Array<{ key: AllowedModuleInfo["key"]; perm: string; label: string }> = [
  { key: "contracts", perm: "contracts:view", label: "Contratos" },
  { key: "service_orders", perm: "service_orders:view", label: "Ordens de serviço" },
  { key: "employees", perm: "employees:view", label: "Colaboradores" },
  { key: "epis", perm: "epis:view", label: "EPIs" },
  { key: "inventory", perm: "inventory:view", label: "Almoxarifado" },
  { key: "finance", perm: "finance:view", label: "Financeiro" },
];

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  const session = await requirePermission("ai_chat:use");
  const { c: requestedConversationId } = await searchParams;

  const [companies, conversations] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listAIConversations(session.tenant.id, session.user.id),
  ]);

  const activeConversationId =
    requestedConversationId && conversations.some((conv) => conv.id === requestedConversationId)
      ? requestedConversationId
      : "";

  const initialMessages = activeConversationId
    ? await listAIMessages(activeConversationId, session.tenant.id, session.user.id)
    : [];

  const allowedModules: AllowedModuleInfo[] = MODULE_DEFINITIONS.filter((m) =>
    hasPermission(session, m.perm),
  ).map(({ key, label }) => ({ key, label }));

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="assistant"
      title="Assistente IA & Relatórios"
      subtitle="Consulte dados da empresa ativa e gere relatórios prontos para impressão ou exportação."
      hideHeader
    >
      <AssistantView
        tenantName={session.tenant.name}
        tenantCnpj={session.tenant.cnpj}
        hasOpenrouterToken={session.tenant.hasOpenrouterToken}
        initialCreditDepleted={session.tenant.aiCreditDepleted}
        isMaster={session.user.isMaster}
        roleName={session.role.name}
        allowedModules={allowedModules}
        initialConversations={conversations}
        initialConversationId={activeConversationId}
        initialMessages={initialMessages}
      />
    </AdminShell>
  );
}
