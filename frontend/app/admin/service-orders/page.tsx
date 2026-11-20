import { ServiceOrdersView } from "@/components/modules/service-orders-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import {
  listClients,
  listCompanies,
  listContracts,
  listEmployees,
  listServiceOrders,
} from "@/lib/operations/repository";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
    contractId?: string;
    employeeId?: string;
  }>;
}

export default async function ServiceOrdersPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [companies, orders, clients, contracts, employees] = await Promise.all([
    listCompanies(),
    listServiceOrders(session.tenant.id),
    listClients(session.tenant.id),
    listContracts(session.tenant.id),
    listEmployees(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="service-orders"
      title="Ordens de serviço"
      subtitle="Despacho de chamados, agendamento com data e hora, alocação técnica e progressão em tempo real."
    >
      <ServiceOrdersView
        tenantName={session.tenant.name}
        orders={orders}
        clients={clients}
        contracts={contracts}
        employees={employees}
        initialClientId={params.clientId}
        initialContractId={params.contractId}
        initialEmployeeId={params.employeeId}
      />
    </AdminShell>
  );
}
