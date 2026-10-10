import { describe, it, expect, afterEach, vi } from "vitest";
import { seedRfq, demoCatalog, demoBenchmarks } from "@/domain/fixtures";
import { reviewLines } from "@/domain/review";
import {
  seedProject,
  costModel,
  offerProblems,
  landedCost,
  projectCommand,
} from "@/domain/project";
import type { Workspace } from "@/domain/types";
import {
  authRequired,
  createSession,
  validSession,
  verifyPassword,
} from "@/server/session";
import { checkAccess } from "@/server/access";
import { scryptSync } from "node:crypto";
function workspace() {
  const rfq = seedRfq();
  return {
    rfq,
    lines: reviewLines(
      rfq,
      demoCatalog,
      demoBenchmarks,
      new Date().toISOString(),
    ),
  } as Workspace;
}
const w = workspace();
afterEach(() => vi.unstubAllEnvs());
describe("Manufacturing project estimates", () => {
  it("reports incomplete material coverage and preserves cents", () => {
    const p = seedProject(w);
    const m = costModel(w, p);
    expect(m.covered).toBe(2);
    expect(m.total).toBe(3);
    expect(m.materialCents).toBe(210000);
    expect(m.units).toBe(35);
    expect(Number.isSafeInteger(m.laborCents)).toBe(true);
    expect(Number.isSafeInteger(m.sellingCents)).toBe(true);
  });
  it("compares landed totals including shipping rather than unit price alone", () => {
    const p = seedProject(w);
    const [north, atlas, summit] = p.offers;
    expect(landedCost(north, 10)).toBe(107500);
    expect(landedCost(atlas, 10)).toBe(107000);
    expect(landedCost(summit, 10)).toBe(108000);
    p.selected["line-1"] = atlas.id;
    expect(costModel(w, p).materialCents).toBe(217000);
  });
  it("uses target gross margin instead of markup", () => {
    const p = seedProject(w);
    p.overheadBps = 0;
    p.marginBps = 2500;
    p.operations = [];
    expect(costModel(w, p).sellingCents).toBe(280000);
  });
  it("rejects expired, below-minimum, and unavailable offers", () => {
    const o = seedProject(w).offers[0];
    expect(offerProblems({ ...o, expires: "2000-01-01" }, 10)).toContain(
      "Offer expired",
    );
    expect(offerProblems({ ...o, minimum: 20 }, 10)).toContain("Minimum 20");
    expect(offerProblems({ ...o, available: 5 }, 10)).toContain(
      "Insufficient availability",
    );
  });
  it("does not silently reuse supplier prices after specification changes", () => {
    const p = seedProject(w);
    const o = p.offers[0];
    p.selected["line-1"] = o.id;
    const changed = workspace();
    changed.lines[0].spec.grade = "304L";
    expect(offerProblems(o, 10, undefined, changed.lines[0].spec)).toContain(
      "Specification changed; record a new offer",
    );
    expect(costModel(changed, p).materialCents).toBe(210000);
  });
  it("rejects invalid prices, runaway margins, and negative operations", () => {
    expect(
      projectCommand.safeParse({
        action: "plan",
        operations: [],
        marginBps: 10000,
        overheadBps: 0,
      }).success,
    ).toBe(false);
    expect(
      projectCommand.safeParse({
        action: "offer",
        offer: { ...seedProject(w).offers[0], unitCents: -1 },
      }).success,
    ).toBe(false);
  });
});
describe("Private hosted workspace", () => {
  function configure() {
    const salt = "test-salt";
    vi.stubEnv(
      "WORKSPACE_PASSWORD_HASH",
      salt + ":" + scryptSync("sample-passcode", salt, 64).toString("hex"),
    );
    vi.stubEnv(
      "SESSION_SECRET",
      "test-session-secret-with-at-least-32-characters",
    );
    vi.stubEnv("AUTH_REQUIRED", "true");
  }
  it("verifies a passcode and rejects a wrong one", () => {
    configure();
    expect(verifyPassword("sample-passcode")).toBe(true);
    expect(verifyPassword("wrong")).toBe(false);
  });
  it("signs sessions and rejects tampered or expired values", () => {
    configure();
    const token = createSession();
    expect(validSession(token)).toBe(true);
    expect(validSession(token + "x")).toBe(false);
    expect(validSession(undefined)).toBe(false);
  });
  it("requires a session even when the host header says localhost", () => {
    configure();
    expect(() =>
      checkAccess(
        new Request("https://app.example/api/rfqs", {
          headers: { host: "localhost" },
        }),
      ),
    ).toThrow("Sign in");
  });
  it("allows an authenticated same-origin call and rejects cross-site changes", () => {
    configure();
    const cookie = "quoteguard_session=" + createSession();
    expect(() =>
      checkAccess(
        new Request("https://app.example/api/rfqs", {
          headers: { host: "app.example", cookie },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkAccess(
        new Request("https://app.example/api/rfqs", {
          method: "POST",
          headers: {
            host: "app.example",
            cookie,
            origin: "https://other.example",
          },
        }),
      ),
    ).toThrow("Cross-origin");
  });
  it("fails closed on hosted deployments without auth configuration", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("WORKSPACE_PASSWORD_HASH", "");
    expect(authRequired()).toBe(true);
    expect(() =>
      checkAccess(
        new Request("https://app.example/api/rfqs", {
          headers: { host: "app.example" },
        }),
      ),
    ).toThrow("not configured");
  });
});
