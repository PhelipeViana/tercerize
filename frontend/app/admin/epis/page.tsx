import { EPIsView } from "@/components/modules/epis-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies, listEmployees, listEPIDeliveries } from "@/lib/operations/repository";

export default async function EPIsPage() {
  const session = await requireSession();
  const [companies, deliveries, employees] = await Promise.all([
    listCompanies(),
    listEPIDeliveries(session.tenant.id),
    listEmployees(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="epis"
      title="Controle de EPIs"
      subtitle="Registro de entrega de equipamentos de proteção, controle de validade do CA e coleta auditável de assinatura."
      hideHeader
    >
      <EPIsView
        tenantName={session.tenant.name}
        deliveries={deliveries}
        employees={employees}
      />
    </AdminShell>
  );
}
