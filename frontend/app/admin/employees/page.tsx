import { EmployeesView } from "@/components/modules/employees-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies, listContracts, listEmployees } from "@/lib/operations/repository";

interface PageProps {
  searchParams: Promise<{ contractId?: string }>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [companies, employees, contracts] = await Promise.all([
    listCompanies(),
    listEmployees(session.tenant.id),
    listContracts(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="employees"
      title="Colaboradores e escalas"
      subtitle="Equipe técnica, funções, alocação por contrato, cobertura de postos e verificação de conflito de turno."
    >
      <EmployeesView
        tenantName={session.tenant.name}
        employees={employees}
        contracts={contracts}
        initialContractId={params.contractId}
      />
    </AdminShell>
  );
}
