import { ContractsView } from "@/components/modules/contracts-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requirePermission } from "@/lib/auth/dal";
import { listClients, listCompanies, listContracts } from "@/lib/operations/repository";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    welcome?: string;
    createdContractId?: string;
    createdCode?: string;
  }>;
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const session = await requirePermission("contracts:view");
  const params = await searchParams;
  const [companies, contracts, clients] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listContracts(session.tenant.id),
    listClients(session.tenant.id),
  ]);

  const initialTab = params.tab === "clientes" ? "clientes" : "contratos";

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="contracts"
      title="Clientes e contratos"
      subtitle="Gerencie clientes tomadores, contratos ativos, postos de trabalho e vigências."
      hideHeader
    >
      <ContractsView
        tenantName={session.tenant.name}
        contracts={contracts}
        clients={clients}
        initialTab={initialTab}
        welcome={params.welcome === "1"}
        createdContractId={params.createdContractId}
        createdCode={params.createdCode}
      />
    </AdminShell>
  );
}
