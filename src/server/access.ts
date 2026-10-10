import "server-only";
import {
  authRequired,
  authConfigured,
  validSession,
  requestSession,
  publicDemo,
} from "./session";
import { demoConfigured, workspaceScope } from "./workspace-context";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const host = request.headers.get("host") || "";
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) throw new Error();
    } catch {
      throw new AppError(
        403,
        "ORIGIN",
        "Cross-origin requests are not allowed.",
      );
    }
  }
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError(403, "ORIGIN", "Cross-site changes are not allowed.");
}
export function checkAccess(request: Request) {
  checkOrigin(request);
  if (publicDemo()) {
    if (!demoConfigured() || !workspaceScope())
      throw new AppError(503, "SETUP", "Demo workspace is not configured.");
    return;
  }
  if (authRequired()) {
    if (!authConfigured())
      throw new AppError(
        503,
        "SETUP",
        "Workspace authentication is not configured.",
      );
    if (!validSession(requestSession(request)))
      throw new AppError(
        401,
        "AUTH",
        "Your session expired. Sign in to continue.",
      );
  } else if (
    !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
      request.headers.get("host") || "",
    )
  )
    throw new AppError(
      403,
      "LOCAL_ONLY",
      "Configure workspace authentication before accepting external connections.",
    );
}
