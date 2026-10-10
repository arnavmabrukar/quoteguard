import type { CatalogItem, Line, RequirementCheck } from "./types";
export function checkRequirements(
  line: Line,
  item: CatalogItem | null,
): RequirementCheck[] {
  return (
    [
      ["mtr", "Mill test report", line.spec.mtr],
      ["standard", "Specification standard", !!line.spec.standard],
      ["origin", "Country of origin", !!line.spec.origin],
    ] as const
  )
    .map<RequirementCheck>(([key, name, requested]) => {
      if (!requested)
        return {
          name,
          status: "Not requested",
          detail: "Not requested by the buyer.",
        };
      const record =
        item &&
        line.evidence.find(
          (e) =>
            e.sku === item.sku &&
            e.lot === item.lot &&
            e.supports.includes(key),
        );
      if (!record)
        return {
          name,
          status: "Missing",
          detail:
            key === "mtr"
              ? "MTR not provided for the offered lot."
              : key === "origin"
                ? `Evidence of ${line.spec.origin} origin is required.`
                : `No lot-specific record for ${line.spec.standard}.`,
        };
      if (
        (key === "origin" && record.origin !== line.spec.origin) ||
        (key === "standard" && record.standard !== line.spec.standard)
      )
        return {
          name,
          status: "Conflicting",
          detail:
            "The supporting record does not agree with the requested requirement.",
          evidenceId: record.id,
        };
      return {
        name,
        status: record.reviewed
          ? "Supporting record present"
          : "Supplier confirmation needed",
        detail: record.reviewed
          ? `${record.label} · lot ${record.lot}`
          : "Record attached. Human review is required.",
        evidenceId: record.id,
      };
    })
    .concat(
      line.spec.other.map((name) => ({
        name,
        status: "Missing" as const,
        detail:
          "Additional buyer requirement needs supplier evidence. Exclude this line if it cannot be met.",
      })),
    );
}
