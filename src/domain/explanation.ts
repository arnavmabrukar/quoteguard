import { z } from "zod";
import type { LineView, Workspace } from "./types";
import { money } from "@/lib/format";

export type ExplanationFact = {
  id: string;
  section: "match" | "pricing" | "evidence" | "alternative";
  text: string;
};
const paragraph = z
  .object({
    text: z.string().trim().min(8).max(650),
    factIds: z.array(z.string().max(100)).min(1).max(16),
  })
  .strict();
export const explanationSchema = z
  .object({
    match: paragraph,
    pricing: paragraph,
    evidence: paragraph,
    alternatives: z
      .array(paragraph.extend({ sku: z.string().max(200) }).strict())
      .max(3),
  })
  .strict();
export type Explanation = z.infer<typeof explanationSchema>;
export type ExplanationRecord = {
  explanation: Explanation;
  fingerprint: string;
  generatedAt: string;
  model: string;
  revision: number;
};
export type ExplanationView = {
  configured: boolean;
  allowed: boolean;
  fingerprint: string;
  facts: ExplanationFact[];
  alternatives: { sku: string; factId: string }[];
  saved: ExplanationRecord | null;
};

export function explanationFacts(w: Workspace, line: LineView) {
  const facts: ExplanationFact[] = [];
  const add = (id: string, section: ExplanationFact["section"], text: string) =>
    facts.push({ id, section, text });
  add(
    "match.result",
    "match",
    line.match
      ? `Selected SKU ${line.match.sku}. Exact match for the requested catalog attributes. Line status: ${line.status}.`
      : `No catalog item is selected. Line status: ${line.status}. Nearby candidates are not accepted substitutes.`,
  );
  const candidate =
    line.candidates.find((c) => c.item.sku === line.match?.sku) ||
    line.candidates[0];
  candidate?.checks.forEach((c) =>
    add(
      `match.${c.field}`,
      "match",
      `${c.field}: requested ${c.request}; candidate ${c.catalog}; comparison ${c.state}.`,
    ),
  );
  if (line.match) {
    const demand = w.lines
      .filter((l) => !l.excluded && l.match?.sku === line.match!.sku)
      .reduce((sum, l) => sum + (l.spec.quantity || 0), 0);
    add(
      "match.stock",
      "match",
      `Catalog stock ${line.match.stock} sheets; combined demand ${demand} sheets across included lines. Catalog date ${line.match.updated}. Stock is not reserved.`,
    );
  }
  add(
    "pricing.calculation",
    "pricing",
    line.unitPriceCents === null
      ? "No proposed price or subtotal is available for this line. Resolve its requirements or restore it to the quote before pricing."
      : `Supplier cost ${money(line.match?.costCents)} per sheet. Cost-plus markup ${w.rfq.markupBps / 100}%. Proposed selling price ${money(line.unitPriceCents)} per sheet. Quantity ${line.spec.quantity} sheets. Line subtotal ${money(line.subtotalCents)}. Markup is not gross margin.`,
  );
  add(
    "pricing.benchmark",
    "pricing",
    line.benchmark.available
      ? `Comparable reference ${money(line.benchmark.priceCents)} per sheet. Proposed selling price is ${Math.abs(line.benchmark.difference!)}% ${line.benchmark.difference! <= 0 ? "below" : "above"} it. Reference source: ${line.benchmark.source}. Terms: ${line.benchmark.reason}`
      : "No comparable benchmark is available. Price competitiveness is not verified.",
  );
  add(
    "evidence.policy",
    "evidence",
    "Catalog attributes are not supporting documents. An explanation cannot certify material, approve a line, or replace human evidence review.",
  );
  line.requirements.forEach((r, i) =>
    add(`evidence.${i}`, "evidence", `${r.name}: ${r.status}. ${r.detail}`),
  );
  add(
    "evidence.blockers",
    "evidence",
    line.blockers.length
      ? `Unresolved checks: ${line.blockers.join(" ")}`
      : "No deterministic line blockers remain. Human review is still required before approval.",
  );
  if (line.excluded)
    add(
      "evidence.excluded",
      "evidence",
      "This line is excluded from the customer quote.",
    );
  if (w.rfq.mode === "demo") {
    add(
      "pricing.sample",
      "pricing",
      "Prices and benchmarks are sample data, not live market quotes.",
    );
    add(
      "evidence.sample",
      "evidence",
      "This workspace uses sample catalog data. Any attached demo records are synthetic, not real certification.",
    );
  }
  const alternatives = line.candidates
    .filter((c) => c.item.sku !== candidate?.item.sku && !c.exact)
    .slice(0, 3)
    .map((c, i) => {
      const factId = `alternative.${i}`;
      const reasons = c.checks
        .filter(
          (check) =>
            check.state !== "agree" &&
            !(check.field === "standard" && line.spec.standard === null),
        )
        .map((check) =>
          check.state === "unknown"
            ? `${check.field} is unspecified in the request; candidate has ${check.catalog}`
            : `${check.field} ${check.catalog} does not match requested ${check.request}`,
        );
      add(
        factId,
        "alternative",
        `SKU ${c.item.sku} is not an exact accepted match: ${reasons.join("; ")}.`,
      );
      return { sku: c.item.sku, factId };
    });
  return { facts, alternatives };
}

export function validateExplanation(
  raw: unknown,
  context: ReturnType<typeof explanationFacts>,
): Explanation {
  const result = explanationSchema.parse(raw);
  const sections = ["match", "pricing", "evidence"] as const;
  const validate = (p: z.infer<typeof paragraph>, allowed: string[]) => {
    if (p.factIds.some((id) => !allowed.includes(id)))
      throw new Error("Explanation cited an unsupported fact.");
    const cited = context.facts
      .filter((f) => p.factIds.includes(f.id))
      .map((f) => f.text)
      .join(" ");
    const numbers = (text: string): string[] =>
      text.match(/\b\d+(?:[.,]\d+)*\b/g) || [];
    if (numbers(p.text).some((number) => !numbers(cited).includes(number)))
      throw new Error(
        "Explanation introduced a number absent from its cited facts.",
      );
    if (/<[^>]*>|https?:\/\//i.test(p.text))
      throw new Error("Explanation must contain plain text only.");
  };
  for (const section of sections)
    validate(
      result[section],
      context.facts.filter((f) => f.section === section).map((f) => f.id),
    );
  if (
    result.alternatives.length !== context.alternatives.length ||
    new Set(result.alternatives.map((a) => a.sku)).size !==
      context.alternatives.length
  )
    throw new Error("Explanation did not cover the supplied alternatives.");
  result.alternatives.forEach((a) => {
    const source = context.alternatives.find((item) => item.sku === a.sku);
    if (!source) throw new Error("Explanation invented an alternative.");
    validate(a, [source.factId]);
  });
  return result;
}
