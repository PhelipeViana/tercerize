import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { findSession, type SessionContext } from "./repository";

export const COOKIE_NAME = "tercerize_session";

const SECURE = process.env.COOKIE_SECURE === "true";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSession(): Promise<SessionContext | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return findSession(hashToken(token));
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
