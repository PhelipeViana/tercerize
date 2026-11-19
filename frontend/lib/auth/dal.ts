import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SessionContext } from "./repository";
import { readSession } from "./session";

export const getSession = cache(readSession);

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function redirectIfSignedIn(): Promise<void> {
  const session = await getSession();
  if (session) redirect("/admin/contracts");
}
