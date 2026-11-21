import { redirect } from "next/navigation";
import { PermissionsView } from "@/components/modules/permissions-view";
import { AdminShell } from "@/components/shell/admin-shell";
import { canManageAccess, firstAllowedRoute, requireSession } from "@/lib/auth/dal";
import { listCompanies, listTenantMembers, listTenantRoles } from "@/lib/operations/repository";

export default async function PermissionsPage() {
  const session = await requireSession();
  if (!session.tenant.id) {
    redirect(session.user.isMaster ? "/admin/companies" : "/login");
  }
  if (!canManageAccess(session)) {
    redirect(firstAllowedRoute(session));
  }

  const [companies, roles, members] = await Promise.all([
    listCompanies(session.user.id, session.user.isMaster),
    listTenantRoles(session.tenant.id),
    listTenantMembers(session.tenant.id),
  ]);

  return (
    <AdminShell
      session={session}
      companies={companies}
      current="permissions"
      title="Roles e permissões"
      subtitle="Gerencie funções, matriz de permissões e subpermissões da empresa ativa."
      hideHeader
    >
      <PermissionsView
        tenantName={session.tenant.name}
        ownerName={session.tenant.ownerName}
        ownerEmail={session.tenant.ownerEmail}
        currentUserId={session.user.id}
        isMaster={session.user.isMaster}
        roles={roles}
        members={members}
      />
    </AdminShell>
  );
}
