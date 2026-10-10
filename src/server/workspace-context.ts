import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { publicDemo } from "./session";

export const DEMO_COOKIE = "quoteguard_demo";
const lifetime = 30 * 86400;
const context = new AsyncLocalStorage<string>();
export const workspaceScope = () => context.getStore();
export const runInWorkspace = <T>(scope: string, work: () => T): T =>
  context.run(scope, work);

export function demoConfigured() {
  return (process.env.SESSION_SECRET?.length || 0) >= 32;
}

export function createDemoSession() {
  if (!demoConfigured()) throw new Error("Demo workspace is not configured.");
  const workspaceId = randomUUID();
  const payload = Buffer.from(
    JSON.stringify({
      purpose: "demo",
      workspaceId,
      expires: Date.now() + lifetime * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("base64url");
  return { workspaceId, token: `${payload}.${signature}` };
}

export function readDemoSession(token: string | undefined): string | undefined {
  if (!token || !demoConfigured()) return;
  try {
    const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length) return;
    const expected = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      data.purpose !== "demo" ||
      typeof data.workspaceId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        data.workspaceId,
      ) ||
      !Number.isSafeInteger(data.expires) ||
      data.expires <= Date.now() ||
      data.expires > Date.now() + lifetime * 1000
    )
      return;
    return data.workspaceId;
  } catch {
    return;
  }
}

export async function withWorkspace(
  request: NextRequest,
  work: () => Promise<Response>,
): Promise<Response> {
  if (!publicDemo()) return work();
  if (!demoConfigured())
    return NextResponse.json(
      {
        error: { code: "SETUP", message: "Demo workspace is not configured." },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const existing = readDemoSession(request.cookies.get(DEMO_COOKIE)?.value);
  const session = existing ? null : createDemoSession();
  const response = await runInWorkspace(existing || session!.workspaceId, work);
  if (session) {
    const secure =
      !!process.env.VERCEL || request.nextUrl.protocol === "https:";
    response.headers.append(
      "Set-Cookie",
      `${DEMO_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime}${secure ? "; Secure" : ""}`,
    );
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
