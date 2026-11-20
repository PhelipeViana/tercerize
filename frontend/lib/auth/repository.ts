import "server-only";
import { getPool } from "@/lib/db/pool";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isMaster: boolean;
  totpConfigured: boolean;
}

export interface SessionTenant {
  id: string;
  name: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
}

export interface SessionRole {
  id: string;
  key: string;
  name: string;
  permissions: Record<string, boolean>;
}

export interface SessionContext {
  user: SessionUser;
  tenant: SessionTenant;
  role: SessionRole;
}

export const ALL_PERMISSIONS_TRUE: Record<string, boolean> = {
  "contracts:view": true,
  "contracts:write": true,
  "service_orders:view": true,
  "service_orders:write": true,
  "employees:view": true,
  "employees:write": true,
  "epis:view": true,
  "epis:write": true,
  "inventory:view": true,
  "inventory:write": true,
  "finance:view": true,
  "finance:write": true,
  "access:manage": true,
};

export async function findSession(tokenHash: string): Promise<SessionContext | null> {
  const { rows } = await getPool().query<{
    user_id: string;
    user_name: string;
    user_email: string;
    is_master: boolean;
    totp_configured_at: string | null;
    tenant_id: string;
    tenant_name: string;
    tenant_cnpj: string;
    owner_name: string;
    owner_email: string;
    tenant_active: boolean;
    role_id: string | null;
    role_key: string | null;
    role_name: string | null;
    role_permissions: Record<string, boolean> | null;
  }>(
    `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
            u.is_master, u.totp_configured_at,
            t.id AS tenant_id, t.name AS tenant_name, t.cnpj AS tenant_cnpj,
            COALESCE(t.owner_name, '') AS owner_name,
            COALESCE(t.owner_email, '') AS owner_email,
            t.active AS tenant_active,
            tr.id::text AS role_id, tr.key AS role_key, tr.name AS role_name,
            tr.permissions AS role_permissions
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = s.active_tenant_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id AND tm.user_id = u.id
       LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  const role: SessionRole = row.is_master
    ? {
        id: "master",
        key: "master",
        name: "Master",
        permissions: ALL_PERMISSIONS_TRUE,
      }
    : row.role_id && row.role_key && row.role_name
      ? {
          id: row.role_id,
          key: row.role_key,
          name: row.role_name,
          permissions: row.role_permissions ?? {},
        }
      : {
          id: "",
          key: "",
          name: "",
          permissions: {},
        };

  if (!row.is_master && !role.id) {
    return null;
  }

  return {
    user: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      isMaster: row.is_master,
      totpConfigured: Boolean(row.totp_configured_at),
    },
    tenant: {
      id: row.tenant_id,
      name: row.tenant_name,
      cnpj: row.tenant_cnpj,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      active: row.tenant_active,
    },
    role,
  };
}
