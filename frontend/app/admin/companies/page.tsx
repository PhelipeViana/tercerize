import { redirect } from "next/navigation";
import { CompaniesView } from "@/components/modules/companies-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireSession } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

export default async function CompaniesPage() {
  const session = await requireSession();
  if (session.user.role !== "developer") {
    redirect("/admin/contracts");
  }
  const companies = await listCompanies();

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="companies"
      title="Multi-Empresas"
      subtitle="Governança de empresas prestadoras cadastradas, validação de CNPJ e troca de contexto operacional em tempo real."
    >
      <CompaniesView
        activeTenantId={session.tenant.id}
        activeTenantName={session.tenant.name}
        companies={companies}
      />
    </AdminShell>
  );
}
