import { redirect } from "next/navigation";
import { CompaniesView } from "@/components/modules/companies-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { getAIPlansDashboard } from "@/lib/ai/repository";
import { firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

export default async function CompaniesPage() {
  const session = await requireSession();
  if (!session.user.isMaster) {
    redirect(firstAllowedRoute(session));
  }
  const [companies, aiDashboard] = await Promise.all([
    listCompanies(session.user.id, true),
    getAIPlansDashboard(),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="companies"
      title="Gestão de empresas"
      subtitle="Controle exclusivo Master de empresas clientes, acessos, planos de IA e ativação."
      hideHeader
    >
      <CompaniesView companies={companies} aiDashboard={aiDashboard} />
    </AdminShell>
  );
}
