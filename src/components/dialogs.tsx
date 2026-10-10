"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  Mail,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type {
  Evidence,
  LineView,
  QuoteSnapshot,
  Spec,
  Workspace,
} from "@/domain/types";
import { sampleReply, sampleText, edgeFixtures } from "@/domain/fixtures";
import { parseSpec } from "@/domain/extract-demo";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { Modal, ErrorMessage, Status } from "./ui";
export type Uploaded = {
  id: string;
  filename: string;
  text: string;
  sheets: { name: string; rows: string[][] }[];
};
export function ImportDialog({
  onClose,
  onCreated,
  catalogMode = false,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  catalogMode?: boolean;
}) {
  const [text, setText] = useState(""),
    [customer, setCustomer] = useState(""),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<Uploaded | null>(null),
    [sheet, setSheet] = useState(""),
    [dc, setDc] = useState(0),
    [qc, setQc] = useState<number | null>(null),
    [sc, setSc] = useState(0),
    [stock, setStock] = useState(2),
    [cost, setCost] = useState(3),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [preview, setPreview] = useState(false);
  const rows = file?.sheets.find((s) => s.name === sheet)?.rows || [];
  async function upload(f: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Upload failed.");
      setFile(result);
      setText(result.text);
      setSheet(result.sheets[0]?.name || "");
      const h = result.sheets[0]?.rows[0] || [];
      setDc(
        Math.max(
          0,
          h.findIndex((x: string) => /description|item|spec/i.test(x)),
        ),
      );
      const q = h.findIndex((x: string) => /qty|quantity/i.test(x));
      setQc(q < 0 ? null : q);
      setPreview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (catalogMode) {
        const result = await api<{ count: number }>("catalog/import", {
          documentId: file?.id,
          sheet,
          skuColumn: sc,
          descriptionColumn: dc,
          stockColumn: stock,
          costColumn: cost,
        });
        onCreated(`${result.count} catalog items imported`);
      } else {
        const result = await api<{ id: string }>("rfqs", {
          customer,
          title,
          text:
            text ||
            rows
              .slice(1)
              .map((r) => r[dc])
              .join("\n"),
          documentId: file?.id || null,
          sheet,
          descriptionColumn: dc,
          quantityColumn: qc,
          idempotencyKey: crypto.randomUUID(),
        });
        onCreated(result.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const columnSelect = (
    label: string,
    value: number | null,
    set: (v: number) => void,
    optional = false,
  ) => (
    <label className="field">
      {label}
      <select value={value ?? -1} onChange={(e) => set(Number(e.target.value))}>
        {optional && <option value={-1}>Not mapped</option>}
        {rows[0]?.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Modal
      title={
        catalogMode ? "Import supplier catalog" : "New request for quotation"
      }
      subtitle={
        catalogMode
          ? "Preview your CSV and map the catalog fields."
          : "Start with an email, a spreadsheet, or a text-based PDF."
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="demo-inline">
          <FlaskConical size={14} />
          <span>Local prototype · use synthetic or redacted data only</span>
        </div>
        {!catalogMode && (
          <div className="form-row">
            <label className="field">
              Customer
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. Apex Fabrication"
              />
            </label>
            <label className="field">
              RFQ title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stainless steel sheets"
              />
            </label>
          </div>
        )}
        <div
          className={`dropzone ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);
          }}
        >
          <UploadCloud size={27} />
          <strong>
            {file ? file.filename : "Drop a request here, or browse files"}
          </strong>
          <span>
            {catalogMode
              ? "CSV · up to 4 MB"
              : "CSV, XLSX, TXT or text-based PDF · up to 4 MB"}
          </span>
          <input
            type="file"
            aria-label="Upload request"
            accept={catalogMode ? ".csv" : ".txt,.csv,.xlsx,.pdf"}
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
            disabled={busy}
          />
        </div>
        {!catalogMode && !file && (
          <>
            <div className="divider-label">or paste request text</div>
            <label className="field">
              <span className="sr-only">RFQ text</span>
              <textarea
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the buyer’s request here. Include original descriptions, quantities, and requirements."
              />
            </label>
            <div className="import-samples">
              <button
                className="text-button"
                onClick={() => {
                  setText(sampleText);
                  setCustomer("Apex Fabrication");
                  setTitle("Stainless steel sheets");
                }}
              >
                <Sparkles size={14} />
                Use sample RFQ
              </button>
              <select
                aria-label="Test edge case"
                value=""
                onChange={(e) => {
                  setText(
                    edgeFixtures[e.target.value as keyof typeof edgeFixtures],
                  );
                  setCustomer("Demo customer");
                  setTitle(e.target.value);
                }}
              >
                <option value="" disabled>
                  Try an edge case…
                </option>
                {Object.keys(edgeFixtures).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {!!rows.length && (
          <>
            <div className="form-row">
              <label className="field">
                Worksheet
                <select
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value)}
                >
                  {file?.sheets.map((s) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              {columnSelect("Description column", dc, setDc)}
              {!catalogMode &&
                columnSelect(
                  "Quantity column",
                  qc,
                  (v) => setQc(v < 0 ? null : v),
                  true,
                )}
            </div>
            {catalogMode && (
              <div className="form-row">
                {columnSelect("SKU", sc, setSc)}
                {columnSelect("Stock", stock, setStock)}
                {columnSelect("Cost (USD / sheet)", cost, setCost)}
              </div>
            )}
            <div className="import-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {rows[0].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1, 5).map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="microcopy">
              Previewing {Math.min(rows.length - 1, 4)} of {rows.length - 1}{" "}
              rows. Formulas are never executed.
            </p>
          </>
        )}
        {!rows.length && file && (
          <div className="source-preview">
            <h3>Extracted text preview</h3>
            <pre>{text.slice(0, 4000)}</pre>
          </div>
        )}
        {preview && !file && (
          <div className="source-preview">
            <h3>Request preview</h3>
            <pre>{text}</pre>
          </div>
        )}
        <ErrorMessage message={error} />
        <div className="info-note">
          <ShieldCheck size={15} />
          <p>
            {catalogMode
              ? "Imports add new SKUs. Existing catalog items cannot be overwritten through this importer."
              : "Source text is preserved. Demo extraction recognizes explicit sheet specifications; it does not infer missing units or gauge thickness."}
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <div className="button-group">
          {!file && !preview && (
            <button
              className="button secondary"
              disabled={!text}
              onClick={() => setPreview(true)}
            >
              Preview text
            </button>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              (catalogMode
                ? !rows.length
                : !customer.trim() ||
                  !title.trim() ||
                  (!text.trim() && !rows.length))
            }
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <ArrowRight size={16} />
            )}{" "}
            {busy
              ? "Processing…"
              : catalogMode
                ? "Import catalog"
                : "Create RFQ"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
export function SpecDialog({
  line,
  clarify,
  onClose,
  onSave,
  busy,
}: {
  line: LineView;
  clarify: boolean;
  onClose: () => void;
  onSave: (spec: Spec, reply?: string) => Promise<void>;
  busy: boolean;
}) {
  const [spec, setSpec] = useState<Spec>(structuredClone(line.spec)),
    [reply, setReply] = useState(""),
    [draft, setDraft] = useState(
      `Hi there,\n\nFor item ${line.number} (${line.original}), please confirm the required thickness in inches or millimeters and the units for the width and length. Please also confirm the required finish and whether a specification standard is required.\n\nThank you,\nNorthline Metals`,
    ),
    [checks, setChecks] = useState<string[]>([]),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const update = (key: keyof Spec, value: unknown) =>
    setSpec((s) => ({ ...s, [key]: value }));
  const groups = [
    "Thickness",
    "Width & length",
    "Grade & finish",
    "Quantity",
    "Requirements",
  ];
  async function save() {
    setError("");
    try {
      await onSave(spec, clarify ? reply : undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={
        clarify
          ? `Clarify item ${String(line.number).padStart(2, "0")}`
          : `Edit item ${String(line.number).padStart(2, "0")}`
      }
      subtitle={
        clarify
          ? "Turn an ambiguous request into an explicit specification."
          : "Changes recalculate pricing and invalidate affected reviews."
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        {clarify && (
          <>
            <div className="section-caption spread">
              <h3>
                <Mail size={15} />
                Clarification draft
              </h3>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft);
                    setCopied(true);
                  } catch {
                    setError(
                      "Clipboard unavailable. Select and copy the draft text.",
                    );
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Copied · not sent" : "Copy draft"}
              </button>
            </div>
            <textarea
              className="draft-text"
              aria-label="Clarification draft"
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="microcopy">
              Copy this draft into your email. QuoteGuard does not send
              messages.
            </p>
            <div className="section-caption spread">
              <h3>Buyer’s reply</h3>
              <button
                className="text-button"
                onClick={() => {
                  setReply(sampleReply);
                  setSpec(parseSpec(sampleReply));
                  setChecks([]);
                }}
              >
                <FlaskConical size={14} />
                Use sample buyer reply
              </button>
            </div>
            <textarea
              aria-label="Buyer reply"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Paste the buyer’s reply…"
            />
            <button
              className="button secondary small interpret"
              disabled={!reply.trim()}
              onClick={() => {
                const parsed = parseSpec(reply);
                setSpec({
                  ...spec,
                  ...Object.fromEntries(
                    Object.entries(parsed).filter(
                      ([, v]) =>
                        v !== null &&
                        v !== false &&
                        (!Array.isArray(v) || v.length),
                    ),
                  ),
                });
                setChecks([]);
              }}
            >
              Extract explicit reply fields
            </button>
            <hr />
          </>
        )}
        <div className="section-caption">
          <h3>
            {clarify ? "Confirm interpreted fields" : "Item specifications"}
          </h3>
          <span className="mini-label">No implied defaults</span>
        </div>
        <div className="form-row three">
          <label className="field">
            Material
            <input
              value={spec.material || ""}
              onChange={(e) => update("material", e.target.value || null)}
            />
          </label>
          <label className="field">
            Grade
            <input
              value={spec.grade || ""}
              onChange={(e) => update("grade", e.target.value || null)}
            />
          </label>
          <label className="field">
            Product form
            <input
              value={spec.form || ""}
              onChange={(e) => update("form", e.target.value || null)}
            />
          </label>
        </div>
        <div className="form-row three">
          {(["thickness", "width", "length"] as const).map((k) => (
            <label className="field" key={k}>
              {k[0].toUpperCase() + k.slice(1)}
              <div className="dimension-input">
                <input
                  aria-label={k}
                  type="number"
                  min="0.001"
                  step="any"
                  value={spec[k]?.value ?? ""}
                  placeholder="Unknown"
                  onChange={(e) =>
                    update(
                      k,
                      e.target.value
                        ? {
                            value: Number(e.target.value),
                            unit: spec[k]?.unit || "in",
                          }
                        : null,
                    )
                  }
                />
                <select
                  aria-label={`${k} unit`}
                  value={spec[k]?.unit || "in"}
                  onChange={(e) =>
                    update(
                      k,
                      spec[k] ? { ...spec[k], unit: e.target.value } : null,
                    )
                  }
                >
                  <option>in</option>
                  <option>mm</option>
                  <option>ft</option>
                </select>
              </div>
            </label>
          ))}
        </div>
        <div className="form-row three">
          <label className="field">
            Quantity (sheets)
            <input
              type="number"
              min="1"
              step="1"
              value={spec.quantity ?? ""}
              onChange={(e) => {
                update(
                  "quantity",
                  e.target.value ? Number(e.target.value) : null,
                );
                update("quantityUnit", "sheet");
              }}
            />
          </label>
          <label className="field">
            Finish
            <input
              value={spec.finish || ""}
              placeholder="Not specified"
              onChange={(e) => update("finish", e.target.value || null)}
            />
          </label>
          <label className="field">
            Standard
            <input
              value={spec.standard || ""}
              placeholder="Not requested"
              onChange={(e) => update("standard", e.target.value || null)}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            Country-of-origin restriction
            <input
              value={spec.origin || ""}
              placeholder="Not requested"
              onChange={(e) => update("origin", e.target.value || null)}
            />
          </label>
          <label className="checkbox-label mtr-check">
            <input
              type="checkbox"
              checked={spec.mtr}
              onChange={(e) => update("mtr", e.target.checked)}
            />
            MTR required
          </label>
        </div>
        {clarify && (
          <div className="confirm-fields">
            <strong>Confirm each field group against the buyer’s reply</strong>
            <div>
              {groups.map((g) => (
                <label key={g} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={checks.includes(g)}
                    onChange={(e) =>
                      setChecks(
                        e.target.checked
                          ? [...checks, g]
                          : checks.filter((c) => c !== g),
                      )
                    }
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
        )}
        <ErrorMessage message={error} />
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={
            busy ||
            (clarify && (!reply.trim() || checks.length !== groups.length))
          }
          onClick={() => void save()}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{" "}
          {clarify ? "Apply clarification" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
export function EvidenceDialog({
  evidence,
  onClose,
  onReview,
  busy,
}: {
  evidence: Evidence;
  onClose: () => void;
  onReview: () => void;
  busy: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal
      title="Supporting record"
      subtitle={`${evidence.sku} · lot ${evidence.lot}`}
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="demo-inline">
          <FlaskConical size={15} />
          DEMO — NOT A REAL CERTIFICATE
        </div>
        <pre className="evidence-document">{evidence.content}</pre>
        <Status
          status={
            evidence.reviewed ? "Reviewed" : "Supplier confirmation needed"
          }
        />
        {!evidence.reviewed && (
          <label className="checkbox-label evidence-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the product, lot, and requested requirements in this
            synthetic record.
          </label>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
        {!evidence.reviewed && (
          <button
            className="button primary"
            disabled={!confirmed || busy}
            onClick={onReview}
          >
            <CheckCircle2 size={16} />
            Confirm evidence review
          </button>
        )}
      </div>
    </Modal>
  );
}
export function QuoteDialog({
  w,
  quote,
  onClose,
  onApprove,
  onReviewItems,
  onTerms,
  busy,
}: {
  w: Workspace;
  quote: QuoteSnapshot;
  onClose: () => void;
  onApprove: (name: string) => Promise<void>;
  onReviewItems: () => void;
  onTerms: () => void;
  busy: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [reviewer, setReviewer] = useState("Local reviewer"),
    [error, setError] = useState("");
  const approved = quote.status === "APPROVED";
  return (
    <Modal
      title="Quote preview"
      subtitle={
        approved
          ? "Immutable approved snapshot. Exporting does not deliver this quote."
          : "Customer-facing draft. Internal costs and markup are excluded."
      }
      onClose={onClose}
      wide
    >
      <div className="quote-toolbar no-print">
        <span className={`quote-state ${approved ? "approved" : ""}`}>
          {approved ? <ShieldCheck size={14} /> : <FileText size={14} />}{" "}
          {quote.status} · VERSION {quote.revision}
        </span>
        <div className="button-group">
          <a
            className="button secondary small"
            href={`/api/rfqs/${w.rfq.id}/export${approved ? `?version=${encodeURIComponent(quote.id)}` : ""}`}
          >
            <Download size={14} />
            Export CSV
          </a>
          <button
            className="button secondary small"
            onClick={() => window.print()}
          >
            <Printer size={14} />
            Print / save as PDF
          </button>
        </div>
      </div>
      <div className="quote-paper">
        <div className="quote-brand">
          <div>
            <span className="quote-wordmark">
              <span className="northline-logo">N</span>NORTHLINE
              <span>METALS</span>
            </span>
            <p>Industrial materials. Precisely supplied.</p>
          </div>
          <div className="quote-heading">
            <h2>QUOTATION</h2>
            <span>{quote.id}</span>
            {!approved && <b>DRAFT</b>}
          </div>
        </div>
        <div className="quote-demo">
          DEMONSTRATION QUOTE · SYNTHETIC PRODUCTS, PRICES & RECORDS
        </div>
        <div className="quote-parties">
          <div>
            <small>PREPARED FOR</small>
            <h3>{quote.customer}</h3>
            <p>{quote.contact}</p>
          </div>
          <div>
            <small>QUOTE DETAILS</small>
            <p>Issued {shortDate(quote.issuedAt)}</p>
            <p>Valid for {quote.validityDays} days · USD</p>
            <p>
              {quote.partial
                ? "Partial quote · exclusions below"
                : "Stainless steel sheet quotation"}
            </p>
          </div>
        </div>
        <table className="quote-table">
          <thead>
            <tr>
              <th>Item / description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l) => (
              <tr key={l.number}>
                <td>
                  <strong>
                    {String(l.number).padStart(2, "0")} &nbsp; {l.description}
                  </strong>
                  <small>{l.sku || "Catalog match unresolved"}</small>
                  {!!l.documentation.length && (
                    <small>Documentation: {l.documentation.join(", ")}</small>
                  )}
                </td>
                <td>
                  {l.quantity ?? "—"}
                  <small>{l.unit}s</small>
                </td>
                <td>{money(l.unitPriceCents)}</td>
                <td>{money(l.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="quote-subtotal">
          <span>Priced subtotal</span>
          <strong>{money(quote.pricedSubtotalCents)}</strong>
        </div>
        <p className="quote-total-note">
          Freight, applicable tax, and additional processing are excluded. This
          is not a final delivered total.
        </p>
        <div className="quote-terms">
          <h3>Commercial terms</h3>
          {[
            ["Shipping", quote.terms.shipping],
            ["Tax", quote.terms.tax],
            ["Processing", quote.terms.processing],
            ["Delivery", quote.terms.delivery],
          ].map(([k, v]) => (
            <div key={k}>
              <strong>{k}</strong>
              <p>{v}</p>
            </div>
          ))}
        </div>
        {!!quote.exclusions.length && (
          <div className="quote-exclusions">
            <h3>Excluded items · partial quote</h3>
            {quote.exclusions.map((e) => (
              <p key={e.number}>
                Item {e.number}: {e.description} — {e.reason}
              </p>
            ))}
          </div>
        )}
        {!!quote.unresolved.length && (
          <div className="quote-unresolved">
            <h3>Unresolved items in this draft</h3>
            {quote.unresolved.map((u, i) => (
              <p key={i}>{u}</p>
            ))}
          </div>
        )}
        <div className="quote-footnote">
          Northline Metals · Synthetic supplier for QuoteGuard demonstrations
          <br />
          Approval does not reserve stock. Export does not constitute delivery
          to the buyer.
        </div>
      </div>
      {!approved && (
        <div className="approval-panel no-print">
          <div className="section-caption spread">
            <h3>
              <ShieldCheck size={16} />
              Human approval
            </h3>
            <button className="text-button" onClick={onTerms}>
              Edit terms
            </button>
          </div>
          {w.approvalBlockers.length ? (
            <>
              <p>
                {w.approvalBlockers.length} check
                {w.approvalBlockers.length === 1 ? "" : "s"} must be resolved
                before approval.
              </p>
              <ul>
                {w.approvalBlockers.slice(0, 5).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <label className="field">
                Reviewer name
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm the item reviews and commercial conditions, and
                approve this {quote.demo ? "demonstration " : ""}quote.
              </label>
            </>
          )}
          <ErrorMessage message={error} />
        </div>
      )}
      <div className="modal-footer no-print">
        <span className="microcopy">
          {approved
            ? "Approved snapshot preserved."
            : "Draft exports are clearly labeled."}
        </span>
        <div className="button-group">
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
          {!approved &&
            (w.approvalBlockers.length ? (
              <button className="button primary" onClick={onReviewItems}>
                Review items
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!confirmed || reviewer.trim().length < 2 || busy}
                onClick={async () => {
                  try {
                    await onApprove(reviewer);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <ShieldCheck size={16} />
                Approve quote
              </button>
            ))}
        </div>
      </div>
    </Modal>
  );
}
