import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { seedRfq, demoCatalog, demoBenchmarks } from "@/domain/fixtures";
import { reviewLines } from "@/domain/review";
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  completion: vi.fn(),
  reserve: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@/server/services/workspace", () => ({
  getWorkspace: mocks.workspace,
}));
vi.mock("@/server/db", () => ({
  db: { setting: { findUnique: mocks.read, upsert: mocks.write } },
}));
vi.mock("@/server/integrations/ai-budget", () => ({
  reserveAiRequest: mocks.reserve,
}));
vi.mock("@/server/integrations/nicrron", () => ({
  nicrronConfigured: () => !!process.env.NICRRON_API_KEY,
  nicrronCompletion: mocks.completion,
}));
import {
  getExplanation,
  generateExplanation,
} from "@/server/services/explanation";
import { explanationFacts } from "@/domain/explanation";
import type { Workspace } from "@/domain/types";
let w: Workspace;
let stored: { data: string } | null;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NICRRON_API_KEY", "test-only");
  vi.stubEnv("NICRRON_MODEL", "test-model");
  const rfq = seedRfq();
  w = {
    rfq,
    lines: reviewLines(
      rfq,
      demoCatalog,
      demoBenchmarks,
      new Date().toISOString(),
    ),
  } as Workspace;
  stored = null;
  mocks.workspace.mockImplementation(async () => structuredClone(w));
  mocks.read.mockImplementation(async () => stored);
  mocks.write.mockImplementation(async (args) => {
    if (args.where.id.startsWith("explanation:"))
      stored = { data: args.create.data };
  });
  mocks.reserve.mockResolvedValue(undefined);
  mocks.completion.mockImplementation(async () => {
    const context = explanationFacts(w, w.lines[0]);
    return JSON.stringify({
      match: {
        text: "The selected item matches the requested attributes.",
        factIds: ["match.result"],
      },
      pricing: {
        text: "The selling price applies a cost-plus markup.",
        factIds: ["pricing.calculation"],
      },
      evidence: {
        text: "Sample evidence still requires human review.",
        factIds: ["evidence.sample", "evidence.policy"],
      },
      alternatives: context.alternatives.map((a) => ({
        sku: a.sku,
        text: context.facts.find((f) => f.id === a.factId)!.text,
        factIds: [a.factId],
      })),
    });
  });
});
afterEach(() => vi.unstubAllEnvs());
async function generate() {
  const view = await getExplanation(w.rfq.id, "line-1");
  return generateExplanation(w.rfq.id, "line-1", {
    expectedRevision: w.rfq.revision,
    fingerprint: view.fingerprint,
  });
}
describe("Explanation lifecycle", () => {
  it("saves a real provider response and reuses it without another billed request", async () => {
    const before = structuredClone(w);
    const first = await generate();
    expect(first.saved?.model).toBe("test-model");
    await generate();
    expect(mocks.completion).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(w).toEqual(before);
  });
  it("invalidates explanations when a price or RFQ revision changes", async () => {
    await generate();
    w.lines[0].unitPriceCents = 12500;
    expect((await getExplanation(w.rfq.id, "line-1")).saved).toBeNull();
    w.rfq.revision++;
    expect((await getExplanation(w.rfq.id, "line-1")).saved).toBeNull();
  });
  it("rejects a stale request before calling the provider", async () => {
    const view = await getExplanation(w.rfq.id, "line-1");
    w.rfq.revision++;
    await expect(
      generateExplanation(w.rfq.id, "line-1", {
        expectedRevision: 1,
        fingerprint: view.fingerprint,
      }),
    ).rejects.toThrow("changed");
    expect(mocks.completion).not.toHaveBeenCalled();
  });
  it("drops a response if the line changed while generation was in flight", async () => {
    const implementation = mocks.completion.getMockImplementation()!;
    mocks.completion.mockImplementationOnce(async () => {
      const result = await implementation();
      w.rfq.revision++;
      return result;
    });
    await expect(generate()).rejects.toThrow("changed during generation");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("reports missing credentials, provider failure, and invalid output without fixture substitution", async () => {
    vi.stubEnv("NICRRON_API_KEY", "");
    await expect(generate()).rejects.toThrow("not connected");
    vi.stubEnv("NICRRON_API_KEY", "test");
    mocks.completion.mockRejectedValueOnce(
      new Error("secret provider details"),
    );
    await expect(generate()).rejects.toThrow("could not generate");
    mocks.completion.mockResolvedValueOnce('{"approve":true}');
    await expect(generate()).rejects.toThrow("source checks");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("does not call the provider for a flagged request or exhausted allowance", async () => {
    w.rfq.guardrail.passed = false;
    await expect(generate()).rejects.toThrow("flagged");
    w.rfq.guardrail.passed = true;
    mocks.reserve.mockRejectedValueOnce(new Error("daily allowance"));
    await expect(generate()).rejects.toThrow("daily allowance");
    expect(mocks.completion).not.toHaveBeenCalled();
  });
});
