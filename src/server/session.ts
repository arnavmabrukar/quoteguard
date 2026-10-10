import "server-only";
import {
  createHmac,
  scryptSync,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";
export const SESSION_COOKIE = "quoteguard_session";
export function authRequired() {
  return (
    !!process.env.VERCEL ||
    process.env.AUTH_REQUIRED === "true" ||
    !!process.env.WORKSPACE_PASSWORD_HASH
  );
}
export function authConfigured() {
  return (
    !!process.env.WORKSPACE_PASSWORD_HASH &&
    (process.env.SESSION_SECRET?.length || 0) >= 32
  );
}
export function verifyPassword(password: string) {
  try {
    const [salt, hash] = process.env.WORKSPACE_PASSWORD_HASH!.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, 64);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
export function createSession() {
  const payload = Buffer.from(
    JSON.stringify({
      expires: Date.now() + 14 * 86400000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest("base64url")
  );
}
export function validSession(token: string | undefined) {
  if (!token || !authConfigured()) return false;
  try {
    const [payload, mac, ...extra] = token.split(".");
    if (extra.length || !payload || !mac) return false;
    const expected = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest();
    const actual = Buffer.from(mac, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      Number.isSafeInteger(data.expires) &&
      data.expires > Date.now() &&
      data.expires <= Date.now() + 14 * 86400000
    );
  } catch {
    return false;
  }
}
export function requestSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  return cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
}
export function loginRateKey(request: Request) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    : "local";
  return (
    "login:" +
    createHmac("sha256", process.env.SESSION_SECRET!).update(ip).digest("hex")
  );
}
