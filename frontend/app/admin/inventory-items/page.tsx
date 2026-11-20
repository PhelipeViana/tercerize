import { InventoryView } from "@/components/modules/inventory-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requirePermission } from "@/lib/auth/dal";
import {
  listCompanies,
  listEmployees,
  listInventoryItems,
  listInventoryMovements,
  listServiceOrders,
} from "@/lib/operations/repository";

export default async function InventoryItemsPage() {
  const session = await requirePermission("inventory:view");
  const [companies, items, movements, employees, serviceOrders] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listInventoryItems(session.tenant.id),
    listInventoryMovements(session.tenant.id),
    listEmployees(session.tenant.id),
    listServiceOrders(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="inventory-items"
      title="Almoxarifado e ativos"
      subtitle="Controle transacional de saldo, operações adaptadas por categoria, vínculo com OS e histórico de cautelas."
      hideHeader
    >
      <InventoryView
        tenantName={session.tenant.name}
        items={items}
        movements={movements}
        employees={employees}
        serviceOrders={serviceOrders}
      />
    </AdminShell>
  );
}
