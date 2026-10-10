import { NextRequest, NextResponse } from "next/server";
import {
  authConfigured,
  authRequired,
  createSession,
  loginRateKey,
  SESSION_COOKIE,
  verifyPassword,
} from "@/server/session";
import { checkOrigin, AppError } from "@/server/access";
import { db } from "@/server/db";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const raw = await req.text();
    if (raw.length > 1024)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const body = JSON.parse(raw);
    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: !!process.env.VERCEL,
        sameSite: "strict",
      });
      return res;
    }
    if (!authRequired()) return NextResponse.json({ ok: true });
    if (!authConfigured())
      return NextResponse.json(
        { error: "Workspace setup is incomplete." },
        { status: 503 },
      );
    if (typeof body.password !== "string" || body.password.length > 512)
      return NextResponse.json(
        { error: "Enter your workspace passcode." },
        { status: 422 },
      );
    const key = loginRateKey(req),
      bucket = Math.floor(Date.now() / 600000);
    await db.$transaction(async (tx) => {
      const existing = await tx.setting.findUnique({ where: { id: key } });
      const value = existing ? JSON.parse(existing.data) : { bucket, count: 0 };
      const count = value.bucket === bucket ? value.count : 0;
      if (count >= 10)
        throw new AppError(
          429,
          "RATE",
          "Too many attempts. Try again in ten minutes.",
        );
      const data = JSON.stringify({ bucket, count: count + 1 });
      if (existing) {
        const result = await tx.setting.updateMany({
          where: { id: key, data: existing.data },
          data: { data },
        });
        if (result.count !== 1)
          throw new AppError(
            429,
            "RATE",
            "Another sign-in is in progress. Try again.",
          );
      } else await tx.setting.create({ data: { id: key, data } });
    });
    if (!verifyPassword(body.password))
      return NextResponse.json(
        { error: "That passcode does not match." },
        { status: 401 },
      );
    const res = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    res.cookies.set(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      secure: !!process.env.VERCEL || req.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 14 * 86400,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AppError ? e.message : "Sign-in could not be completed.",
      },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}
