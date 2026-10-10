import { dimensionMicrons } from "./match-catalog";
import type { CatalogItem } from "./types";

/**
 * Stock-blank CAD: a rectangular prism built from the quoted catalog item.
 * No holes, bends, or tolerances exist in the domain, so none are modelled.
 * Dimensions are integer micrometres; nothing is guessed when a value is
 * missing.
 */
export type BlankSource = Pick<
  CatalogItem,
  "sku" | "material" | "grade" | "form" | "thickness" | "width" | "length"
>;
export type Blank = {
  sku: string;
  material: string;
  grade: string;
  form: string;
  /** Integer micrometres. */
  thicknessUm: number;
  widthUm: number;
  lengthUm: number;
};
export type BlankResult =
  | { ok: true; blank: Blank }
  | { ok: false; missing: string[] };

export function buildBlank(item: BlankSource | null): BlankResult {
  if (!item) return { ok: false, missing: ["catalog item"] };
  const um = {
    thickness: dimensionMicrons(item.thickness),
    width: dimensionMicrons(item.width),
    length: dimensionMicrons(item.length),
  };
  const missing = (["thickness", "width", "length"] as const).filter(
    (k) => !Number.isSafeInteger(um[k]) || (um[k] as number) <= 0,
  );
  if (missing.length) return { ok: false, missing: [...missing] };
  return {
    ok: true,
    blank: {
      sku: item.sku,
      material: item.material,
      grade: item.grade,
      form: item.form,
      thicknessUm: um.thickness as number,
      widthUm: um.width as number,
      lengthUm: um.length as number,
    },
  };
}

/** Exact micrometres to a millimetre string with 3 decimals. */
export const mm = (um: number) =>
  `${Math.floor(um / 1000)}.${String(um % 1000).padStart(3, "0")}`;
/** Printable ASCII only, so text is safe in DXF and STEP string fields. */
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "?");
const notice = (demo: boolean) =>
  demo
    ? "SYNTHETIC DEMO DATA - NOT FOR FABRICATION"
    : "STOCK BLANK ONLY - NO FEATURES OR TOLERANCES";

/**
 * DXF R12 (AC1009) ASCII: plan view (length x width) above a side view
 * (length x thickness), plus a text title block. Units are millimetres.
 */
export function blankDxf(b: Blank, demo: boolean): string {
  const out: (string | number)[] = [];
  const pair = (code: number, value: string | number) =>
    out.push(code, value);
  const line = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    pair(0, "LINE");
    pair(8, layer);
    pair(10, x1);
    pair(20, y1);
    pair(30, 0);
    pair(11, x2);
    pair(21, y2);
    pair(31, 0);
  };
  const text = (layer: string, x: number, y: number, h: number, s: string) => {
    pair(0, "TEXT");
    pair(8, layer);
    pair(10, x);
    pair(20, y);
    pair(30, 0);
    pair(40, h);
    pair(1, ascii(s));
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    line("OUTLINE", x, y, x + w, y);
    line("OUTLINE", x + w, y, x + w, y + h);
    line("OUTLINE", x + w, y + h, x, y + h);
    line("OUTLINE", x, y + h, x, y);
  };
  const L = b.lengthUm / 1000;
  const W = b.widthUm / 1000;
  const T = b.thicknessUm / 1000;
  const gap = Math.max(L, W) * 0.15 + 20;
  const th = Math.max(L, W) * 0.03 + 2;
  const sideY = 0;
  const planY = T + gap;
  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(0, "ENDSEC");
  pair(0, "SECTION");
  pair(2, "ENTITIES");
  rect(0, planY, L, W);
  rect(0, sideY, L, T);
  text("ANNOT", 0, planY + W + th, th, `PLAN VIEW  L ${mm(b.lengthUm)} x W ${mm(b.widthUm)} MM`);
  text("ANNOT", 0, sideY - th * 2, th, `SIDE VIEW  L ${mm(b.lengthUm)} x T ${mm(b.thicknessUm)} MM`);
  const tx = L + gap;
  text("TITLE", tx, planY + W, th, `SKU ${b.sku}`);
  text("TITLE", tx, planY + W - th * 2, th, `${b.material} ${b.grade} ${b.form}`);
  text("TITLE", tx, planY + W - th * 4, th, "UNITS MM");
  text("TITLE", tx, planY + W - th * 6, th, notice(demo));
  pair(0, "ENDSEC");
  pair(0, "EOF");
  return out.join("\r\n") + "\r\n";
}

/**
 * STEP AP214 ASCII: one MANIFOLD_SOLID_BREP box, origin at a corner,
 * X = length, Y = width, Z = thickness, millimetres.
 * Generated text; not validated against a CAD kernel in this repo.
 */
export function blankStep(b: Blank, demo: boolean): string {
  const rows: string[] = [];
  const add = (body: string) => {
    rows.push(`#${rows.length + 1}=${body};`);
    return `#${rows.length}`;
  };
  const str = (s: string) => `'${ascii(s).replace(/'/g, "''")}'`;
  const real = (n: number) => (Number.isInteger(n) ? `${n}.` : String(n));
  const size = [b.lengthUm / 1000, b.widthUm / 1000, b.thicknessUm / 1000];
  const name = `${b.sku} BLANK`;

  const app = add("APPLICATION_CONTEXT('automotive design')");
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${app})`);
  const pctx = add(`PRODUCT_CONTEXT('',${app},'mechanical')`);
  const prod = add(`PRODUCT(${str(b.sku)},${str(name)},${str(notice(demo))},(${pctx}))`);
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${prod}))`);
  const pdf = add(`PRODUCT_DEFINITION_FORMATION('','',${prod})`);
  const pdc = add(`PRODUCT_DEFINITION_CONTEXT('part definition',${app},'design')`);
  const pd = add(`PRODUCT_DEFINITION('design','',${pdf},${pdc})`);
  const pds = add(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
  const lu = add("(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))");
  const au = add("(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))");
  const su = add("(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())");
  const unc = add(
    `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05),${lu},'distance_accuracy_value','')`,
  );
  const ctx = add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${lu},${au},${su})) REPRESENTATION_CONTEXT('Context','3D'))`,
  );

  const point = (p: number[]) =>
    add(`CARTESIAN_POINT('',(${p.map(real).join(",")}))`);
  const dir = (d: number[]) =>
    add(`DIRECTION('',(${d.map(real).join(",")}))`);
  const coord = (i: number) => [
    (i & 1) * size[0],
    ((i >> 1) & 1) * size[1],
    ((i >> 2) & 1) * size[2],
  ];
  const vertex = Array.from({ length: 8 }, (_, i) =>
    add(`VERTEX_POINT('',${point(coord(i))})`),
  );
  // Edges run from the lower to the higher vertex index along one axis.
  const edges = new Map<string, { id: string; from: number }>();
  for (let i = 0; i < 8; i++)
    for (let axis = 0; axis < 3; axis++) {
      if ((i >> axis) & 1) continue;
      const j = i | (1 << axis);
      const d = [0, 0, 0];
      d[axis] = 1;
      const vec = add(`VECTOR('',${dir(d)},${real(size[axis])})`);
      const ln = add(`LINE('',${point(coord(i))},${vec})`);
      const ec = add(`EDGE_CURVE('',${vertex[i]},${vertex[j]},${ln},.T.)`);
      edges.set(`${i}-${j}`, { id: ec, from: i });
    }

  const faces: string[] = [];
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const at = (a: number, c: number) => {
        let i = sign > 0 ? 1 << axis : 0;
        i |= a << u;
        i |= c << v;
        return i;
      };
      // u x v == +axis, so this order is CCW about +axis; flip for -axis.
      let ring = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
      if (sign < 0) ring = ring.reverse();
      const oriented = ring.map((a, k) => {
        const c = ring[(k + 1) % 4];
        const e = edges.get(`${Math.min(a, c)}-${Math.max(a, c)}`)!;
        return add(`ORIENTED_EDGE('',*,*,${e.id},${e.from === a ? ".T." : ".F."})`);
      });
      const loop = add(`EDGE_LOOP('',(${oriented.join(",")}))`);
      const bound = add(`FACE_OUTER_BOUND('',${loop},.T.)`);
      const normal = [0, 0, 0];
      normal[axis] = sign;
      const ref = [0, 0, 0];
      ref[u] = 1;
      const place = add(
        `AXIS2_PLACEMENT_3D('',${point(coord(ring[0]))},${dir(normal)},${dir(ref)})`,
      );
      const plane = add(`PLANE('',${place})`);
      faces.push(add(`ADVANCED_FACE('',(${bound}),${plane},.T.)`));
    }
  const shell = add(`CLOSED_SHELL('',(${faces.join(",")}))`);
  const solid = add(`MANIFOLD_SOLID_BREP(${str(name)},${shell})`);
  const origin = add(`AXIS2_PLACEMENT_3D('',${point([0, 0, 0])},${dir([0, 0, 1])},${dir([1, 0, 0])})`);
  const rep = add(`ADVANCED_BREP_SHAPE_REPRESENTATION(${str(name)},(${solid},${origin}),${ctx})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${rep})`);

  return [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION((${str(notice(demo))}),'2;1');`,
    `FILE_NAME(${str(`${b.sku}-blank.step`)},'',(''),(''),'QuoteGuard','QuoteGuard','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...rows,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\r\n");
}
