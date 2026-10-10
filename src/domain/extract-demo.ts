import type { Line, Spec } from "./types";
export const emptySpec = (): Spec => ({
  material: null,
  grade: null,
  form: null,
  thickness: null,
  width: null,
  length: null,
  finish: null,
  standard: null,
  quantity: null,
  quantityUnit: null,
  mtr: false,
  origin: null,
  other: [],
});
function quantities(text: string) {
  return [...text.matchAll(/\b(\d+)\s*(sheets?|pcs|pieces?)\b/gi)].filter(
    (m) =>
      !/(?:stainless|grade|SS)\s*$/i.test(
        text.slice(Math.max(0, (m.index || 0) - 30), m.index),
      ),
  );
}
export function parseSpec(text: string): Spec {
  const s = emptySpec();
  if (/stainless|\bSS\b/i.test(text)) s.material = "stainless steel";
  s.grade =
    text.match(/\b(304L|316L|304|316|430|2205)\b/i)?.[1]?.toUpperCase() || null;
  s.form = /\bsheets?\b/i.test(text) ? "sheet" : null;
  const dims = [
    ...text.matchAll(/(\d*\.?\d+)\s*(inches|inch|in\b|mm\b|feet|ft\b|")/gi),
  ].map((m) => ({
    value: Number(m[1]),
    unit: (/^(mm)$/i.test(m[2])
      ? "mm"
      : /feet|ft/i.test(m[2])
        ? "ft"
        : "in") as "in" | "mm" | "ft",
  }));
  if (dims.length >= 3) [s.thickness, s.width, s.length] = dims;
  const quantity = quantities(text)[0];
  if (quantity) {
    s.quantity = Number(quantity[1]);
    s.quantityUnit = "sheet";
  }
  s.finish = text.match(/\b(2B|BA|No\.?\s*4)\b/i)?.[1]?.toUpperCase() || null;
  const standard = text.match(
    /ASTM\s*[A-Z]\d+(?:\s*\/\s*[A-Z]\d+[A-Z]?)?/i,
  )?.[0];
  s.standard = standard
    ? /^ASTM\s*A240(?:\s*\/\s*A240M)?$/i.test(standard)
      ? "ASTM A240/A240M"
      : standard.toUpperCase().replace(/\s+/g, " ")
    : null;
  s.mtr = /\bMTR\b|mill test report/i.test(text);
  s.origin = /\bUS(?:A)?\s+origin|origin\s*:\s*US\b|United States origin/i.test(
    text,
  )
    ? "US"
    : null;
  const unsupported = text.match(
    /(?:EN\s*10204[^,.;]*|REACH[^,.;]*|RoHS[^,.;]*|DFARS[^,.;]*)/gi,
  );
  if (unsupported) s.other = unsupported;
  return s;
}
export function provenanceFor(
  spec: Spec,
  text: string,
  location: string,
  state: "extracted" | "confirmed" = "extracted",
): Line["provenance"] {
  return Object.fromEntries(
    Object.entries(spec).map(([key, value]) => [
      key,
      {
        value:
          value === null
            ? null
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value),
        text,
        location,
        state: value === null ? "unknown" : state,
      },
    ]),
  );
}
export function extractDemo(text: string): Line[] {
  const sources = text
    .split(/\n/)
    .map((original, i) => ({
      original: original.trim(),
      location: `Line ${i + 1}`,
    }))
    .filter((x) => x.original && /sheet|stainless|\bSS\b/i.test(x.original));
  if (!sources.length)
    throw new Error(
      "No sheet line items were found. In demo mode, use one item per line with explicit specifications.",
    );
  return sources.slice(0, 100).map((source, i) => {
    const spec = parseSpec(source.original);
    const qty = quantities(source.original).map((m) => Number(m[1]));
    const issues = new Set(qty).size > 1 ? ["conflicting quantities"] : [];
    if (issues.length) spec.quantity = null;
    return {
      id: `line-${i + 1}`,
      number: i + 1,
      ...source,
      spec,
      provenance: provenanceFor(spec, source.original, source.location),
      issues,
      evidence: [],
      selectedSku: null,
      reviewConfirmed: false,
      excluded: null,
      clarification: [],
    };
  });
}
