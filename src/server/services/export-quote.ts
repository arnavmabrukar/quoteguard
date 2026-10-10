import "server-only";
import type { QuoteSnapshot } from "@/domain/types";
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function quoteCsv(q: QuoteSnapshot) {
  const rows: unknown[][] = [
    ["Quote", q.id, q.status, q.demo ? "DEMO — synthetic quotation" : ""],
    ["Buyer", q.customer],
    ["Issued", q.issuedAt],
    ["Validity days", q.validityDays],
    [
      "Line",
      "Description",
      "SKU",
      "Quantity",
      "Unit",
      "Unit price USD",
      "Line subtotal USD",
      "Documentation",
      "Status",
    ],
    ...q.lines.map((l) => [
      l.number,
      l.description,
      l.sku,
      l.quantity,
      l.unit,
      l.unitPriceCents === null ? "" : (l.unitPriceCents / 100).toFixed(2),
      l.subtotalCents === null ? "" : (l.subtotalCents / 100).toFixed(2),
      l.documentation.join("; "),
      l.status,
    ]),
    ["Priced subtotal (USD)", (q.pricedSubtotalCents / 100).toFixed(2)],
    ["Shipping", q.terms.shipping],
    ["Tax", q.terms.tax],
    ["Processing", q.terms.processing],
    ["Delivery", q.terms.delivery],
    ...q.exclusions.map((e) => ["EXCLUDED", e.number, e.description, e.reason]),
    ...q.unresolved.map((u) => ["UNRESOLVED", u]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
