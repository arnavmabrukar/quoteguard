"use client";
import { Box, Download } from "lucide-react";
import type { LineView, Workspace } from "@/domain/types";
import { buildBlank, mm } from "@/domain/blank-cad";

const INK = "#182230";
const MUTED = "#667085";
const FILL = "#eef3fb";

/**
 * On-screen preview of the stock blank the CAD export produces, plus the
 * DXF/STEP downloads. Mirrors the server route: approved snapshot line,
 * quoted SKU, catalog dimensions, nothing guessed.
 */
export function BlankPreview({ w, line }: { w: Workspace; line: LineView }) {
  const header = (
    <div className="hud-section">
      <h3>Stock blank CAD</h3>
    </div>
  );
  const note = (text: string) => (
    <>
      {header}
      <article className="hud-card">
        <Box size={16} />
        <div>
          <small>{text}</small>
        </div>
      </article>
    </>
  );

  if (!w.rfq.approvedVersion)
    return note("Available after the quote is approved.");
  const quoted = w.quote.lines.find((l) => l.number === line.number);
  if (!quoted?.sku) return note("This item has no quoted SKU on the approved quote.");
  const built = buildBlank(w.catalog.find((c) => c.sku === quoted.sku) || null);
  if (!built.ok)
    return note(`Cannot build blank; missing: ${built.missing.join(", ")}.`);
  const b = built.blank;

  // Plan view keeps the true L:W ratio unless it would be unreadably thin;
  // the side view's thickness is drawn at a readable minimum.
  const planW = 240;
  const trueRatio = b.widthUm / b.lengthUm;
  const ratio = Math.min(1, Math.max(0.12, trueRatio));
  const planH = Math.round(planW * ratio);
  const trueSide = (planW * b.thicknessUm) / b.lengthUm;
  const sideH = Math.max(6, Math.round(trueSide));
  const exaggerated = ratio !== trueRatio || sideH !== Math.round(trueSide);
  const x0 = 40;
  const planY = 24;
  const sideY = planY + planH + 34;
  const height = sideY + sideH + 30;
  const href = (format: "dxf" | "step") =>
    `/api/rfqs/${encodeURIComponent(w.rfq.id)}/cad?line=${line.number}&format=${format}`;

  return (
    <>
      {header}
      <article className="hud-card stack">
        <div className="hud-card-row">
          <Box size={16} />
          <div>
            <h4 className="mono">{b.sku}</h4>
            <small>
              {b.material} {b.grade} {b.form} · {mm(b.lengthUm)} ×{" "}
              {mm(b.widthUm)} × {mm(b.thicknessUm)} mm
            </small>
          </div>
        </div>
        <svg
          className="blank-preview"
          viewBox={`0 0 320 ${height}`}
          role="img"
          aria-label={`Stock blank ${mm(b.lengthUm)} by ${mm(b.widthUm)} by ${mm(b.thicknessUm)} millimetres`}
        >
          <text x={x0} y={planY - 8} fontSize={8} fill={MUTED}>
            PLAN · L {mm(b.lengthUm)} × W {mm(b.widthUm)}
          </text>
          <rect x={x0} y={planY} width={planW} height={planH} fill={FILL} stroke={INK} strokeWidth={1.2} />
          <text
            x={x0 - 6}
            y={planY + planH / 2}
            fontSize={8}
            fill={MUTED}
            textAnchor="end"
            dominantBaseline="middle"
          >
            W
          </text>
          <text x={x0} y={sideY - 8} fontSize={8} fill={MUTED}>
            SIDE · L {mm(b.lengthUm)} × T {mm(b.thicknessUm)}
          </text>
          <rect x={x0} y={sideY} width={planW} height={sideH} fill={FILL} stroke={INK} strokeWidth={1.2} />
          <text x={x0} y={height - 8} fontSize={7} fill={MUTED}>
            {w.quote.demo
              ? "SYNTHETIC DEMO DATA · NOT FOR FABRICATION"
              : "STOCK BLANK ONLY · NO FEATURES OR TOLERANCES"}
            {exaggerated ? " · NOT TO SCALE" : ""}
          </text>
        </svg>
        <small>
          Rectangular blank from the approved quote&apos;s catalog dimensions.
          No holes, bends, or tolerances.
        </small>
        <div className="hud-actions">
          <a className="button secondary small" href={href("dxf")} download>
            <Download size={14} />
            Download DXF
          </a>
          <a className="button secondary small" href={href("step")} download>
            <Download size={14} />
            Download STEP
          </a>
        </div>
      </article>
    </>
  );
}
