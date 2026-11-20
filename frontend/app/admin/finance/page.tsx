import { FinanceView } from "@/components/modules/finance-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requirePermission } from "@/lib/auth/dal";
import { listCompanies, listContracts, listFinancialEntries } from "@/lib/operations/repository";

export default async function FinancePage() {
  const session = await requirePermission("finance:view");
  const [companies, entries, contracts] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listFinancialEntries(session.tenant.id),
    listContracts(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="finance"
      title="Gestão financeira"
      subtitle="Receitas vinculadas aos contratos, despesas operacionais, filtro por competência e conciliação auditável."
      hideHeader
    >
      <FinanceView
        tenantName={session.tenant.name}
        entries={entries}
        contracts={contracts}
      />
    </AdminShell>
  );
}
