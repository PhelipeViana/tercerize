import "server-only";
import { getPool } from "@/lib/db/pool";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "developer" | "admin" | "operator";
}

export interface SessionTenant {
  id: string;
  name: string;
  cnpj: string;
  active: boolean;
}

export interface SessionContext {
  user: SessionUser;
  tenant: SessionTenant;
}

export async function findSession(tokenHash: string): Promise<SessionContext | null> {
  const { rows } = await getPool().query<{
    user_id: string;
    user_name: string;
    user_email: string;
    user_role: "developer" | "admin" | "operator";
    tenant_id: string;
    tenant_name: string;
    tenant_cnpj: string;
    tenant_active: boolean;
  }>(
    `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role,
            t.id AS tenant_id, t.name AS tenant_name, t.cnpj AS tenant_cnpj, t.active AS tenant_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = s.active_tenant_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    user: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      role: row.user_role,
    },
    tenant: {
      id: row.tenant_id,
      name: row.tenant_name,
      cnpj: row.tenant_cnpj,
      active: row.tenant_active,
    },
  };
}
