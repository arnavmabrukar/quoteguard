"use client";
import { parseSpec } from "@/domain/extract-demo";
import { sampleReply, sampleText } from "@/domain/fixtures";
import type {
  Evidence,
  LineView,
  QuoteSnapshot,
  Spec,
  Workspace,
} from "@/domain/types";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Mail,
  Printer,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";
import { ErrorMessage, Modal, Status } from "./ui";
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
    [inputMethod, setInputMethod] = useState<"text" | "file">("text");
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
          title: title.trim() || `${customer.trim()} quote`,
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
      title={catalogMode ? "Add materials" : "Start a new quote"}
      subtitle={
        catalogMode
          ? "Preview your CSV and map the catalog fields."
          : "Add the customer’s request. We’ll organize the items for you to check."
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="demo-inline">
          <FlaskConical size={14} />
          <span>
            Prototype · use sample requests. Prices and stock are examples.
          </span>
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
              Quote name (optional)
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stainless steel sheets"
              />
            </label>
          </div>
        )}
        {!catalogMode && (
          <div className="import-methods" aria-label="How to add your request">
            <button
              className={inputMethod === "text" ? "active" : ""}
              disabled={busy}
              aria-pressed={inputMethod === "text"}
              onClick={() => {
                setInputMethod("text");
                setFile(null);
              }}
            >
              Paste text
            </button>
            <button
              className={inputMethod === "file" ? "active" : ""}
              disabled={busy}
              aria-pressed={inputMethod === "file"}
              onClick={() => setInputMethod("file")}
            >
              Upload a file
            </button>
          </div>
        )}
        {(catalogMode || inputMethod === "file") && (
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
            <strong>{file ? file.filename : "Choose a file"}</strong>
            <span>
              {catalogMode
                ? "CSV · up to 4 MB"
                : "PDF with selectable text, Excel, CSV or TXT · up to 4 MB. Photos and scanned PDFs aren’t supported."}
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
        )}
        {!catalogMode && inputMethod === "text" && (
          <>
            <label className="field">
              <span className="sr-only">Customer request</span>
              <textarea
                rows={5}
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
                Use a sample request
              </button>
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
        <ErrorMessage message={error} />
        <div className="info-note">
          <ShieldCheck size={15} />
          <p>
            {catalogMode
              ? "Imports add new SKUs. Existing catalog items cannot be overwritten through this importer."
              : "Include the material, dimensions and quantity. We’ll flag anything missing so you can confirm it."}
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <div className="button-group">
          <button
            className="button primary"
            disabled={
              busy ||
              (catalogMode
                ? !rows.length
                : !customer.trim() ||
                  (inputMethod === "file" && !file) ||
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
                : "Check my request"}
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
          ? `Confirm details for item ${line.number}`
          : `Edit item ${String(line.number).padStart(2, "0")}`
      }
      subtitle={
        clarify
          ? "Check the customer’s reply, then confirm the missing details."
          : "Changes update the price. You’ll need to check the item again."
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        {clarify && (
          <>
            <details className="item-details-disclosure">
              <summary>Need to ask the customer? Copy a draft email</summary>
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
            </details>
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
              Fill details from reply
            </button>
            <hr />
          </>
        )}
        <div className="section-caption">
          <h3>{clarify ? "Check these details" : "Item specifications"}</h3>
          <span className="mini-label">Missing information stays blank</span>
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
            Material test report (MTR) required
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
          {clarify ? "Save confirmed details" : "Save changes"}
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
          ? "Your approved quote is saved. Download it to share with your customer."
          : "Check what your customer will see before you approve."
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
            Download spreadsheet
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
              Final check
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
            ? "Approved copy saved."
            : "Downloaded drafts are marked as drafts."}
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
