import { redirect } from "next/navigation";
import { PartnerCompaniesView } from "@/components/modules/partner-companies-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies, listPartnerPortfolio } from "@/lib/operations/repository";

export default async function PartnerCompaniesPage() {
  const session = await requireSession();

  // Permite tanto o Dono Parceiro real quanto o Admin Master inspecionando (Ver sistema) uma empresa Parceira
  const isMasterPreviewingPartner =
    session.user.isMaster && Boolean(session.tenant.id) && session.tenant.isPartner;

  if (!session.user.isPartner && !isMasterPreviewingPartner) {
    redirect(firstAllowedRoute(session));
  }

  const targetPartnerId = isMasterPreviewingPartner
    ? session.tenant.id
    : session.user.partnerTenantId;

  const [switcherCompanies, portfolio] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster, targetPartnerId),
    listPartnerPortfolio(targetPartnerId),
  ]);

  const partnerCompany = isMasterPreviewingPartner
    ? switcherCompanies.find((c) => c.id === targetPartnerId)
    : undefined;

  const partnerTenantName = isMasterPreviewingPartner
    ? (partnerCompany?.name ?? session.tenant.name)
    : session.user.partnerTenantName;

  const partnerMaxCompanies = isMasterPreviewingPartner
    ? (partnerCompany?.partnerMaxCompanies ?? 0)
    : session.user.partnerMaxCompanies;

  const partnerFeatures = isMasterPreviewingPartner
    ? (partnerCompany?.partnerFeatures ?? {})
    : session.user.partnerFeatures;

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
        partnerTenantName={partnerTenantName}
        partnerMaxCompanies={partnerMaxCompanies}
        partnerFeatures={partnerFeatures}
        companies={portfolio}
      />
    </AdminShell>
  );
}
