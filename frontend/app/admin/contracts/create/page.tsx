import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateContractForm } from "@/components/modules/create-contract-form";
import { AdminShell } from "@/components/shell/admin-shell";
import { requirePermission } from "@/lib/auth/dal";
import { listClients, listCompanies } from "@/lib/operations/repository";

interface PageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function CreateContractPage({ searchParams }: PageProps) {
  const session = await requirePermission("contracts:write");
  const params = await searchParams;
  const [companies, clients] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listClients(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="contracts"
      title="Novo contrato"
      subtitle="Vincule o cliente tomador, defina vigência, valor mensal e escopo de postos."
      action={
        <Link
          href="/admin/contracts"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#3B68F7] transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Voltar para contratos</span>
        </Link>
      }
    >
      <CreateContractForm
        tenantName={session.tenant.name}
        clients={clients}
        initialClientId={params.clientId}
      />
    </AdminShell>
  );
}
