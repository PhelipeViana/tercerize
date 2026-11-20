import { redirect } from "next/navigation";
import { CompaniesView } from "@/components/modules/companies-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

export default async function CompaniesPage() {
  const session = await requireSession();
  if (!session.user.isMaster) {
    redirect(firstAllowedRoute(session));
  }
  const companies = await listCompanies(session.user.id, true);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="companies"
      title="Multi-Empresas (Master)"
      subtitle="Cadastre empresas com CNPJ único, defina Nome e E-mail do responsável e envie o link de acesso por e-mail."
    >
      <CompaniesView
        activeTenantId={session.tenant.id}
        activeTenantName={session.tenant.name}
        companies={companies}
      />
    </AdminShell>
  );
}
