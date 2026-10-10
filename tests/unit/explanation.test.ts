import { describe, it, expect } from "vitest";
import { demoCatalog, demoBenchmarks, seedRfq } from "@/domain/fixtures";
import { reviewLines } from "@/domain/review";
import { explanationFacts, validateExplanation } from "@/domain/explanation";
import type { Workspace } from "@/domain/types";
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
const facts = explanationFacts(w, w.lines[0]);
function answer() {
  return {
    match: {
      text: "The selected item matches the requested catalog attributes.",
      factIds: ["match.result"],
    },
    pricing: {
      text: "The proposed selling price uses a cost-plus markup.",
      factIds: ["pricing.calculation"],
    },
    evidence: {
      text: "Sample catalog fields do not certify the material or replace human review.",
      factIds: ["evidence.policy", "evidence.sample"],
    },
    alternatives: facts.alternatives.map((a) => ({
      sku: a.sku,
      text: facts.facts.find((f) => f.id === a.factId)!.text,
      factIds: [a.factId],
    })),
  };
}
describe("Source-grounded line explanations", () => {
  it("separates supplier cost, selling price, comparable reference, and synthetic evidence", () => {
    const text = facts.facts.map((f) => f.text).join(" ");
    expect(text).toContain("Supplier cost $100.00");
    expect(text).toContain("Proposed selling price $120.00");
    expect(text).toContain("sample data");
    expect(text).toContain("not supporting documents");
    expect(text).not.toContain(w.rfq.customer);
    expect(text).not.toContain(w.rfq.contact);
    expect(text).not.toContain(w.rfq.original);
    expect(() => validateExplanation(answer(), facts)).not.toThrow();
  });
  it("preserves unknown specifications and unverified competitiveness", () => {
    const missing = explanationFacts(w, w.lines[1])
      .facts.map((f) => f.text)
      .join(" ");
    expect(missing).toContain("No catalog item is selected");
    expect(missing).toContain("No proposed price");
    expect(missing).toContain("competitiveness is not verified");
    expect(missing).toContain("Unresolved checks");
  });
  it("rejects invented numbers, citations, and alternative SKUs", () => {
    const numeric = answer();
    numeric.pricing.text = "The proposed selling price is $999.00.";
    expect(() => validateExplanation(numeric, facts)).toThrow("number");
    const reference = answer();
    reference.evidence.factIds = ["pricing.calculation"];
    expect(() => validateExplanation(reference, facts)).toThrow(
      "unsupported fact",
    );
    const alternative = answer();
    alternative.alternatives[0].sku = "UNSUPPLIED";
    expect(() => validateExplanation(alternative, facts)).toThrow(
      "invented an alternative",
    );
  });
  it("rejects missing alternatives, links, HTML, and decision fields", () => {
    expect(() =>
      validateExplanation({ ...answer(), alternatives: [] }, facts),
    ).toThrow("alternatives");
    const html = answer();
    html.match.text = "<img src=x onerror=alert(1)>";
    expect(() => validateExplanation(html, facts)).toThrow();
    expect(() =>
      validateExplanation({ ...answer(), approve: true }, facts),
    ).toThrow();
  });
  it("uses aggregate demand and never treats exact alternatives as rejected", () => {
    const changed = workspace();
    changed.lines.push({
      ...changed.lines[0],
      id: "duplicate",
      spec: { ...changed.lines[0].spec, quantity: 15 },
    });
    const result = explanationFacts(changed, changed.lines[0]);
    expect(result.facts.find((f) => f.id === "match.stock")?.text).toContain(
      "combined demand 25 sheets",
    );
    const exact = changed.lines[0].candidates
      .filter((c) => c.exact)
      .map((c) => c.item.sku);
    expect(result.alternatives.some((a) => exact.includes(a.sku))).toBe(false);
  });
});
