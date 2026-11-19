import "server-only";
import { cookies, headers } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth/session";

const BASE_URL = (process.env.API_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const TIMEOUT_MS = 10_000;

export async function apiFetch(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Response> {
  const [store, incoming] = await Promise.all([cookies(), headers()]);
  const token = store.get(COOKIE_NAME)?.value;
  const forwarded = incoming.get("x-forwarded-for");

  const requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (forwarded) requestHeaders["X-Forwarded-For"] = forwarded;

  return fetch(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: requestHeaders,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}
