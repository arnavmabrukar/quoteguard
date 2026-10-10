import {
  scenarios,
  categories,
  referenceTime,
  suiteVersion,
  type Category,
} from "./cases";
import { extractDemo } from "../extract-demo";
import {
  demoCatalog,
  demoBenchmarks,
  demoEvidence,
  seedRfq,
} from "../fixtures";
import { reviewLines, approvalBlockers } from "../review";
import { checkInput } from "../guardrail";

export type CheckResult = {
  category: Category;
  field: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
};
export type CaseResult = {
  id: string;
  title: string;
  input: string;
  passed: boolean;
  durationMs: number;
  checks: CheckResult[];
  output: unknown;
  error: string | null;
};
export type EvaluationReport = {
  id: string;
  suiteVersion: string;
  datasetHash: string;
  codeRevision: string;
  ranAt: string;
  referenceTime: string;
  evaluator: "QuoteGuard deterministic checks";
  dataSource: "QuoteGuard-authored synthetic fixtures";
  summary: {
    cases: number;
    passed: number;
    failed: number;
    checks: number;
    checksPassed: number;
    checkPassRate: number;
    p95Ms: number;
  };
  metrics: {
    category: Category;
    passed: number;
    total: number;
    rate: number;
  }[];
  results: CaseResult[];
};
function valueAt(value: unknown, path: string): unknown {
  return (
    path
      .split(".")
      .reduce<unknown>(
        (v, k) =>
          v && typeof v === "object"
            ? (v as Record<string, unknown>)[k]
            : undefined,
        value,
      ) ?? null
  );
}
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aKeys = Object.keys(a),
    bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (k) =>
        Object.hasOwn(b, k) &&
        equal(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  );
}
const rate = (passed: number, total: number) =>
  total ? Math.round((passed / total) * 1000) / 10 : 0;
export function runEvaluation(
  metadata: Pick<EvaluationReport, "id" | "datasetHash" | "codeRevision">,
): EvaluationReport {
  const results = scenarios.map<CaseResult>((scenario) => {
    const start = performance.now();
    let output: unknown = null;
    let error: string | null = null;
    try {
      const rfq = seedRfq(referenceTime);
      rfq.original = scenario.input;
      rfq.lines = extractDemo(scenario.input);
      rfq.guardrail = checkInput(scenario.input);
      const catalog = structuredClone(demoCatalog);
      const benchmarks = structuredClone(demoBenchmarks);
      if (scenario.setup?.benchmark === "stale")
        benchmarks.forEach((b) => (b.observed = "2025-01-01"));
      if (scenario.setup?.benchmark === "future")
        benchmarks.forEach((b) => (b.observed = "2027-01-01"));
      if (scenario.setup?.benchmark === "wrong-unit")
        benchmarks.forEach((b) => (b.unit = "kg"));
      // Match the application's demo import, which attaches catalog records.
      const initial = reviewLines(rfq, catalog, benchmarks, referenceTime);
      rfq.lines.forEach((line, index) => {
        const item = initial[index].match;
        line.evidence = structuredClone(item?.evidence || []);
        line.reviewConfirmed = scenario.setup?.reviewed || false;
        if (!item) return;
        switch (scenario.setup?.evidence) {
          case "missing":
            line.evidence = [];
            break;
          case "unreviewed":
            line.evidence = [demoEvidence(item.sku, item.lot, null, false)];
            break;
          case "wrong-lot":
            line.evidence = [demoEvidence(item.sku, "WRONG-LOT", null, true)];
            break;
          case "wrong-origin":
            line.evidence = [demoEvidence(item.sku, item.lot, "CA", true)];
            break;
        }
      });
      const lines = reviewLines(rfq, catalog, benchmarks, referenceTime);
      output = {
        lineCount: lines.length,
        guardrailPassed: rfq.guardrail.passed,
        approvalBlocked: approvalBlockers(rfq, lines, false).length > 0,
        lines: lines.map((l) => ({
          spec: l.spec,
          sku: l.match?.sku || null,
          status: l.status,
          unitPriceCents: l.unitPriceCents,
          subtotalCents: l.subtotalCents,
          benchmark: l.benchmark,
          requirements: Object.fromEntries(
            l.requirements.map((r) => [r.name, r.status]),
          ),
          blockers: l.blockers,
        })),
      };
    } catch (e) {
      error = e instanceof Error ? e.message : "Scenario failed to execute";
    }
    const checks = scenario.checks.map((c) => ({
      ...c,
      actual: valueAt(output, c.field),
      passed: !error && equal(valueAt(output, c.field), c.expected),
    }));
    return {
      id: scenario.id,
      title: scenario.title,
      input: scenario.input,
      checks,
      output,
      error,
      passed: checks.every((c) => c.passed),
      durationMs: Math.round((performance.now() - start) * 1000) / 1000,
    };
  });
  const checks = results.flatMap((r) => r.checks);
  const timings = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const passed = results.filter((r) => r.passed).length;
  const checksPassed = checks.filter((c) => c.passed).length;
  return {
    ...metadata,
    suiteVersion,
    ranAt: new Date().toISOString(),
    referenceTime,
    evaluator: "QuoteGuard deterministic checks",
    dataSource: "QuoteGuard-authored synthetic fixtures",
    summary: {
      cases: results.length,
      passed,
      failed: results.length - passed,
      checks: checks.length,
      checksPassed,
      checkPassRate: rate(checksPassed, checks.length),
      p95Ms: timings[Math.ceil(timings.length * 0.95) - 1] || 0,
    },
    metrics: categories.map((category) => {
      const group = checks.filter((c) => c.category === category);
      const passed = group.filter((c) => c.passed).length;
      return {
        category,
        passed,
        total: group.length,
        rate: rate(passed, group.length),
      };
    }),
    results,
  };
}
