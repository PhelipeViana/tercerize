import { redirect } from "next/navigation";
import { PartnerCompaniesView } from "@/components/modules/partner-companies-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies, listPartnerPortfolio } from "@/lib/operations/repository";

export default async function PartnerCompaniesPage() {
  const session = await requireSession();
  if (!session.user.isPartner || !session.user.partnerTenantId) {
    redirect(firstAllowedRoute(session));
  }

  const [switcherCompanies, portfolio] = await Promise.all([
    listCompanies(session.user.id, false, session.user.partnerTenantId),
    listPartnerPortfolio(session.user.partnerTenantId),
  ]);

  return (
    <AdminShell
      session={session}
      companies={switcherCompanies}
      current="partner-companies"
      title="Parceiros · Empresas da carteira"
      subtitle="Cadastre e gerencie exclusivamente as empresas vinculadas à sua conta Parceira."
      hideHeader
    >
      <PartnerCompaniesView
        partnerTenantName={session.user.partnerTenantName}
        partnerMaxCompanies={session.user.partnerMaxCompanies}
        partnerFeatures={session.user.partnerFeatures}
        companies={portfolio}
      />
    </AdminShell>
  );
}
