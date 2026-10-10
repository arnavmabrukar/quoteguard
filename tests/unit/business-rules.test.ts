import { describe, it, expect } from "vitest";
import {
  seedRfq,
  demoCatalog,
  demoBenchmarks,
  demoEvidence,
  sampleReply,
  edgeFixtures,
} from "@/domain/fixtures";
import { reviewLines, approvalBlockers, buildQuote } from "@/domain/review";
import { calculatePrice } from "@/domain/calculate-price";
import { dimensionMicrons, catalogCandidates } from "@/domain/match-catalog";
import { compareBenchmark } from "@/domain/compare-benchmark";
import { parseSpec, extractDemo } from "@/domain/extract-demo";
import { checkInput } from "@/domain/guardrail";
import { checkRequirements } from "@/domain/check-requirements";
import { quoteCsv, csvCell } from "@/server/services/export-quote";
import { mutationSchema, extractionSchema } from "@/contracts/rfq";
const now = "2026-10-10T16:00:00Z";
const review = (rfq = seedRfq()) =>
  reviewLines(rfq, demoCatalog, demoBenchmarks, now);
describe("Specification and catalog rules", () => {
  it("matches the exact 304 product and calculates the expected $1,200 subtotal", () => {
    const l = review()[0];
    expect(l.match?.sku).toBe("SS-304-060-2B");
    expect(l.unitPriceCents).toBe(12000);
    expect(l.subtotalCents).toBe(120000);
    expect(l.status).toBe("Ready for review");
  });
  it("never interprets gauge or 4x8 as explicit dimensions", () => {
    const l = review()[1];
    expect(l.spec.thickness).toBeNull();
    expect(l.spec.width).toBeNull();
    expect(l.spec.length).toBeNull();
    expect(l.match).toBeNull();
    expect(l.subtotalCents).toBeNull();
    expect(l.status).toBe("Needs clarification");
  });
  it("matches a buyer-confirmed explicit specification", () => {
    const r = seedRfq();
    r.lines[1].spec = parseSpec(sampleReply);
    r.lines[1].evidence = demoCatalog[0].evidence;
    expect(review(r)[1].match?.sku).toBe("SS-304-060-2B");
    expect(review(r)[1].subtotalCents).toBe(240000);
  });
  it("does not equate 304 and 304L", () => {
    const line = seedRfq().lines[0];
    expect(
      catalogCandidates(line, demoCatalog).find((c) => c.item.grade === "304L")
        ?.exact,
    ).toBe(false);
  });
  it("converts only explicitly provided units", () => {
    expect(dimensionMicrons({ value: 1, unit: "in" })).toBe(
      dimensionMicrons({ value: 25.4, unit: "mm" }),
    );
    expect(dimensionMicrons(null)).toBeNull();
  });
  it("does not silently substitute a near thickness", () => {
    const r = seedRfq();
    r.lines[0].spec.thickness = { value: 0.061, unit: "in" };
    expect(review(r)[0].status).toBe("No catalog match");
    expect(review(r)[0].unitPriceCents).toBeNull();
  });
  it("does not introduce an implicit rounding tolerance", () => {
    const r = seedRfq();
    r.lines[0].spec.thickness = { value: 0.060001, unit: "in" };
    expect(review(r)[0].status).toBe("No catalog match");
  });
  it("does not mistake a material grade for a quantity", () => {
    expect(
      parseSpec(
        "10 sheets, stainless 304 sheet, 0.060 in × 48 in × 96 in, 2B finish",
      ).quantity,
    ).toBe(10);
    expect(
      extractDemo(
        "10 sheets, stainless 304 sheet, 0.060 in × 48 in × 96 in, 2B finish",
      )[0].issues,
    ).toEqual([]);
  });
  it("accounts for aggregate demand across repeated SKUs", () => {
    const r = seedRfq();
    r.lines[1].spec = { ...structuredClone(r.lines[0].spec), quantity: 75 };
    expect(review(r)[0].blockers.join()).toContain("Combined demand is 85");
    expect(review(r)[1].status).toBe("No catalog match");
  });
  it("holds conflicting quantities for confirmation", () => {
    const lines = extractDemo(edgeFixtures["Conflicting quantities"]);
    expect(lines[0].spec.quantity).toBeNull();
    expect(lines[0].issues).toContain("conflicting quantities");
  });
});
describe("Evidence and approval", () => {
  it("blocks missing MTR and origin evidence", () => {
    const l = review()[2];
    expect(l.status).toBe("Awaiting supplier evidence");
    expect(l.requirements.filter((r) => r.status === "Missing")).toHaveLength(
      3,
    );
  });
  it("requires a human to review an attached record", () => {
    const r = seedRfq();
    r.lines[2].evidence = [
      demoEvidence(demoCatalog[1].sku, demoCatalog[1].lot, "US"),
    ];
    expect(review(r)[2].status).toBe("Awaiting supplier evidence");
    r.lines[2].evidence[0].reviewed = true;
    expect(review(r)[2].status).toBe("Ready for review");
  });
  it("rejects records for a different lot", () => {
    const r = seedRfq();
    r.lines[0].evidence[0].lot = "WRONG-LOT";
    expect(checkRequirements(r.lines[0], demoCatalog[0])[0].status).toBe(
      "Missing",
    );
  });
  it("rejects conflicting origin records", () => {
    const r = seedRfq();
    r.lines[2].evidence = [
      demoEvidence(demoCatalog[1].sku, demoCatalog[1].lot, "CA", true),
    ];
    expect(checkRequirements(r.lines[2], demoCatalog[1])[2].status).toBe(
      "Conflicting",
    );
  });
  it("requires explicit match, pricing, and evidence review", () => {
    const r = seedRfq();
    r.lines = r.lines.slice(0, 1);
    expect(approvalBlockers(r, review(r), false)[0]).toContain(
      "confirm the match",
    );
    r.lines[0].reviewConfirmed = true;
    expect(approvalBlockers(r, review(r), false)).toEqual([]);
  });
  it.each(["Unavailable", "Pending", "Failed", "Not run"] as const)(
    "never treats %s PRISM evaluation as a pass",
    (state) => {
      const r = seedRfq();
      r.lines = r.lines.slice(0, 1);
      r.lines[0].reviewConfirmed = true;
      r.prism.evaluation = state;
      expect(approvalBlockers(r, review(r), true).join()).toContain("PRISM");
    },
  );
  it("rejects a stale passed evaluation", () => {
    const r = seedRfq();
    r.lines = r.lines.slice(0, 1);
    r.lines[0].reviewConfirmed = true;
    r.prism.evaluation = "Passed";
    r.prism.evaluatedRevision = 0;
    expect(approvalBlockers(r, review(r), true)).toHaveLength(1);
  });
  it("requires at least one included line", () => {
    const r = seedRfq();
    r.lines.forEach((l) => (l.excluded = "Unavailable from supplier"));
    expect(approvalBlockers(r, review(r), false)).toContain(
      "Include at least one line item.",
    );
  });
});
describe("Pricing, benchmarks and customer exports", () => {
  it("rounds half-up in integer minor units", () => {
    expect(calculatePrice(101, 5000, 10)).toEqual({
      unitPriceCents: 152,
      subtotalCents: 1520,
    });
  });
  it("updates derived prices for quantity and markup", () => {
    const r = seedRfq();
    r.markupBps = 2500;
    r.lines[0].spec.quantity = 12;
    expect(review(r)[0].subtotalCents).toBe(150000);
  });
  it("rejects fractional quantities and negative costs", () => {
    expect(() => calculatePrice(10000, 2000, 1.5)).toThrow();
    expect(() => calculatePrice(-1, 2000, 2)).toThrow();
  });
  it("compares a matching reference at 7.7% below", () => {
    expect(review()[0].benchmark.difference).toBe(-7.7);
  });
  it("does not claim competitiveness for an unmatched quantity tier or stale reference", () => {
    expect(review()[2].benchmark.available).toBe(false);
    expect(
      compareBenchmark("SS-304-060-2B", 10, 12000, demoBenchmarks, "2027-10-10")
        .available,
    ).toBe(false);
  });
  it("exports only allowlisted customer data and labels an incomplete quote as draft", () => {
    const r = seedRfq();
    const q = buildQuote(r, review(r), now);
    const csv = quoteCsv(q);
    expect(csv).toContain("DRAFT");
    expect(csv).toContain("Priced subtotal");
    expect(csv).toContain("UNRESOLVED");
    expect(csv).not.toMatch(/costCents|markup|supplier cost|trace|provenance/i);
    expect(JSON.stringify(q)).not.toMatch(
      /costCents|markupBps|provenance|traceId/,
    );
  });
  it("discloses exclusions on partial quotes", () => {
    const r = seedRfq();
    r.lines[1].excluded = "Buyer will source separately";
    const q = buildQuote(r, review(r), now);
    expect(q.partial).toBe(true);
    expect(q.exclusions[0].reason).toBe("Buyer will source separately");
    expect(q.lines).toHaveLength(2);
    expect(quoteCsv(q)).toContain("EXCLUDED");
  });
  it("neutralizes spreadsheet formula injection", () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  });
});
describe("Input and schema boundaries", () => {
  it("embedded document instructions cannot set policy or approve a quote", () => {
    const guard = checkInput(edgeFixtures["Embedded instructions"]);
    expect(guard.passed).toBe(false);
    const r = seedRfq();
    r.guardrail = guard;
    r.lines = r.lines.slice(0, 1);
    r.lines[0].reviewConfirmed = true;
    expect(r.markupBps).toBe(2000);
    expect(approvalBlockers(r, review(r), false).length).toBeGreaterThan(0);
  });
  it("rejects malformed model responses", () => {
    expect(
      extractionSchema.safeParse({ confidence: 0.99, status: "Approved" })
        .success,
    ).toBe(false);
  });
  it("rejects direct status changes and unconfirmed approval", () => {
    expect(
      mutationSchema.safeParse({ action: "status", status: "Approved" })
        .success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        action: "approve",
        expectedRevision: 1,
        idempotencyKey: crypto.randomUUID(),
        reviewer: "A",
        confirmed: false,
      }).success,
    ).toBe(false);
  });
});
