import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SessionContext } from "./repository";
import { readSession } from "./session";

export const getSession = cache(readSession);

export function hasPermission(session: SessionContext, perm: string): boolean {
  if (session.user.isMaster || session.role.key === "owner") return true;
  return Boolean(session.role.permissions[perm]);
}

export function canManageAccess(session: SessionContext): boolean {
  return (
    session.user.isMaster ||
    session.role.key === "owner" ||
    Boolean(session.role.permissions["access:manage"])
  );
}

export function firstAllowedRoute(session: SessionContext): string {
  const routes: Array<{ perm: string; href: string }> = [
    { perm: "contracts:view", href: "/admin/contracts" },
    { perm: "service_orders:view", href: "/admin/service-orders" },
    { perm: "employees:view", href: "/admin/employees" },
    { perm: "epis:view", href: "/admin/epis" },
    { perm: "inventory:view", href: "/admin/inventory-items" },
    { perm: "finance:view", href: "/admin/finance" },
  ];
  for (const r of routes) {
    if (hasPermission(session, r.perm)) return r.href;
  }
  if (canManageAccess(session)) return "/admin/permissions";
  return "/login";
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(perm: string): Promise<SessionContext> {
  const session = await requireSession();
  if (!hasPermission(session, perm)) {
    const fallback = firstAllowedRoute(session);
    if (fallback === "/login") redirect("/login");
    redirect(fallback);
  }
  return session;
}

export async function redirectIfSignedIn(): Promise<void> {
  const session = await getSession();
  if (session) redirect(firstAllowedRoute(session));
}
