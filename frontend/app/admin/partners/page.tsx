import { redirect } from "next/navigation";
import { PartnersView } from "@/components/modules/partners-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/operations/repository";

export default async function PartnersPage() {
  const session = await requireSession();
  if (!session.user.isMaster) {
    redirect(firstAllowedRoute(session));
  }

  const companies = await listCompanies(session.user.id, true);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="partners"
      title="Parceiros"
      subtitle="Aba exclusiva Admin Master para cadastrar, promover e liberar recursos para empresas parceiras."
      hideHeader
    >
      <PartnersView companies={companies} />
    </AdminShell>
  );
}
