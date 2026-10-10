import { afterEach, describe, expect, it, vi } from "vitest";
import { runEvaluation } from "@/domain/evaluation/run";
import { scenarios } from "@/domain/evaluation/cases";
import { demoCatalog, demoBenchmarks } from "@/domain/fixtures";
import * as review from "@/domain/review";
const meta = { id: "test-run", datasetHash: "test-hash", codeRevision: "test" };
afterEach(() => vi.restoreAllMocks());
describe("Software benchmark integrity", () => {
  it("reports incorrect output as a failed check and keeps it in the denominator", () => {
    const original = review.reviewLines;
    vi.spyOn(review, "reviewLines").mockImplementation((...args) =>
      original(...args).map((line) => ({ ...line, unitPriceCents: 1 })),
    );
    const report = runEvaluation(meta);
    const check = report.results
      .find((r) => r.id === "explicit-spec")!
      .checks.find((c) => c.field === "lines.0.unitPriceCents")!;
    expect(check).toMatchObject({ expected: 12000, actual: 1, passed: false });
    expect(report.summary.cases).toBe(scenarios.length);
    expect(report.summary.checks).toBe(
      scenarios.reduce((sum, c) => sum + c.checks.length, 0),
    );
    expect(
      report.metrics.find((m) => m.category === "Pricing")!.rate,
    ).toBeLessThan(100);
  });
  it("counts execution failures instead of dropping those scenarios", () => {
    vi.spyOn(review, "reviewLines").mockImplementation(() => {
      throw new Error("Injected runner failure");
    });
    const report = runEvaluation(meta);
    expect(report.summary).toMatchObject({
      passed: 0,
      failed: scenarios.length,
      checksPassed: 0,
      checkPassRate: 0,
    });
    expect(
      report.results.every((r) => r.error === "Injected runner failure"),
    ).toBe(true);
  });
  it("is repeatable and leaves shared catalog and benchmark fixtures unchanged", () => {
    const before = JSON.stringify({ demoCatalog, demoBenchmarks });
    const a = runEvaluation(meta),
      b = runEvaluation(meta);
    expect(a.results.map((r) => r.checks)).toEqual(
      b.results.map((r) => r.checks),
    );
    expect(JSON.stringify({ demoCatalog, demoBenchmarks })).toBe(before);
    expect(a.evaluator).toBe("QuoteGuard deterministic checks");
    expect(a.dataSource).toBe("QuoteGuard-authored synthetic fixtures");
  });
});
