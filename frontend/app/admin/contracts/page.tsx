import Link from "next/link";
import { Plus } from "lucide-react";
import { ContractsView } from "@/components/modules/contracts-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listClients, listCompanies, listContracts } from "@/lib/operations/repository";

export default async function ContractsPage() {
  const session = await requireSession();
  const [companies, contracts, clients] = await Promise.all([
    listCompanies(),
    listContracts(session.tenant.id),
    listClients(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="contracts"
      title="Clientes e contratos"
      subtitle="Acompanhe contratos, clientes e postos alocados."
      action={
        <Link
          href="/admin/contracts/create"
          className="inline-flex min-h-11 items-center gap-2 pill-gradient px-6 py-2.5 text-sm"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Novo contrato</span>
        </Link>
      }
    >
      <ContractsView contracts={contracts} clients={clients} />
    </AdminShell>
  );
}
