import { cookies, headers } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_URL = (process.env.API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

export async function POST(req: Request): Promise<Response> {
  const [store, incoming] = await Promise.all([cookies(), headers()]);
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ message: "Sessão expirada. Faça login novamente." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bodyText = await req.text();
  const forwarded = incoming.get("x-forwarded-for");
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Authorization: `Bearer ${token}`,
  };
  if (forwarded) reqHeaders["X-Forwarded-For"] = forwarded;

  try {
    const upstream = await fetch(`${BASE_URL}/api/ai/chat/stream`, {
      method: "POST",
      headers: reqHeaders,
      body: bodyText,
      cache: "no-store",
      signal: req.signal,
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.includes("text/event-stream") || !upstream.body) {
      const errBody = await upstream.text().catch(() => "");
      return new Response(
        errBody || JSON.stringify({ message: "Não foi possível iniciar a resposta em tempo real." }),
        {
          status: upstream.ok ? 502 : upstream.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(JSON.stringify({ message: "Servidor de IA indisponível no momento." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
