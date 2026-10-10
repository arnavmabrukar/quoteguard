import type {
  CatalogItem,
  Dimension,
  Line,
  MatchCandidate,
  Spec,
} from "./types";
export function dimensionMicrons(d: Dimension): number | null {
  return d
    ? Math.round(d.value * { in: 25400, mm: 1000, ft: 304800 }[d.unit])
    : null;
}
function rationalDimension(d: NonNullable<Dimension>) {
  const [decimal, exponent = "0"] = String(d.value).split("e");
  const [whole, fraction = ""] = decimal.split(".");
  const power = Number(exponent) - fraction.length;
  const numerator =
    BigInt(whole + fraction) *
    BigInt({ in: 25400, mm: 1000, ft: 304800 }[d.unit]);
  return power >= 0
    ? [numerator * 10n ** BigInt(power), 1n]
    : [numerator, 10n ** BigInt(-power)];
}
export function dimensionsEqual(a: Dimension, b: Dimension) {
  if (!a || !b) return false;
  const [an, ad] = rationalDimension(a);
  const [bn, bd] = rationalDimension(b);
  return an * bd === bn * ad;
}
export function dimensionLabel(d: Dimension): string {
  return d ? `${d.value} ${d.unit}` : "Not specified";
}
export function specDescription(s: Spec): string {
  return `${s.grade || "Unspecified grade"} ${s.material || "material"} ${s.form || "product"}`;
}
export function missingFields(line: Line): string[] {
  const s = line.spec;
  return [
    ...(
      [
        "material",
        "grade",
        "form",
        "thickness",
        "width",
        "length",
        "quantity",
        "quantityUnit",
        "finish",
      ] as const
    )
      .filter((k) => s[k] === null || s[k] === "")
      .map((k) => k),
    ...line.issues,
  ];
}
export function catalogCandidates(
  line: Line,
  catalog: CatalogItem[],
): MatchCandidate[] {
  return catalog
    .map((item) => {
      const checks: MatchCandidate["checks"] = (
        [
          "material",
          "grade",
          "form",
          "thickness",
          "width",
          "length",
          "finish",
          "standard",
        ] as const
      ).map((field) => {
        const request = line.spec[field];
        const offered = item[field];
        const dimension = ["thickness", "width", "length"].includes(field);
        const same = dimension
          ? dimensionsEqual(request as Dimension, offered as Dimension)
          : String(request).toLowerCase() === String(offered).toLowerCase();
        return {
          field,
          request: dimension
            ? dimensionLabel(request as Dimension)
            : String(request || "Not specified"),
          catalog: dimension
            ? dimensionLabel(offered as Dimension)
            : String(offered),
          state: request === null ? "unknown" : same ? "agree" : "different",
        };
      });
      return {
        item,
        checks,
        exact: checks.every(
          (c) =>
            c.state === "agree" ||
            (c.field === "standard" && line.spec.standard === null),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.checks.filter((c) => c.state === "agree").length -
          a.checks.filter((c) => c.state === "agree").length,
    );
}
