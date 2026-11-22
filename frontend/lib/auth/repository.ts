import "server-only";
import { getPool } from "@/lib/db/pool";

export type AIPlanKey = "free" | "standard" | "premium";
export type ContextMode = "master" | "partner" | "tenant";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isMaster: boolean;
  isPartner: boolean;
  partnerTenantId: string;
  partnerTenantName: string;
  partnerFeatures: Record<string, boolean>;
  partnerMaxCompanies: number;
  totpConfigured: boolean;
}

export interface SessionTenant {
  id: string;
  name: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
  isPartner: boolean;
  parentPartnerTenantId: string;
  hasOpenrouterToken: boolean;
  aiPlanKey: AIPlanKey;
  aiMonthlyMessageLimit: number;
  aiCreditDepleted: boolean;
  aiCreditDepletedFrom: string;
}

export interface SessionRole {
  id: string;
  key: string;
  name: string;
  permissions: Record<string, boolean>;
}

export interface SessionContext {
  contextMode: ContextMode;
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
  "ai_chat:use": true,
  "access:manage": true,
};

const EMPTY_TENANT: SessionTenant = {
  id: "",
  name: "",
  cnpj: "",
  ownerName: "",
  ownerEmail: "",
  active: false,
  isPartner: false,
  parentPartnerTenantId: "",
  hasOpenrouterToken: false,
  aiPlanKey: "free",
  aiMonthlyMessageLimit: 0,
  aiCreditDepleted: false,
  aiCreditDepletedFrom: "",
};

export async function findSession(tokenHash: string): Promise<SessionContext | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    context_mode: string;
    user_id: string;
    user_name: string;
    user_email: string;
    is_master: boolean;
    user_blocked: boolean;
    totp_configured_at: string | null;
    tenant_id: string;
    tenant_name: string;
    tenant_cnpj: string;
    owner_name: string;
    owner_email: string;
    tenant_active: boolean;
    tenant_is_partner: boolean;
    parent_partner_tenant_id: string;
    has_openrouter_token: boolean;
    ai_plan_key: string;
    ai_monthly_message_limit: number;
    ai_credit_depleted: boolean;
    ai_credit_depleted_from: string;
    role_id: string | null;
    role_key: string | null;
    role_name: string | null;
    role_permissions: Record<string, boolean> | null;
  }>(
    `SELECT COALESCE(s.context_mode, CASE WHEN s.active_tenant_id IS NULL THEN 'master' ELSE 'tenant' END) AS context_mode,
            u.id AS user_id, u.name AS user_name, u.email AS user_email,
            u.is_master, COALESCE(u.blocked, false) AS user_blocked, u.totp_configured_at,
            COALESCE(t.id::text, '') AS tenant_id,
            COALESCE(t.name, '') AS tenant_name,
            COALESCE(t.cnpj, '') AS tenant_cnpj,
            COALESCE(t.owner_name, '') AS owner_name,
            COALESCE(t.owner_email, '') AS owner_email,
            COALESCE(t.active, false) AS tenant_active,
            COALESCE(t.is_partner, false) AS tenant_is_partner,
            COALESCE(t.parent_partner_tenant_id::text, '') AS parent_partner_tenant_id,
            (COALESCE(t.openrouter_token_enc, '') <> '') AS has_openrouter_token,
            COALESCE(t.ai_plan_key, 'free') AS ai_plan_key,
            COALESCE(t.ai_monthly_message_limit, 0) AS ai_monthly_message_limit,
            (t.ai_credit_depleted_at IS NOT NULL) AS ai_credit_depleted,
            COALESCE(t.ai_credit_depleted_from, '') AS ai_credit_depleted_from,
            tr.id::text AS role_id, tr.key AS role_key, tr.name AS role_name,
            tr.permissions AS role_permissions
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN tenants t ON t.id = s.active_tenant_id
       LEFT JOIN tenant_memberships tm ON tm.tenant_id = t.id AND tm.user_id = u.id
       LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row || row.user_blocked) return null;

  let isPartner = false;
  let partnerTenantId = "";
  let partnerTenantName = "";
  let partnerFeatures: Record<string, boolean> = {};
  let partnerMaxCompanies = 0;

  if (!row.is_master) {
    try {
      const partnerRes = await pool.query<{
        id: string;
        name: string;
        partner_features: Record<string, boolean> | null;
        partner_max_companies: number;
      }>(
        `SELECT pt.id::text AS id, pt.name, pt.partner_features, COALESCE(pt.partner_max_companies, 0) AS partner_max_companies
           FROM tenants pt
          WHERE pt.owner_user_id = $1
            AND pt.active = true
            AND pt.is_partner = true
          ORDER BY pt.partner_enabled_at ASC NULLS LAST, pt.created_at ASC
          LIMIT 1`,
        [row.user_id],
      );
      if (partnerRes.rows[0]) {
        isPartner = true;
        partnerTenantId = partnerRes.rows[0].id;
        partnerTenantName = partnerRes.rows[0].name;
        partnerFeatures = partnerRes.rows[0].partner_features ?? {};
        partnerMaxCompanies = Number(partnerRes.rows[0].partner_max_companies || 0);
      }
    } catch {
      // ignore if migration still bootstrapping
    }
  }

  const user: SessionUser = {
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    isMaster: row.is_master,
    isPartner,
    partnerTenantId,
    partnerTenantName,
    partnerFeatures,
    partnerMaxCompanies,
    totpConfigured: Boolean(row.totp_configured_at),
  };

  const tenant: SessionTenant = row.tenant_id
    ? {
        id: row.tenant_id,
        name: row.tenant_name,
        cnpj: row.tenant_cnpj,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        active: row.tenant_active,
        isPartner: Boolean(row.tenant_is_partner),
        parentPartnerTenantId: row.parent_partner_tenant_id || "",
        hasOpenrouterToken: Boolean(row.has_openrouter_token),
        aiPlanKey:
          row.ai_plan_key === "standard" || row.ai_plan_key === "premium"
            ? row.ai_plan_key
            : "free",
        aiMonthlyMessageLimit: Number(row.ai_monthly_message_limit || 0),
        aiCreditDepleted: Boolean(row.ai_credit_depleted),
        aiCreditDepletedFrom: row.ai_credit_depleted_from || "",
      }
    : EMPTY_TENANT;

  if (row.is_master) {
    return {
      contextMode: row.tenant_id ? "tenant" : "master",
      user,
      tenant,
      role: {
        id: "master",
        key: "master",
        name: "Master",
        permissions: ALL_PERMISSIONS_TRUE,
      },
    };
  }

  if (row.context_mode === "master") {
    return null;
  }

  if (row.context_mode === "partner") {
    if (!isPartner) return null;
    return {
      contextMode: "partner",
      user,
      tenant: EMPTY_TENANT,
      role: {
        id: "partner",
        key: "partner",
        name: "Parceiro",
        permissions: {},
      },
    };
  }

  if (!row.tenant_id) return null;

  // Dono Parceiro inspecionando uma empresa da sua carteira ("Ver sistema")
  if (
    isPartner &&
    tenant.parentPartnerTenantId &&
    tenant.parentPartnerTenantId === partnerTenantId &&
    partnerFeatures["companies:impersonate"]
  ) {
    return {
      contextMode: "tenant",
      user,
      tenant,
      role: {
        id: "partner_admin",
        key: "owner",
        name: "Parceiro (visão cliente)",
        permissions: ALL_PERMISSIONS_TRUE,
      },
    };
  }

  if (!row.tenant_active || !row.role_id || !row.role_key || !row.role_name) {
    return null;
  }

  return {
    contextMode: "tenant",
    user,
    tenant,
    role: {
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      permissions: row.role_permissions ?? {},
    },
  };
}
