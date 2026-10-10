import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDemoSession,
  readDemoSession,
  runInWorkspace,
  workspaceScope,
} from "@/server/workspace-context";
import { authRequired, createSession, validSession } from "@/server/session";
import { checkAccess } from "@/server/access";
import { logicalResult, scopeQueryArgs } from "@/server/workspace-keys";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function configure() {
  vi.stubEnv("PUBLIC_DEMO", "true");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("WORKSPACE_PASSWORD_HASH", "test:hash");
  vi.stubEnv(
    "SESSION_SECRET",
    "public-demo-test-secret-with-at-least-32-characters",
  );
}
describe("Browser demo workspaces", () => {
  it("opens without owner authentication but requires a scoped request", () => {
    configure();
    expect(authRequired()).toBe(false);
    const req = new Request("https://app.example/api/rfqs", {
      headers: { host: "app.example" },
    });
    expect(() => checkAccess(req)).toThrow("not configured");
    expect(() => runInWorkspace("test", () => checkAccess(req))).not.toThrow();
    expect(workspaceScope()).toBeUndefined();
  });
  it("signs distinct workspace cookies and rejects tampering, expiry, and owner tokens", () => {
    configure();
    const first = createDemoSession(),
      second = createDemoSession();
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(readDemoSession(first.token)).toBe(first.workspaceId);
    expect(readDemoSession(first.token + "x")).toBeUndefined();
    expect(readDemoSession(createSession())).toBeUndefined();
    expect(validSession(first.token)).toBe(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 86400000);
    expect(readDemoSession(first.token)).toBeUndefined();
  });
  it("fails closed without a signing secret and retains origin checks", () => {
    configure();
    expect(() =>
      runInWorkspace("test", () =>
        checkAccess(
          new Request("https://app.example/api/rfqs", {
            method: "POST",
            headers: { host: "app.example", origin: "https://other.example" },
          }),
        ),
      ),
    ).toThrow("Cross-origin");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => createDemoSession()).toThrow("not configured");
  });
  it("keeps simultaneous asynchronous request contexts separate", async () => {
    const result = await Promise.all(
      ["one", "two"].map((scope) =>
        runInWorkspace(scope, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return workspaceScope();
        }),
      ),
    );
    expect(result).toEqual(["one", "two"]);
  });
});
describe("Workspace database namespaces", () => {
  it("scopes unfiltered lists and bulk mutations without changing ordering", () => {
    expect(
      scopeQueryArgs({ orderBy: { id: "desc" } }, "Rfq", "findMany", "a:"),
    ).toEqual({
      orderBy: { id: "desc" },
      where: { AND: [{}, { id: { startsWith: "a:" } }] },
    });
    expect(
      scopeQueryArgs(
        { where: { sku: { in: ["one", "two"] } } },
        "CatalogItem",
        "deleteMany",
        "b:",
      ),
    ).toEqual({
      where: {
        AND: [
          { sku: { in: ["b:one", "b:two"] } },
          { sku: { startsWith: "b:" } },
        ],
      },
    });
  });
  it("namespaces nested foreign keys, compound selectors, and idempotency keys", () => {
    const args = {
      where: { rfqId_revision: { rfqId: "RFQ-1042", revision: 2 } },
      data: {
        id: "quote",
        rfqId: "RFQ-1042",
        idempotencyKey: "request",
        approval: { create: { id: "approval" } },
        snapshot: '{"id":"quote"}',
      },
    };
    const encoded = scopeQueryArgs(args, "QuoteVersion", "update", "a:");
    expect(encoded).toMatchObject({
      where: { rfqId_revision: { rfqId: "a:RFQ-1042" } },
      data: {
        id: "a:quote",
        rfqId: "a:RFQ-1042",
        idempotencyKey: "a:request",
        approval: { create: { id: "a:approval" } },
        snapshot: args.data.snapshot,
      },
    });
    expect(logicalResult(encoded, "a:")).toEqual(args);
  });
  it("preserves file bytes and dates and disallows raw operations", () => {
    const value = {
      data: {
        id: "doc",
        content: Buffer.from("sample"),
        createdAt: new Date(),
      },
    };
    const encoded = scopeQueryArgs(value, "Document", "create", "a:");
    expect(logicalResult(encoded, "a:")).toEqual(value);
    expect(() => scopeQueryArgs({}, "Rfq", "findRaw", "a:")).toThrow(
      "Unsupported",
    );
  });
});
