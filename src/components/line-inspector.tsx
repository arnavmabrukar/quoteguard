"use client";
import { dimensionLabel, specDescription } from "@/domain/match-catalog";
import type { Evidence, LineView, Workspace } from "@/domain/types";
import { money } from "@/lib/format";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  History,
  Info,
  Layers3,
  Link2,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { LineExplanation } from "./line-explanation";
import { Status } from "./ui";
export type InspectorTab = "Source" | "Match" | "Requirements";
export function LineInspector({
  w,
  line,
  tab,
  setTab,
  onEdit,
  onClarify,
  onEvidence,
  onAddEvidence,
  onReview,
  onExclude,
  onRestore,
  onPricing,
  onClose,
  busy,
  onNext,
}: {
  w: Workspace;
  line: LineView;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  onEdit: () => void;
  onClarify: () => void;
  onEvidence: (e: Evidence) => void;
  onAddEvidence: () => void;
  onReview: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onPricing: () => void;
  onClose: () => void;
  busy: boolean;
  onNext: () => void;
}) {
  const [alternatives, setAlternatives] = useState(false);
  const matched =
    line.candidates.find((c) => c.item.sku === line.match?.sku) ||
    line.candidates[0];
  const fields = [
    ["Material", line.spec.material],
    ["Grade", line.spec.grade],
    ["Product form", line.spec.form],
    ["Thickness", dimensionLabel(line.spec.thickness)],
    ["Width", dimensionLabel(line.spec.width)],
    ["Length", dimensionLabel(line.spec.length)],
    ["Finish", line.spec.finish],
    ["Standard", line.spec.standard],
  ];
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div className="eyebrow">
          ITEM {String(line.number).padStart(2, "0")} <span>DETAILS</span>
        </div>
        <div className="inspector-title">
          <h2>{specDescription(line.spec)}</h2>
          <button
            className="icon-button mobile-close"
            onClick={onClose}
            aria-label="Close item details"
          >
            <X size={18} />
          </button>
        </div>
        <div className="inspector-subtitle">
          {line.spec.thickness
            ? `${dimensionLabel(line.spec.thickness)} × ${dimensionLabel(line.spec.width)} × ${dimensionLabel(line.spec.length)}`
            : "Dimensions need confirmation"}
        </div>
        <Status
          status={
            line.reviewConfirmed && !line.blockers.length && !line.excluded
              ? "Checked"
              : line.status
          }
        />
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Item details">
        {(["Match", "Source", "Requirements"] as InspectorTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {
              {
                Match: "Overview",
                Source: "Specifications",
                Requirements: "Documents",
              }[t]
            }
          </button>
        ))}
      </div>
      <div
        className="inspector-body"
        role="tabpanel"
        aria-label={
          {
            Match: "Overview",
            Source: "Specifications",
            Requirements: "Documents",
          }[tab]
        }
      >
        {tab === "Source" && (
          <>
            <div className="section-caption">
              <FileText size={15} />
              <h3>Original request</h3>
              <span className="mono">{line.location}</span>
            </div>
            <blockquote className="source-quote">
              “<SourceHighlight text={line.original} />”
            </blockquote>
            <div className="source-reference">
              <Link2 size={13} />
              {w.rfq.documentName}
              <span>• {line.location}</span>
            </div>
            <div className="section-caption spread">
              <h3>Requested specifications</h3>
              <button className="text-button" onClick={onEdit}>
                <Pencil size={12} />
                Edit
              </button>
            </div>
            <div className="spec-grid">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong
                    className={
                      !value || value === "Not specified" ? "missing" : ""
                    }
                  >
                    {value || "Not specified"}
                  </strong>
                </div>
              ))}
            </div>
            <div className="info-note">
              <Info size={14} />
              <p>
                These details come from the customer’s request. Missing
                information stays blank until you confirm it.
              </p>
            </div>
            {Object.values(line.provenance).some(
              (p) => p.state === "confirmed",
            ) && (
              <div className="callout good">
                <CheckCircle2 size={16} />
                <p>
                  Fields confirmed by the reviewer. The original request is
                  preserved above.
                </p>
              </div>
            )}
            {line.clarification.length > 0 && (
              <div className="buyer-reply">
                <h3>Buyer clarification</h3>
                <p>{line.clarification.at(-1)?.reply}</p>
              </div>
            )}
          </>
        )}
        {tab === "Match" && (
          <>
            <div className="item-at-a-glance">
              <div>
                <span>Quantity</span>
                <strong>
                  {line.spec.quantity ?? "Not confirmed"}{" "}
                  {line.spec.quantityUnit === "sheet"
                    ? "sheets"
                    : line.spec.quantityUnit || ""}
                </strong>
              </div>
              <div>
                <span>Price per sheet</span>
                <strong>
                  {line.unitPriceCents === null
                    ? "Needs details"
                    : money(line.unitPriceCents)}
                </strong>
              </div>
              <div>
                <span>Item total</span>
                <strong>{money(line.subtotalCents)}</strong>
              </div>
            </div>
            <div
              className={`item-next-note ${line.blockers.length ? "needs-action" : ""}`}
            >
              <strong>
                {line.excluded
                  ? "Left out of this quote"
                  : line.reviewConfirmed && !line.blockers.length
                    ? "You’ve checked this item"
                    : line.status === "Needs clarification"
                      ? "A few details are missing"
                      : line.blockers.length
                        ? "Something needs checking"
                        : "Check the match, then mark this item checked"}
              </strong>
              <p>
                {line.excluded ||
                  line.blockers[0] ||
                  "The material matches the request. Review the specifications and price before continuing."}
              </p>
            </div>
            <LineExplanation w={w} line={line} />
            <details className="item-details-disclosure">
              <summary>Compare material specifications</summary>
              <div className="section-caption">
                <Layers3 size={15} />
                <h3>
                  {line.match
                    ? "Selected catalog match"
                    : "Closest catalog candidate"}
                </h3>
              </div>
              <div className={`match-card ${line.match ? "" : "uncertain"}`}>
                <div className="match-card-top">
                  <span className="product-mini">
                    <Layers3 size={21} />
                  </span>
                  <span>
                    <strong className="mono">
                      {matched?.item.sku || "No candidate"}
                    </strong>
                    <small>
                      {matched?.item.grade} stainless steel ·{" "}
                      {matched?.item.finish}
                    </small>
                  </span>
                  {line.match && <CheckCircle2 className="green" size={18} />}
                </div>
                <div className="match-card-bottom">
                  <span>
                    {line.match
                      ? "Exact attributes matched"
                      : "Not selected · confirmation needed"}
                  </span>
                  <span>{matched?.item.stock} in stock</span>
                </div>
              </div>
              <div className="section-caption">
                <h3>Specification comparison</h3>
              </div>
              <div className="comparison">
                <div className="comparison-header">
                  <span>Attribute</span>
                  <span>Requested</span>
                  <span>Catalog</span>
                </div>
                {matched?.checks.map((c) => (
                  <div className={`comparison-row ${c.state}`} key={c.field}>
                    <span>{c.field}</span>
                    <span>{c.request}</span>
                    <span>
                      {c.catalog}
                      {c.state === "agree" ? (
                        <Check size={12} />
                      ) : c.state === "different" ? (
                        <X size={12} />
                      ) : (
                        <Minus size={12} />
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="info-note">
                <ShieldCheck size={15} />
                <p>
                  {line.match
                    ? "Matched using exact specifications. Availability is checked across all lines using this SKU."
                    : "A nearby product is only a candidate. Gauge numbers and missing units are never assumed."}
                </p>
              </div>
              <button
                className="disclosure"
                onClick={() => setAlternatives(!alternatives)}
                aria-expanded={alternatives}
              >
                <span>
                  Alternative candidates{" "}
                  <b>{Math.max(0, line.candidates.length - 1)}</b>
                </span>
                <ChevronRight
                  size={15}
                  className={alternatives ? "rotated" : ""}
                />
              </button>
              {alternatives &&
                line.candidates
                  .filter((c) => c.item.sku !== matched?.item.sku)
                  .map((c) => (
                    <div className="alternative" key={c.item.sku}>
                      <strong className="mono">{c.item.sku}</strong>
                      <span className="rejected">
                        {c.exact ? "Exact alternative" : "Rejected"}
                      </span>
                      <p>
                        {c.checks
                          .filter((x) => x.state === "different")
                          .map((x) => `${x.field}: ${x.catalog}`)
                          .join(" · ") || "Unknown fields prevent acceptance."}
                      </p>
                    </div>
                  ))}
            </details>
          </>
        )}
        {tab === "Match" && (
          <details className="item-details-disclosure">
            <summary>How the price is calculated</summary>
            <div className="section-caption">
              <h3>Price calculation</h3>
              <span className="mini-label">USD / sheet</span>
            </div>
            <div className="price-math">
              <div>
                <span>Supplier cost</span>
                <strong>{money(line.match?.costCents)}</strong>
              </div>
              <div>
                <span>
                  Cost-plus markup{" "}
                  <button className="inline-link" onClick={onPricing}>
                    Edit
                  </button>
                </span>
                <strong>{w.rfq.markupBps / 100}%</strong>
              </div>
              <div className="price-result">
                <span>Proposed unit price</span>
                <strong>{money(line.unitPriceCents)}</strong>
              </div>
              <div>
                <span>Quantity</span>
                <strong>{line.spec.quantity ?? "—"} sheets</strong>
              </div>
              <div className="line-subtotal">
                <span>Line subtotal</span>
                <strong>{money(line.subtotalCents)}</strong>
              </div>
            </div>
            {line.benchmark.available ? (
              <div className="benchmark-comparison">
                <ArrowDownRight size={18} />
                <div>
                  <strong>
                    {Math.abs(line.benchmark.difference!)}%{" "}
                    {line.benchmark.difference! <= 0 ? "below" : "above"}{" "}
                    reference
                  </strong>
                  <p>
                    {money(line.benchmark.priceCents)} / sheet · synthetic
                    benchmark
                  </p>
                  <small>{line.benchmark.reason}</small>
                </div>
              </div>
            ) : (
              <div className="info-note">
                <Info size={15} />
                <p>
                  {line.unitPriceCents === null
                    ? "Resolve missing specifications to calculate a price."
                    : "Price calculated; competitiveness not verified. No comparable reference for this quantity tier."}
                </p>
              </div>
            )}
            <div className="section-caption">
              <h3>Commercial terms</h3>
            </div>
            <dl className="terms-mini">
              <dt>Shipping</dt>
              <dd>{w.rfq.terms.shipping}</dd>
              <dt>Tax</dt>
              <dd>{w.rfq.terms.tax}</dd>
              <dt>Processing</dt>
              <dd>{w.rfq.terms.processing}</dd>
            </dl>
            <p className="microcopy">
              Demo prices are synthetic, not current market prices. Markup is
              applied to cost; it is not gross margin.
            </p>
          </details>
        )}
        {tab === "Requirements" && (
          <>
            <div className="section-caption">
              <FileCheck2 size={16} />
              <h3>Required documents & checks</h3>
            </div>
            <div className="requirement-list">
              {line.requirements.map((r, i) => (
                <div className="requirement" key={i}>
                  <div>
                    <strong>{r.name}</strong>
                    {r.status === "Supporting record present" ? (
                      <CheckCircle2 size={16} className="green" />
                    ) : r.status === "Not requested" ? (
                      <Minus size={16} />
                    ) : (
                      <span className="requirement-dot" />
                    )}
                  </div>
                  <Status status={r.status} />
                  <p>{r.detail}</p>
                  {r.evidenceId && (
                    <button
                      className="text-button"
                      onClick={() =>
                        onEvidence(
                          line.evidence.find((e) => e.id === r.evidenceId)!,
                        )
                      }
                    >
                      <FileText size={13} />
                      Open document
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {w.rfq.mode === "demo" &&
              line.match &&
              line.requirements.some((r) => r.status === "Missing") && (
                <button
                  className="button secondary full"
                  onClick={onAddEvidence}
                  disabled={busy}
                >
                  <Plus size={15} />
                  Add sample documents
                </button>
              )}
            <div className="info-note">
              <Info size={15} />
              <p>
                Evidence must refer to the offered product and lot. A catalog
                description alone does not establish certification.
              </p>
            </div>
          </>
        )}
        {tab === "Source" && (
          <details className="item-details-disclosure">
            <summary>Item history</summary>
            <div className="section-caption">
              <History size={16} />
              <h3>Item activity</h3>
            </div>
            <div className="timeline">
              {w.history
                .filter((e) => !e.lineId || e.lineId === line.id)
                .map((e) => (
                  <div key={e.id}>
                    <span className="timeline-dot" />
                    <strong>{e.action}</strong>
                    <p>{e.detail}</p>
                    <small>
                      {new Date(e.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · v{e.revision}
                    </small>
                  </div>
                ))}
            </div>
          </details>
        )}
      </div>
      <div className="inspector-footer">
        {line.excluded ? (
          <>
            <p>Excluded: {line.excluded}</p>
            <button
              className="button secondary full"
              onClick={onRestore}
              disabled={busy}
            >
              Restore line item
            </button>
          </>
        ) : line.status === "Needs clarification" ? (
          <button className="button primary full" onClick={onClarify}>
            <Sparkles size={15} />
            Add missing details
            <ArrowRight size={15} />
          </button>
        ) : line.blockers.length ? (
          <>
            <p className="microcopy">{line.blockers[0]}</p>
            <button
              className="button secondary full"
              onClick={() =>
                setTab(
                  line.status === "No catalog match"
                    ? "Source"
                    : "Requirements",
                )
              }
            >
              {line.status === "No catalog match"
                ? "Check specifications"
                : "Check documents"}
              <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <button
            className={`button ${line.reviewConfirmed ? "reviewed-button" : "primary"} full`}
            onClick={onReview}
            disabled={busy || line.reviewConfirmed || !!w.rfq.approvedVersion}
          >
            <CheckCircle2 size={16} />
            {line.reviewConfirmed ? "Item checked" : "Mark item checked"}
          </button>
        )}
        {line.reviewConfirmed && (
          <button
            className="button secondary full next-item-button"
            onClick={onNext}
          >
            Check next item
            <ArrowRight size={15} />
          </button>
        )}
        {!line.excluded && (
          <div className="inspector-bottom-links">
            <button className="text-button muted" onClick={onEdit}>
              <Pencil size={12} />
              Edit item
            </button>
            <button className="text-button muted" onClick={onExclude}>
              Exclude from quote
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SourceHighlight({ text }: { text: string }) {
  const parts = text.split(
    /(\b(?:304L|316L|304|316|430|2B|MTR)\b|\b\d*\.?\d+\s*(?:in|mm|ft)\b)/gi,
  );
  return (
    <>{parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
  );
}
