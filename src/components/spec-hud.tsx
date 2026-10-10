"use client";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react";
import type { LineView, Provenance, Workspace } from "@/domain/types";
import { dimensionLabel } from "@/domain/match-catalog";
import type { InspectorTab } from "./line-inspector";
import { SpecViewer } from "./spec-drawing";
import { money } from "@/lib/format";
import { Status } from "./ui";

const stateLabel: Record<Provenance["state"], string> = {
  extracted: "Extracted",
  confirmed: "Confirmed",
  unknown: "Unknown",
  conflicting: "Conflicting",
};

export type SpecField = {
  label: string;
  value: string | null;
  key: string;
  bad: boolean;
  pin: number | null;
};
export function specFields(line: LineView): SpecField[] {
  const s = line.spec;
  const raw: [string, string | null, string][] = [
    ["Material", s.material, "material"],
    ["Grade", s.grade, "grade"],
    ["Form", s.form, "form"],
    ["Thickness", s.thickness ? dimensionLabel(s.thickness) : null, "thickness"],
    ["Width", s.width ? dimensionLabel(s.width) : null, "width"],
    ["Length", s.length ? dimensionLabel(s.length) : null, "length"],
    ["Finish", s.finish, "finish"],
    ["Standard", s.standard, "standard"],
    [
      "Quantity",
      s.quantity === null
        ? null
        : `${s.quantity}${s.quantityUnit ? ` ${s.quantityUnit}` : ""}`,
      "quantity",
    ],
  ];
  let n = 0;
  return raw.map(([label, value, key]) => {
    const st = line.provenance[key]?.state;
    const bad = !value || st === "conflicting" || st === "unknown";
    return { label, value, key, bad, pin: bad ? ++n : null };
  });
}

export function SpecHud({
  w,
  line,
  onClarify,
  onOpenTab,
}: {
  w: Workspace;
  line: LineView;
  onClarify: () => void;
  onOpenTab: (t: InspectorTab) => void;
}) {
  const fields = specFields(line);
  let pin = 0;
  const open = [
    ...line.issues,
    ...line.blockers.filter((b) => !line.issues.includes(b)),
  ];
  const checks = line.requirements.filter(
    (r) =>
      r.status === "Missing" ||
      r.status === "Conflicting" ||
      r.status === "Supplier confirmation needed",
  );
  const count = open.length + checks.length;
  const best =
    line.candidates.find((c) => c.item.sku === line.match?.sku) ||
    line.candidates[0];
  const approved = !!w.rfq.approvedVersion;

  return (
    <div className="hud">
      <div className="hud-pill">
        <span className="hud-live" />
        Zero-assumptions policy: active
      </div>
      <div className="hud-sheet">
        <div className="hud-sheet-head">
          <span>{w.rfq.documentName}</span>
          <span className="mono">{line.location}</span>
        </div>
        <blockquote>“{line.original}”</blockquote>
        <div className="hud-fields">
          {fields.map(({ label, value, key, bad, pin: n }) => {
            const p = line.provenance[key];
            return (
              <div key={label} className={bad ? "bad" : ""}>
                <span>
                  {label}
                  {bad && (
                    <i className="hud-pin" aria-label="Needs attention">
                      {n}
                    </i>
                  )}
                </span>
                <strong>{value || "Not specified"}</strong>
                {p && <small>{stateLabel[p.state]}</small>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hud-section">
        <h3>Clarification</h3>
        <span className={`hud-count ${count ? "warn" : "good"}`}>
          {count ? `${count} open` : "All clear"}
        </span>
      </div>
      {count > 0 ? (
        <>
          <div className="hud-alert">
            <TriangleAlert size={16} />
            <p>
              <strong>QuoteGuard will not guess.</strong> Resolve these with
              the buyer or confirm them yourself.
            </p>
          </div>
          {open.map((text, i) => (
            <article className="hud-card" key={`o-${i}`}>
              <span className="hud-num">{i + 1}</span>
              <h4>{text}</h4>
            </article>
          ))}
          {checks.map((r) => (
            <article className="hud-card" key={r.name}>
              <span className="hud-num warn">!</span>
              <div>
                <h4>{r.name}</h4>
                <small>{r.detail}</small>
              </div>
              <Status status={r.status} compact />
            </article>
          ))}
          <div className="hud-actions">
            <button
              className="button primary small"
              disabled={approved}
              onClick={onClarify}
            >
              <MessageSquareText size={14} />
              Draft clarification
            </button>
            <button
              className="button secondary small"
              onClick={() => onOpenTab("Requirements")}
            >
              Review checks
            </button>
          </div>
        </>
      ) : (
        <div className="hud-alert good">
          <CheckCircle2 size={16} />
          <p>
            <strong>No open questions.</strong>{" "}
            {line.reviewConfirmed
              ? "Reviewer confirmed."
              : "Ready for your review."}
          </p>
        </div>
      )}
      {line.clarification.length > 0 && (
        <article className="hud-card">
          <span className="hud-num good">
            <CheckCircle2 size={12} />
          </span>
          <div>
            <h4>Buyer reply</h4>
            <small>{line.clarification.at(-1)?.reply}</small>
          </div>
        </article>
      )}

      <div className="hud-section">
        <h3>{line.match ? "Catalog match" : "Closest catalog candidate"}</h3>
      </div>
      <article className="hud-card stack">
        <div className="hud-card-row">
          <Layers3 size={16} />
          <div>
            <h4 className="mono">{best?.item.sku || "No candidate"}</h4>
            <small>
              {line.match
                ? "Exact attributes matched"
                : best
                  ? "Not selected · confirmation needed"
                  : "Nothing in the catalog is close enough"}
            </small>
          </div>
        </div>
        {best && (
          <table className="hud-table">
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Requested</th>
                <th>Catalog</th>
              </tr>
            </thead>
            <tbody>
              {best.checks.map((c) => (
                <tr key={c.field} className={c.state}>
                  <td>{c.field}</td>
                  <td>{c.request || "—"}</td>
                  <td>{c.catalog || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="text-button" onClick={() => onOpenTab("Match")}>
          Open match <ArrowRight size={12} />
        </button>
      </article>
    </div>
  );
}

const needsAction = (l: LineView) =>
  !l.excluded &&
  (l.status === "Needs clarification" ||
    l.status === "No catalog match" ||
    l.issues.length > 0 ||
    l.blockers.length > 0);

export function SpecHudPage({
  w,
  onClarify,
  onOpenLine,
}: {
  w: Workspace;
  onClarify: (lineId: string) => void;
  onOpenLine: (lineId: string, tab: InspectorTab) => void;
}) {
  const [lineId, setLineId] = useState("");
  const line =
    w.lines.find((l) => l.id === lineId) ||
    w.lines.find(needsAction) ||
    w.lines[0];
  const flagged = w.lines.filter(needsAction).length;
  return (
    <div className="hud-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">SPEC HUD · {w.rfq.id}</div>
          <h1>{w.rfq.title}</h1>
          <p className="hud-sub">
            {w.rfq.customer} · {w.rfq.documentName}
          </p>
        </div>
        <span className={`hud-count ${flagged ? "warn" : "good"}`}>
          {flagged ? `${flagged} need attention` : "All items clear"}
        </span>
      </div>
      {line ? (
        <>
          <div className="hud-line-strip" role="tablist" aria-label="Items">
            {w.lines.map((l) => (
              <button
                key={l.id}
                role="tab"
                aria-selected={l.id === line.id}
                className={`${l.id === line.id ? "active" : ""} ${needsAction(l) ? "flag" : ""}`}
                onClick={() => setLineId(l.id)}
              >
                <span>Item {l.number}</span>
                <Status status={l.status} compact />
              </button>
            ))}
          </div>
          <div className="hud-split">
            <SpecViewer
              key={line.id}
              w={w}
              line={line}
              index={w.lines.indexOf(line)}
              total={w.lines.length}
              onStep={(d) =>
                setLineId(
                  w.lines[(w.lines.indexOf(line) + d + w.lines.length) % w.lines.length].id,
                )
              }
            />
            <section className="hud-review">
              <SpecHud
                key={line.id}
                w={w}
                line={line}
                onClarify={() => onClarify(line.id)}
                onOpenTab={(t) => onOpenLine(line.id, t)}
              />
              <footer className="hud-footer">
                <div>
                  <span>Priced subtotal</span>
                  <strong>{money(w.summary.subtotalCents)}</strong>
                  <small>
                    {w.summary.ready} of {w.summary.total} items ready
                  </small>
                </div>
                <button
                  className="button primary"
                  onClick={() => onOpenLine(line.id, "Match")}
                >
                  Review quote <ArrowRight size={15} />
                </button>
              </footer>
            </section>
          </div>
        </>
      ) : (
        <p className="hud-sub">No line items in this request yet.</p>
      )}
    </div>
  );
}
