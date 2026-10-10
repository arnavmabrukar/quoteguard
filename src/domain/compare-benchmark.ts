import type { Benchmark, LineView } from "./types";
export function compareBenchmark(
  sku: string | null,
  quantity: number | null,
  unitPriceCents: number | null,
  benchmarks: Benchmark[],
  now: string,
): LineView["benchmark"] {
  const b = benchmarks.find(
    (b) =>
      b.sku === sku &&
      b.currency === "USD" &&
      b.unit === "sheet" &&
      quantity !== null &&
      quantity >= b.minimum &&
      quantity <= b.maximum &&
      Date.parse(now) >= Date.parse(b.observed) &&
      Date.parse(now) - Date.parse(b.observed) <= 90 * 86400000,
  );
  if (!b || unitPriceCents === null)
    return {
      available: false,
      reason: "Price calculated; competitiveness not verified.",
    };
  return {
    available: true,
    priceCents: b.priceCents,
    difference:
      Math.round(((unitPriceCents - b.priceCents) / b.priceCents) * 1000) / 10,
    source: b.source,
    reason: b.terms,
  };
}
