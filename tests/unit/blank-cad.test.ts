import { describe, it, expect } from "vitest";
import { demoCatalog } from "@/domain/fixtures";
import { blankDxf, blankStep, buildBlank, mm } from "@/domain/blank-cad";

const item = demoCatalog[0];

describe("blank CAD", () => {
  it("builds exact integer-micron dimensions", () => {
    const r = buildBlank({
      ...item,
      thickness: { value: 0.25, unit: "in" },
      width: { value: 48, unit: "in" },
      length: { value: 120, unit: "mm" },
    });
    expect(r.ok && r.blank.thicknessUm).toBe(6350);
    expect(r.ok && r.blank.widthUm).toBe(1219200);
    expect(r.ok && r.blank.lengthUm).toBe(120000);
    expect(mm(6350)).toBe("6.350");
    expect(mm(1000)).toBe("1.000");
  });

  it("refuses missing or non-positive dimensions instead of guessing", () => {
    const r = buildBlank({
      ...item,
      thickness: null as never,
      width: { value: 0, unit: "mm" },
    });
    expect(r).toEqual({ ok: false, missing: ["thickness", "width"] });
    expect(buildBlank(null).ok).toBe(false);
  });

  it("writes a labeled DXF with both views", () => {
    const r = buildBlank(item);
    if (!r.ok) throw new Error("expected blank");
    const dxf = blankDxf(r.blank, true);
    expect(dxf.startsWith("0\r\nSECTION")).toBe(true);
    expect(dxf).toContain("EOF");
    expect(dxf.match(/\r\nLINE\r\n/g)).toHaveLength(8);
    expect(dxf).toContain("SYNTHETIC DEMO DATA");
  });

  it("writes a closed STEP box: 8 vertices, 12 edges, 6 faces", () => {
    const r = buildBlank(item);
    if (!r.ok) throw new Error("expected blank");
    const step = blankStep(r.blank, true);
    const count = (name: string) =>
      step.match(new RegExp(`=${name}\\(`, "g"))?.length ?? 0;
    expect(count("VERTEX_POINT")).toBe(8);
    expect(count("EDGE_CURVE")).toBe(12);
    expect(count("ADVANCED_FACE")).toBe(6);
    expect(count("ORIENTED_EDGE")).toBe(24);
    expect(step.trimEnd().endsWith("END-ISO-10303-21;")).toBe(true);
    // every #n reference points at a defined entity
    const defined = new Set(step.match(/^#\d+(?==)/gm));
    for (const ref of step.match(/#\d+/g) || [])
      expect(defined.has(ref)).toBe(true);
  });

  it("keeps free text safe in file strings", () => {
    const r = buildBlank({ ...item, sku: "A'B\nCé" });
    if (!r.ok) throw new Error("expected blank");
    const step = blankStep(r.blank, false);
    expect(step).not.toContain("A'B");
    expect(step).toContain("A''B?C?");
  });
});
