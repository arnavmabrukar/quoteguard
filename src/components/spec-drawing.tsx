"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { LineView, Workspace } from "@/domain/types";
import { dimensionLabel, dimensionMicrons } from "@/domain/match-catalog";
import { specFields } from "./spec-hud";

const INK = "#182230";
const MUTED = "#667085";
const BLUE = "#2563eb";
const AMBER = "#b77916";
const RED = "#c3443e";

type Layer = "dims" | "datum" | "title";

/**
 * Schematic of the requested sheet, generated from the extracted spec.
 * It is not the customer's drawing; unknown dimensions are drawn dashed and
 * labelled "?" instead of being guessed.
 */
export function SpecViewer({
  w,
  line,
  index,
  total,
  onStep,
}: {
  w: Workspace;
  line: LineView;
  index: number;
  total: number;
  onStep: (delta: number) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    dims: true,
    datum: true,
    title: true,
  });
  const fields = specFields(line);
  const pins = fields.filter((f) => f.bad);
  const [active, setActive] = useState<string | null>(pins[0]?.key ?? null);
  const s = line.spec;

  // Plan view geometry
  const l = dimensionMicrons(s.length);
  const wd = dimensionMicrons(s.width);
  const known = !!l && !!wd;
  const ratio = known ? Math.min(3, Math.max(1, l / wd)) : 2;
  const pw = Math.min(330, 130 * ratio);
  const ph = pw / ratio;
  const x0 = (500 - pw) / 2 - 12;
  const y0 = 78;
  const edgeY = y0 + ph + 52;
  const edgeH = s.thickness ? 12 : 10;

  const label = (key: string) =>
    fields.find((f) => f.key === key)?.value || "?";
  const stateOf = (key: string) => line.provenance[key]?.state;
  const bad = (key: string) => !!fields.find((f) => f.key === key)?.bad;

  // Pin anchors per field (SVG coordinates)
  const titleX = 332;
  const titleY = 288;
  const anchors: Record<string, [number, number]> = {
    length: [x0 + pw / 2 + 52, y0 - 30],
    width: [x0 + pw + 28, y0 + ph / 2],
    thickness: [x0 + pw + 26, edgeY + edgeH / 2],
    material: [titleX, titleY + 22],
    grade: [titleX, titleY + 22],
    form: [titleX, titleY + 22],
    finish: [titleX, titleY + 36],
    standard: [titleX, titleY + 48],
    quantity: [titleX, titleY + 60],
  };
  const toggle = (k: Layer) => setLayers({ ...layers, [k]: !layers[k] });
  const arrow = (x: number, y: number, dir: "l" | "r" | "u" | "d", c: string) => {
    const pts = {
      l: `${x},${y} ${x + 8},${y - 3} ${x + 8},${y + 3}`,
      r: `${x},${y} ${x - 8},${y - 3} ${x - 8},${y + 3}`,
      u: `${x},${y} ${x - 3},${y + 8} ${x + 3},${y + 8}`,
      d: `${x},${y} ${x - 3},${y - 8} ${x + 3},${y - 8}`,
    }[dir];
    return <polygon points={pts} fill={c} />;
  };
  const lengthColor = bad("length") ? AMBER : BLUE;
  const widthColor = bad("width") ? AMBER : MUTED;
  const thickColor = bad("thickness") ? AMBER : MUTED;
  const row = (key: string, text: string | null, y: number, name: string) => (
    <text
      x={titleX + 6}
      y={titleY + y}
      fontSize={7}
      fill={bad(key) ? RED : INK}
      fontWeight={bad(key) ? 600 : 400}
    >
      {name}: {text || "UNSPECIFIED"}
    </text>
  );

  return (
    <section className="hud-viewer" aria-label="Spec drawing">
      <div className="hud-toolbar">
        <div className="hud-pager">
          <button aria-label="Previous item" onClick={() => onStep(-1)}>
            <ChevronLeft size={15} />
          </button>
          <span>
            Item {line.number} of {total}
          </span>
          <button aria-label="Next item" onClick={() => onStep(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
        <span className="hud-chip">{w.rfq.documentName}</span>
        <div className="hud-zoom">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(60, zoom - 20))}
          >
            <Minus size={14} />
          </button>
          <span>{zoom}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(240, zoom + 20))}
          >
            <Plus size={14} />
          </button>
          <button onClick={() => setZoom(100)}>FIT</button>
        </div>
        <div className="hud-layers">
          {(
            [
              ["dims", "Dimensions"],
              ["datum", "Datum"],
              ["title", "Title block"],
            ] as [Layer, string][]
          ).map(([k, name]) => (
            <label key={k} className={layers[k] ? "on" : ""}>
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={() => toggle(k)}
              />
              {name}
            </label>
          ))}
        </div>
      </div>
      <div className="hud-canvas">
        <svg
          className="hud-drawing"
          style={{ width: `${zoom}%` }}
          viewBox="0 0 500 360"
          role="img"
          aria-label={`Schematic of item ${line.number}`}
        >
          <defs>
            <pattern
              id="hud-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke={MUTED} strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect
            x="6"
            y="6"
            width="488"
            height="348"
            fill="none"
            stroke={INK}
            strokeWidth="1.5"
          />
          <text x="14" y="20" fontSize="8" fill={MUTED}>
            SCHEMATIC · NOT TO SCALE · GENERATED FROM EXTRACTED SPEC
          </text>

          {/* centerlines */}
          <line
            x1={x0 - 14}
            x2={x0 + pw + 14}
            y1={y0 + ph / 2}
            y2={y0 + ph / 2}
            stroke={MUTED}
            strokeWidth="0.75"
            strokeDasharray="8 4 2 4"
          />
          <line
            x1={x0 + pw / 2}
            x2={x0 + pw / 2}
            y1={y0 - 12}
            y2={y0 + ph + 12}
            stroke={MUTED}
            strokeWidth="0.75"
            strokeDasharray="8 4 2 4"
          />

          {/* plan view */}
          <rect
            x={x0}
            y={y0}
            width={pw}
            height={ph}
            fill="#fff"
            stroke={INK}
            strokeWidth="2.25"
            strokeDasharray={known ? undefined : "7 4"}
          />
          <text
            x={x0 + pw / 2}
            y={y0 + ph / 2 + 3}
            textAnchor="middle"
            fontSize="9"
            fill={MUTED}
          >
            {[s.grade, s.material, s.form].filter(Boolean).join(" ") ||
              "MATERIAL UNSPECIFIED"}
          </text>

          {/* edge view with thickness */}
          <text x={x0} y={edgeY - 6} fontSize="7" fill={MUTED}>
            EDGE VIEW
          </text>
          <rect
            x={x0}
            y={edgeY}
            width={pw}
            height={edgeH}
            fill="url(#hud-hatch)"
            stroke={INK}
            strokeWidth="1.5"
            strokeDasharray={s.thickness ? undefined : "5 3"}
          />

          {layers.datum && (
            <g>
              <line
                x1={x0 + 18}
                x2={x0 + 18}
                y1={y0 + ph}
                y2={y0 + ph + 10}
                stroke={BLUE}
                strokeWidth="1.25"
              />
              <rect
                x={x0}
                y={y0 + ph + 10}
                width="36"
                height="16"
                fill="#edf3ff"
                stroke={BLUE}
                strokeWidth="1.25"
              />
              <text
                x={x0 + 18}
                y={y0 + ph + 22}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill={BLUE}
              >
                - A -
              </text>
            </g>
          )}

          {layers.dims && (
            <g>
              {/* length */}
              <line x1={x0} x2={x0} y1={y0 - 34} y2={y0 - 3} stroke={MUTED} />
              <line
                x1={x0 + pw}
                x2={x0 + pw}
                y1={y0 - 34}
                y2={y0 - 3}
                stroke={MUTED}
              />
              <line
                x1={x0}
                x2={x0 + pw}
                y1={y0 - 28}
                y2={y0 - 28}
                stroke={lengthColor}
                strokeWidth="1.25"
                strokeDasharray={s.length ? undefined : "4 3"}
              />
              {arrow(x0, y0 - 28, "l", lengthColor)}
              {arrow(x0 + pw, y0 - 28, "r", lengthColor)}
              <rect
                x={x0 + pw / 2 - 40}
                y={y0 - 38}
                width="80"
                height="18"
                fill="#fff"
                stroke="#d0d5dd"
              />
              <text
                x={x0 + pw / 2}
                y={y0 - 26}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={lengthColor}
              >
                {s.length ? dimensionLabel(s.length) : "LENGTH ?"}
              </text>

              {/* width */}
              <line
                x1={x0 + pw + 3}
                x2={x0 + pw + 34}
                y1={y0}
                y2={y0}
                stroke={MUTED}
              />
              <line
                x1={x0 + pw + 3}
                x2={x0 + pw + 34}
                y1={y0 + ph}
                y2={y0 + ph}
                stroke={MUTED}
              />
              <line
                x1={x0 + pw + 28}
                x2={x0 + pw + 28}
                y1={y0}
                y2={y0 + ph}
                stroke={widthColor}
                strokeWidth="1.25"
                strokeDasharray={s.width ? undefined : "4 3"}
              />
              {arrow(x0 + pw + 28, y0, "u", widthColor)}
              {arrow(x0 + pw + 28, y0 + ph, "d", widthColor)}
              <rect
                x={x0 + pw + 8}
                y={y0 + ph / 2 - 9}
                width="52"
                height="18"
                fill="#fff"
                stroke="#d0d5dd"
              />
              <text
                x={x0 + pw + 34}
                y={y0 + ph / 2 + 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill={bad("width") ? AMBER : INK}
              >
                {s.width ? dimensionLabel(s.width) : "WIDTH ?"}
              </text>

              {/* thickness */}
              <line
                x1={x0 + pw + 26}
                x2={x0 + pw + 26}
                y1={edgeY - 6}
                y2={edgeY + edgeH + 6}
                stroke={thickColor}
                strokeWidth="1.25"
                strokeDasharray={s.thickness ? undefined : "4 3"}
              />
              <text
                x={x0 + pw + 34}
                y={edgeY + edgeH / 2 + 3}
                fontSize="9"
                fontWeight="600"
                fill={bad("thickness") ? AMBER : INK}
              >
                {s.thickness ? dimensionLabel(s.thickness) : "THK ?"}
              </text>
            </g>
          )}

          {layers.title && (
            <g>
              <rect
                x={titleX}
                y={titleY}
                width="156"
                height="66"
                fill="#f7f8fa"
                stroke={MUTED}
                strokeWidth="1.25"
              />
              <line
                x1={titleX}
                x2={titleX + 156}
                y1={titleY + 14}
                y2={titleY + 14}
                stroke={MUTED}
                strokeWidth="0.75"
              />
              <text
                x={titleX + 6}
                y={titleY + 10}
                fontSize="7"
                fontWeight="600"
                fill={INK}
              >
                {`${w.rfq.customer.toUpperCase().slice(0, 28)} · ${w.rfq.id} · ITEM ${line.number}`}
              </text>
              {row("grade", [s.grade, s.material, s.form].filter(Boolean).join(" "), 23, "MATL")}
              {row("finish", s.finish, 36, "FINISH")}
              {row("standard", s.standard, 49, "STD")}
              {row(
                "quantity",
                s.quantity === null
                  ? null
                  : `${s.quantity} ${s.quantityUnit || ""}`.trim(),
                62,
                "QTY",
              )}
            </g>
          )}

          {/* pins */}
          {pins.map((f) => {
            const [x, y] = anchors[f.key] || [40, 40];
            const on = active === f.key;
            const state = stateOf(f.key);
            const text = `#${f.pin} ${f.label} ${
              !f.value ? "not specified" : state === "conflicting" ? "conflicting" : "unconfirmed"
            }`;
            const bw = text.length * 5.1 + 14;
            const left = x + bw > 490;
            return (
              <g
                key={f.key}
                className="hud-pin-g"
                onClick={() => setActive(f.key)}
                role="button"
                aria-label={text}
              >
                <circle cx={x} cy={y} r={on ? 11 : 9} fill={RED} opacity={0.18} />
                <circle cx={x} cy={y} r="8" fill={on ? RED : AMBER} />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="#fff"
                >
                  {f.pin}
                </text>
                {on && (
                  <g>
                    <rect
                      x={left ? x - bw - 12 : x + 12}
                      y={y - 10}
                      width={bw}
                      height="20"
                      rx="4"
                      fill={INK}
                    />
                    <text
                      x={left ? x - bw - 12 + 7 : x + 12 + 7}
                      y={y + 3}
                      fontSize="8"
                      fontWeight="600"
                      fill="#fff"
                    >
                      {text}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="hud-status-bar">
        <span>
          Part: <b>{specTitle(line)}</b>
        </span>
        <span>
          Open pins:{" "}
          <b className={pins.length ? "bad" : ""}>{pins.length}</b>
        </span>
        <span>
          Match: <b>{line.match?.sku || "none selected"}</b>
        </span>
        <span className="hud-note">
          Spec {index + 1} of {total} · values come from the request, unknowns
          are never filled in
        </span>
      </div>
    </section>
  );
}
function specTitle(line: LineView) {
  const s = line.spec;
  return [s.grade, s.material, s.form].filter(Boolean).join(" ") || "Unspecified";
}
