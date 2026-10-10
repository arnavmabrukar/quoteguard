import type {
  Benchmark,
  CatalogItem,
  LineView,
  QuoteSnapshot,
  Rfq,
} from "./types";
import { calculatePrice } from "./calculate-price";
import {
  catalogCandidates,
  dimensionLabel,
  missingFields,
  specDescription,
} from "./match-catalog";
import { checkRequirements } from "./check-requirements";
import { compareBenchmark } from "./compare-benchmark";
export function reviewLines(
  rfq: Rfq,
  catalog: CatalogItem[],
  benchmarks: Benchmark[],
  now: string,
): LineView[] {
  const selected = rfq.lines.map((line) => {
    const candidates = catalogCandidates(line, catalog);
    const exact = candidates.find(
      (c) => c.exact && (!line.selectedSku || c.item.sku === line.selectedSku),
    );
    return {
      line,
      candidates,
      match: missingFields(line).length === 0 ? exact?.item || null : null,
    };
  });
  return selected.map(({ line, candidates, match }) => {
    const missing = missingFields(line);
    const requirements = checkRequirements(line, match);
    const requestedStock = match
      ? selected
          .filter((x) => !x.line.excluded && x.match?.sku === match.sku)
          .reduce((sum, x) => sum + (x.line.spec.quantity || 0), 0)
      : 0;
    const blockers = [
      ...missing.map((m) => `Confirm ${m}.`),
      ...(!missing.length && !match
        ? [
            "No exact catalog match. A close product cannot be substituted automatically.",
          ]
        : []),
      ...(match && requestedStock > match.stock
        ? [
            `Combined demand is ${requestedStock} sheets; only ${match.stock} are available.`,
          ]
        : []),
      ...requirements
        .filter(
          (r) =>
            !["Supporting record present", "Not requested"].includes(r.status),
        )
        .map((r) => r.detail),
      ...(!rfq.guardrail.passed
        ? [
            "Embedded instructions detected. Create a clean request before approval.",
          ]
        : []),
    ];
    const price =
      match && line.spec.quantity !== null && !line.excluded
        ? calculatePrice(match.costCents, rfq.markupBps, line.spec.quantity)
        : { unitPriceCents: null, subtotalCents: null };
    const status = line.excluded
      ? "Excluded"
      : missing.length
        ? "Needs clarification"
        : !match || requestedStock > match.stock
          ? "No catalog match"
          : blockers.length
            ? "Awaiting supplier evidence"
            : rfq.approvedVersion
              ? "Approved"
              : "Ready for review";
    return {
      ...line,
      status,
      blockers,
      candidates,
      match,
      requirements,
      ...price,
      benchmark: compareBenchmark(
        match?.sku || null,
        line.spec.quantity,
        price.unitPriceCents,
        benchmarks,
        now,
      ),
    };
  });
}
export function approvalBlockers(
  rfq: Rfq,
  lines: LineView[],
  requirePrism: boolean,
): string[] {
  const included = lines.filter((l) => !l.excluded);
  return [
    ...(!included.length ? ["Include at least one line item."] : []),
    ...included.flatMap((l) => l.blockers.map((b) => `Line ${l.number}: ${b}`)),
    ...included
      .filter((l) => !l.reviewConfirmed)
      .map(
        (l) =>
          `Line ${l.number}: confirm the match, pricing, and supporting records.`,
      ),
    ...(requirePrism &&
    (rfq.prism.evaluation !== "Passed" ||
      rfq.prism.evaluatedRevision !== rfq.revision)
      ? ["A current, passed PRISM evaluation is required."]
      : []),
    ...(!rfq.guardrail.passed ? ["The input guardrail blocked this RFQ."] : []),
  ];
}
export function buildQuote(
  rfq: Rfq,
  lines: LineView[],
  now: string,
): QuoteSnapshot {
  return {
    id: rfq.approvedVersion || `${rfq.id.replace("RFQ", "Q")}-V${rfq.revision}`,
    rfqId: rfq.id,
    revision: rfq.revision,
    status: rfq.approvedVersion ? "APPROVED" : "DRAFT",
    customer: rfq.customer,
    contact: rfq.contact,
    title: rfq.title,
    issuedAt: now,
    validityDays: rfq.terms.validityDays,
    demo: rfq.mode === "demo",
    partial: lines.some((l) => !!l.excluded),
    lines: lines
      .filter((l) => !l.excluded)
      .map((l) => ({
        number: l.number,
        description: `${specDescription(l.spec)} · ${dimensionLabel(l.spec.thickness)} × ${dimensionLabel(l.spec.width)} × ${dimensionLabel(l.spec.length)} · ${l.spec.finish || "Finish not specified"}`,
        sku: l.match?.sku || null,
        quantity: l.spec.quantity,
        unit: l.spec.quantityUnit || "Not specified",
        unitPriceCents: l.unitPriceCents,
        subtotalCents: l.subtotalCents,
        documentation: l.requirements
          .filter((r) => r.status === "Supporting record present")
          .map((r) => r.name),
        status: l.status,
      })),
    exclusions: lines
      .filter((l) => l.excluded)
      .map((l) => ({
        number: l.number,
        description: l.original,
        reason: l.excluded!,
      })),
    pricedSubtotalCents: lines.reduce(
      (sum, l) => sum + (l.subtotalCents || 0),
      0,
    ),
    terms: { ...rfq.terms },
    unresolved: lines
      .filter((l) => !l.excluded)
      .flatMap((l) => l.blockers.map((b) => `Line ${l.number}: ${b}`)),
  };
}
