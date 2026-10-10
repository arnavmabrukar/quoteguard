"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileText,
  Hammer,
  Layers3,
  Loader2,
  Mail,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  costModel,
  landedCost,
  offerProblems,
  defaultOperations,
  type Project,
  type ProjectCommand,
  type SupplierOffer,
  type Operation,
} from "@/domain/project";
import type { Workspace } from "@/domain/types";
import { specDescription } from "@/domain/match-catalog";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { ErrorMessage, Modal, Status } from "./ui";

export type Stage = "Quote" | "Source" | "Plan" | "Make";
export function ProjectStages({
  stage,
  onChange,
}: {
  stage: Stage;
  onChange: (s: Stage) => void;
}) {
  return (
    <nav className="project-stages" aria-label="Project workflow">
      {(
        [
          { name: "Quote", icon: FileText },
          { name: "Source", icon: Truck },
          { name: "Plan", icon: Settings2 },
          { name: "Make", icon: Hammer },
        ] as const
      ).map(({ name, icon: Icon }) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          aria-current={stage === name ? "step" : undefined}
          className={stage === name ? "active" : ""}
        >
          <Icon size={17} />
          {name}
        </button>
      ))}
    </nav>
  );
}
export function ProjectWorkflow({
  w,
  stage,
  onQuote,
}: {
  w: Workspace;
  stage: Exclude<Stage, "Quote">;
  onQuote: () => void;
}) {
  const [p, setP] = useState<Project | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    setP(null);
    api<Project>(`rfqs/${w.rfq.id}/project`)
      .then((x) => {
        if (live) setP(x);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [w.rfq.id, w.rfq.revision]);
  async function save(command: ProjectCommand) {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Project>(`rfqs/${w.rfq.id}/project`, {
        expectedRevision: p.revision,
        rfqRevision: w.rfq.revision,
        command,
      });
      setP(result);
      setNotice(result.activity[0]?.detail || "Saved");
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="project-workflow">
      <ErrorMessage message={error} />
      {error && (
        <button
          className="text-button"
          onClick={() => {
            setError("");
            void api<Project>(`rfqs/${w.rfq.id}/project`)
              .then(setP)
              .catch((e) => setError(e.message));
          }}
        >
          Refresh project
        </button>
      )}
      {notice && (
        <div className="saved-notice" role="status">
          <CheckCircle2 size={15} />
          {notice}
        </div>
      )}
      {!p ? (
        <div className="loading-inline">
          <Loader2 size={20} className="spin" />
          Loading project…
        </div>
      ) : (
        <>
          {stage === "Source" && (
            <SourceWorkspace w={w} p={p} save={save} busy={busy} />
          )}
          {stage === "Plan" && (
            <PlanWorkspace
              key={`${w.rfq.id}-${p.planVersion}`}
              w={w}
              p={p}
              save={save}
              busy={busy}
            />
          )}
          {stage === "Make" && (
            <MakeWorkspace
              w={w}
              p={p}
              save={save}
              busy={busy}
              onQuote={onQuote}
            />
          )}
          <ProjectFind w={w} p={p} />
          <section className="project-history">
            <h3>Project activity</h3>
            {p.activity.length ? (
              p.activity.slice(0, 4).map((a) => (
                <p key={a.id}>
                  <Check size={13} />
                  {a.detail}
                </p>
              ))
            ) : (
              <p>Saved project actions will appear here.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
type Props = {
  w: Workspace;
  p: Project;
  save: (c: ProjectCommand) => Promise<Project | undefined>;
  busy: boolean;
};
function SourceWorkspace({ w, p, save, busy }: Props) {
  const [lineId, setLineId] = useState(
      w.lines.find((l) => !l.excluded)?.id || "",
    ),
    [sort, setSort] = useState("landed"),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState(false),
    [supplier, setSupplier] = useState("Northline Supply"),
    [copied, setCopied] = useState(false);
  const l = w.lines.find((l) => l.id === lineId);
  const offers = p.offers
    .filter((o) => o.lineId === lineId)
    .sort((a, b) =>
      sort === "lead"
        ? a.leadDays - b.leadDays
        : landedCost(a, l?.spec.quantity || 0) -
          landedCost(b, l?.spec.quantity || 0),
    );
  const eligible = offers.filter(
    (o) =>
      !offerProblems(o, l?.spec.quantity ?? null, undefined, l?.spec).length,
  );
  const best = eligible.length
    ? eligible.reduce((a, b) =>
        landedCost(a, l?.spec.quantity || 0) <
        landedCost(b, l?.spec.quantity || 0)
          ? a
          : b,
      ).id
    : null;
  return (
    <>
      <div className="stage-intro">
        <div className="eyebrow">BETTER OPTIONS, CLEARER TRADEOFFS</div>
        <h2>Find the right supplier.</h2>
        <p>Compare cost, lead time, and availability for each item.</p>
      </div>
      <div className="stage-actions">
        <button
          className="button primary"
          onClick={() => setAdding(true)}
          disabled={!l}
        >
          <Plus size={16} />
          Add supplier offer
        </button>
        <button className="button secondary" onClick={() => setDraft(true)}>
          <Mail size={16} />
          Draft request
        </button>
      </div>
      <div className="source-selector">
        <label className="field">
          Requested item
          <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {w.lines
              .filter((l) => !l.excluded)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  Item {l.number} · {l.spec.grade || "Unspecified"} ·{" "}
                  {l.spec.quantity ?? "?"} sheets
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Compare by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="landed">Total landed cost</option>
            <option value="lead">Fastest delivery</option>
          </select>
        </label>
      </div>
      {l && (
        <div className="source-request">
          <Layers3 size={17} />
          <div>
            <strong>{specDescription(l.spec)}</strong>
            <span>
              {l.spec.quantity ?? "Unconfirmed"} sheets ·{" "}
              {l.spec.standard || "Standard not specified"} ·{" "}
              {l.spec.mtr ? "MTR required" : "No MTR requested"}
            </span>
          </div>
        </div>
      )}
      <div className="offers-grid">
        {offers.map((o) => {
          const problems = offerProblems(
              o,
              l?.spec.quantity ?? null,
              undefined,
              l?.spec,
            ),
            selected = p.selected[lineId] === o.id;
          return (
            <article
              className={`offer-card ${selected ? "selected" : ""}`}
              key={o.id}
            >
              <header>
                <span className="supplier-avatar">
                  {o.supplier
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <h3>{o.supplier}</h3>
                  <p>{o.source}</p>
                </div>
                {best === o.id && (
                  <span className="best-offer">Lowest cost</span>
                )}
              </header>
              <div className="offer-price">
                <strong>{money(o.unitCents)}</strong>
                <span>/ sheet</span>
              </div>
              <dl>
                <div>
                  <dt>
                    <Truck size={14} />
                    Lead time
                  </dt>
                  <dd>{o.leadDays} business days</dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>{o.available} sheets</dd>
                </div>
                <div>
                  <dt>Minimum</dt>
                  <dd>{o.minimum} sheets</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>{money(o.shippingCents)}</dd>
                </div>
                <div className="landed">
                  <dt>Landed total</dt>
                  <dd>
                    {l?.spec.quantity
                      ? money(landedCost(o, l.spec.quantity))
                      : "Confirm quantity"}
                  </dd>
                </div>
              </dl>
              <p className="offer-reference">
                {o.reference}
                <br />
                Valid through {o.expires}
              </p>
              <p className="offer-note">{o.notes}</p>
              <div className="offer-verified">
                <ShieldCheck size={14} />
                {o.verified
                  ? "Specification reviewed by you"
                  : "Specification review needed"}
              </div>
              {problems.length > 0 && (
                <p className="offer-problems">{problems.join(" · ")}</p>
              )}
              <button
                className={`button full ${selected ? "secondary" : "primary"}`}
                disabled={busy || problems.length > 0 || selected}
                onClick={() =>
                  void save({
                    action: "select-offer",
                    lineId,
                    offerId: o.id,
                  }).catch(() => {})
                }
              >
                {selected ? (
                  <>
                    <CheckCircle2 size={16} />
                    Selected for estimate
                  </>
                ) : (
                  <>
                    Use in estimate
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
      {!offers.length && (
        <div className="project-empty">
          <Truck size={30} />
          <h3>No offers for this item yet</h3>
          <p>Add a supplier response or draft a request for pricing.</p>
        </div>
      )}
      <p className="stage-disclaimer">
        Demo supplier data. Landed totals include the entered shipping amount
        for this line, exclude tax, and do not reserve stock. Offer selections
        update the planning estimate; material quote approval still requires
        exact matching and evidence.
      </p>
      <section className="panel outreach-panel">
        <div className="panel-heading">
          <h2>
            Supplier requests <span>{p.outreach.length}</span>
          </h2>
          <span>Drafts only</span>
        </div>
        {p.outreach.length ? (
          p.outreach.map((d) => (
            <details key={d.id}>
              <summary>
                <Mail size={16} />
                <div>
                  <strong>{d.supplier}</strong>
                  <span>
                    Saved draft · {new Date(d.at).toLocaleDateString()}
                  </span>
                </div>
                <ChevronRight size={16} />
              </summary>
              <pre>{d.body}</pre>
              <button
                className="button secondary small"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(d.body)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy draft"}
              </button>
            </details>
          ))
        ) : (
          <p className="empty-copy">
            Draft your first request. Email sending is not connected.
          </p>
        )}
      </section>
      {adding && l && (
        <OfferDialog
          lineId={lineId}
          onClose={() => setAdding(false)}
          onSave={async (offer) => {
            await save({ action: "offer", offer });
            setAdding(false);
          }}
          busy={busy}
        />
      )}
      {draft && (
        <Modal
          title="Draft a supplier request"
          subtitle="Uses the current material list and documentation requirements."
          onClose={() => setDraft(false)}
        >
          <div className="modal-body">
            <label className="field">
              Supplier name
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </label>
            <div className="callout neutral">
              <Mail size={20} />
              <p>
                This creates a saved draft for your review. Nothing is sent to a
                supplier.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDraft(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || supplier.trim().length < 2}
              onClick={() =>
                void save({ action: "draft", supplier })
                  .then(() => setDraft(false))
                  .catch(() => {})
              }
            >
              Create draft
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function OfferDialog({
  lineId,
  onClose,
  onSave,
  busy,
}: {
  lineId: string;
  onClose: () => void;
  onSave: (o: SupplierOffer) => Promise<void>;
  busy: boolean;
}) {
  const [f, setF] = useState({
      supplier: "",
      price: "",
      shipping: "0",
      available: "",
      minimum: "1",
      lead: "",
      source: "Manual" as SupplierOffer["source"],
      reference: "",
      notes: "",
      expires: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      verified: false,
    }),
    [error, setError] = useState(""),
    [text, setText] = useState("");
  const update = (k: string, v: string | boolean) => setF({ ...f, [k]: v });
  function parse() {
    const price = text.match(/(?:USD\s*|\$)(\d+(?:\.\d{1,2})?)/i),
      lead = text.match(/(\d+)\s*(?:business\s*)?days/i),
      stock = text.match(/(?:stock|available)\s*[:=]?\s*(\d+)/i),
      name = text.match(/supplier\s*:\s*([^\n]+)/i);
    setF({
      ...f,
      price: price?.[1] || f.price,
      lead: lead?.[1] || f.lead,
      available: stock?.[1] || f.available,
      supplier: name?.[1]?.trim() || f.supplier,
      reference: text.slice(0, 500),
    });
  }
  return (
    <Modal
      title="Add a supplier offer"
      subtitle="Record and review a response before comparing it."
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <details className="offer-paste">
          <summary>Paste a supplier response</summary>
          <textarea
            rows={4}
            placeholder={
              "Supplier: Example Metals\nUSD 110.00 per sheet. Available: 50. Lead time: 5 days."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="button secondary small"
            disabled={!text.trim()}
            onClick={parse}
          >
            Extract explicit values
          </button>
          <p>Simple text extraction; verify every field below.</p>
        </details>
        <label className="field">
          Supplier name
          <input
            value={f.supplier}
            onChange={(e) => update("supplier", e.target.value)}
            required
          />
        </label>
        <div className="form-row">
          <label className="field">
            Unit price (USD)
            <input
              type="number"
              min=".01"
              step=".01"
              value={f.price}
              onChange={(e) => update("price", e.target.value)}
            />
          </label>
          <label className="field">
            Shipping for this line (USD)
            <input
              type="number"
              min="0"
              step=".01"
              value={f.shipping}
              onChange={(e) => update("shipping", e.target.value)}
            />
          </label>
        </div>
        <div className="form-row three">
          <label className="field">
            Available quantity
            <input
              type="number"
              min="0"
              value={f.available}
              onChange={(e) => update("available", e.target.value)}
            />
          </label>
          <label className="field">
            Minimum quantity
            <input
              type="number"
              min="1"
              value={f.minimum}
              onChange={(e) => update("minimum", e.target.value)}
            />
          </label>
          <label className="field">
            Lead time (days)
            <input
              type="number"
              min="0"
              value={f.lead}
              onChange={(e) => update("lead", e.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            Price source
            <select
              value={f.source}
              onChange={(e) => update("source", e.target.value)}
            >
              {["Manual", "Historical", "Contract"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Valid through
            <input
              type="date"
              value={f.expires}
              onChange={(e) => update("expires", e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          Source reference
          <textarea
            rows={2}
            value={f.reference}
            onChange={(e) => update("reference", e.target.value)}
            placeholder="Email date, document reference, or quote number"
          />
        </label>
        <label className="field">
          Commercial notes
          <textarea
            rows={2}
            value={f.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>
        <label className="project-checkbox">
          <input
            type="checkbox"
            checked={f.verified}
            onChange={(e) => update("verified", e.target.checked)}
          />
          I checked that this offer refers to the requested specification.
        </label>
        <ErrorMessage message={error} />
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            try {
              if (!f.price || !f.available || !f.lead)
                throw new Error(
                  "Enter a price, available quantity, and lead time.",
                );
              await onSave({
                id: crypto.randomUUID(),
                lineId,
                supplier: f.supplier,
                unitCents: Math.round(Number(f.price) * 100),
                shippingCents: Math.round(Number(f.shipping) * 100),
                available: Number(f.available),
                minimum: Number(f.minimum),
                leadDays: Number(f.lead),
                source: f.source,
                reference: f.reference,
                notes: f.notes,
                verified: f.verified,
                expires: f.expires,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save offer
        </button>
      </div>
    </Modal>
  );
}
function PlanWorkspace({ w, p, save, busy }: Props) {
  const [ops, setOps] = useState(p.operations),
    [overhead, setOverhead] = useState(p.overheadBps / 100),
    [margin, setMargin] = useState(p.marginBps / 100),
    [edit, setEdit] = useState<Operation | null>(null),
    [error, setError] = useState("");
  const valid =
    Number.isFinite(overhead) &&
    overhead >= 0 &&
    overhead <= 100 &&
    Number.isFinite(margin) &&
    margin >= 0 &&
    margin <= 90;
  const model = costModel(w, {
    ...p,
    operations: ops,
    overheadBps: valid ? Math.round(overhead * 100) : 0,
    marginBps: valid ? Math.round(margin * 100) : 0,
  });
  const dirty =
    JSON.stringify(ops) !== JSON.stringify(p.operations) ||
    Math.round(overhead * 100) !== p.overheadBps ||
    Math.round(margin * 100) !== p.marginBps;
  return (
    <>
      <div className="stage-intro">
        <div className="eyebrow">KNOW WHAT THE JOB TAKES</div>
        <h2>A plan behind every price.</h2>
        <p>Review operations, account for overhead, and model your margin.</p>
      </div>
      <div className="plan-grid">
        <section className="panel operations-panel">
          <div className="panel-heading">
            <h2>Labor estimate</h2>
            <span>{model.units} units</span>
          </div>
          {ops.map((o, i) => (
            <button
              className="operation-row"
              key={o.id}
              onClick={() => setEdit(o)}
            >
              <span className="operation-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{o.name}</h3>
                <p>
                  {o.setupMinutes} min setup + {o.minutesPerUnit} min / unit
                </p>
                <span>
                  {o.tool} · {money(o.hourlyCents)} / hour
                </span>
              </div>
              <div className="operation-cost">
                <strong>{money(model.labor[i].cents)}</strong>
                <small>{(model.labor[i].minutes / 60).toFixed(1)} hours</small>
                <ChevronRight size={15} />
              </div>
            </button>
          ))}
          <button
            className="text-button add-operation"
            onClick={() =>
              setEdit({
                id: crypto.randomUUID(),
                name: "",
                setupMinutes: 0,
                minutesPerUnit: 1,
                hourlyCents: 5000,
                tool: "",
                instruction: "",
              })
            }
          >
            <Plus size={15} />
            Add operation
          </button>
          <div className="labor-total">
            <span>
              <Clock3 size={16} />
              {(model.minutes / 60).toFixed(1)} estimated labor hours
            </span>
            <strong>{money(model.laborCents)}</strong>
          </div>
        </section>
        <section className="panel estimate-panel">
          <h3>Job estimate</h3>
          <p>
            {model.covered} of {model.total} materials costed
          </p>
          <div className="coverage-track">
            <span
              style={{
                width: `${model.total ? (model.covered / model.total) * 100 : 0}%`,
              }}
            />
          </div>
          <dl>
            <div>
              <dt>Materials & selected shipping</dt>
              <dd>{money(model.materialCents)}</dd>
            </div>
            <div>
              <dt>Labor</dt>
              <dd>{money(model.laborCents)}</dd>
            </div>
            <div>
              <dt>Overhead</dt>
              <dd>{money(model.overheadCents)}</dd>
            </div>
            <div className="estimate-cost">
              <dt>Estimated cost</dt>
              <dd>{money(model.totalCents)}</dd>
            </div>
          </dl>
          <div className="form-row">
            <label className="field">
              Overhead on cost (%)
              <input
                type="number"
                min="0"
                max="100"
                step=".01"
                value={overhead}
                onChange={(e) => setOverhead(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Target gross margin (%)
              <input
                type="number"
                min="0"
                max="90"
                step=".01"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="estimate-selling">
            <span>Modeled selling price</span>
            <strong>{money(model.sellingCents)}</strong>
            <small>{money(model.profitCents)} estimated gross profit</small>
          </div>
          {model.covered < model.total && (
            <p className="offer-problems">
              Incomplete estimate: unresolved materials are excluded.
            </p>
          )}
          <ErrorMessage message={error} />
          <button
            className="button primary full"
            disabled={busy || !dirty || !valid}
            onClick={() =>
              void save({
                action: "plan",
                operations: ops,
                overheadBps: Math.round(overhead * 100),
                marginBps: Math.round(margin * 100),
              }).catch((e) => setError(e.message))
            }
          >
            {dirty ? "Save estimate" : "Estimate saved"}
            <CheckCircle2 size={16} />
          </button>
          <button
            className="button secondary full"
            disabled={dirty}
            onClick={() =>
              download(`internal-estimate-${w.rfq.id}.json`, {
                label: "INTERNAL PLANNING ESTIMATE — NOT A CUSTOMER QUOTE",
                rfqId: w.rfq.id,
                rfqRevision: w.rfq.revision,
                projectRevision: p.revision,
                currency: "USD",
                demo: true,
                model,
                operations: p.operations,
                overheadBps: p.overheadBps,
                marginBps: p.marginBps,
              })
            }
          >
            <Download size={15} />
            Export cost worksheet
          </button>
        </section>
      </div>
      <p className="stage-disclaimer">
        Sample labor assumptions are editable estimates. Overhead applies to
        materials plus labor; gross margin uses price = cost ÷ (1 − margin).
        This internal model is separate from the reviewed material quote and
        excludes tax. Save changes before generating instructions.
      </p>
      {edit && (
        <OperationDialog
          value={edit}
          onClose={() => setEdit(null)}
          onSave={(o) => {
            setOps(
              ops.some((x) => x.id === o.id)
                ? ops.map((x) => (x.id === o.id ? o : x))
                : [...ops, o],
            );
            setEdit(null);
          }}
          onRemove={
            ops.length > 1 && ops.some((o) => o.id === edit.id)
              ? () => {
                  setOps(ops.filter((o) => o.id !== edit.id));
                  setEdit(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
function OperationDialog({
  value,
  onClose,
  onSave,
  onRemove,
}: {
  value: Operation;
  onClose: () => void;
  onSave: (o: Operation) => void;
  onRemove?: () => void;
}) {
  const [o, setO] = useState(value),
    [error, setError] = useState("");
  return (
    <Modal
      title="Edit operation"
      subtitle="These reviewed steps become your draft work instructions."
      onClose={onClose}
    >
      <div className="modal-body">
        <label className="field">
          Operation name
          <input
            value={o.name}
            onChange={(e) => setO({ ...o, name: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label className="field">
            Setup (minutes)
            <input
              type="number"
              min="0"
              value={o.setupMinutes}
              onChange={(e) =>
                setO({ ...o, setupMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Per unit (minutes)
            <input
              type="number"
              min="0"
              step=".1"
              value={o.minutesPerUnit}
              onChange={(e) =>
                setO({ ...o, minutesPerUnit: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label className="field">
          Hourly rate (USD)
          <input
            type="number"
            min=".01"
            step=".01"
            value={o.hourlyCents / 100}
            onChange={(e) =>
              setO({
                ...o,
                hourlyCents: Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </label>
        <label className="field">
          Reviewed tool or reference
          <input
            value={o.tool}
            onChange={(e) => setO({ ...o, tool: e.target.value })}
          />
        </label>
        <label className="field">
          Work instruction
          <textarea
            rows={5}
            value={o.instruction}
            onChange={(e) => setO({ ...o, instruction: e.target.value })}
          />
        </label>
        <ErrorMessage message={error} />
      </div>
      <div className="modal-footer">
        {onRemove && (
          <button className="text-button" onClick={onRemove}>
            Remove operation
          </button>
        )}
        <button
          className="button primary"
          onClick={() => {
            if (
              o.name.trim().length < 2 ||
              o.tool.trim().length < 2 ||
              o.instruction.trim().length < 10 ||
              o.setupMinutes < 0 ||
              o.minutesPerUnit < 0 ||
              o.hourlyCents <= 0
            ) {
              setError(
                "Provide an operation, reference, instruction, and valid positive rate.",
              );
              return;
            }
            onSave(o);
          }}
        >
          Apply to estimate
        </button>
      </div>
    </Modal>
  );
}
function MakeWorkspace({
  w,
  p,
  save,
  busy,
  onQuote,
}: Props & { onQuote: () => void }) {
  const [pendingStep, setPendingStep] = useState<{
    id: string;
    completed: boolean;
  } | null>(null);
  const [review, setReview] = useState(false),
    [reviewer, setReviewer] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const fresh =
    p.instructionRfqRevision === w.rfq.revision &&
    p.instructionPlanVersion === p.planVersion;
  const released = !!p.instructionReviewer && fresh && !!w.rfq.approvedVersion;
  const complete = p.instructions.filter((s) => s.completed).length;
  return (
    <>
      <div className="stage-intro">
        <div className="eyebrow">FROM APPROVED QUOTE TO HANDOFF</div>
        <h2>Clear steps. Confident work.</h2>
        <p>Build a reviewed checklist from the operations in your plan.</p>
      </div>
      <div className="make-status">
        <span className="make-status-icon">
          <ClipboardCheck size={27} />
        </span>
        <div>
          <h3>
            {released
              ? `${complete} of ${p.instructions.length} steps complete`
              : p.instructions.length
                ? "Instructions need review"
                : "Your work pack starts here"}
          </h3>
          <p>
            {released
              ? `Reviewed by ${p.instructionReviewer}`
              : !w.rfq.approvedVersion
                ? "Approve the material quote before releasing instructions."
                : "Generate and review instructions for the current job."}
          </p>
        </div>
        <Status status={released ? "Approved" : "Draft"} />
      </div>
      <div className="stage-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void save({ action: "instructions" }).catch(() => {})}
        >
          <Plus size={16} />
          {p.instructions.length ? "Regenerate draft" : "Generate instructions"}
        </button>
        {p.instructions.length > 0 && (
          <button
            className="button secondary"
            disabled={!fresh || !w.rfq.approvedVersion || released || busy}
            onClick={() => setReview(true)}
          >
            <ShieldCheck size={16} />
            Review & release
          </button>
        )}
      </div>
      {!w.rfq.approvedVersion && (
        <button className="text-button" onClick={onQuote}>
          Return to quote review
          <ArrowRight size={15} />
        </button>
      )}
      {p.instructions.length > 0 && !fresh && (
        <div className="callout warning">
          <Clock3 size={18} />
          <p>
            The RFQ or labor plan changed. Regenerate instructions before
            continuing.
          </p>
        </div>
      )}
      <div className="instruction-list">
        {p.instructions.map((s, i) => (
          <article
            className={`instruction-card ${s.completed ? "complete" : ""}`}
            key={s.id}
          >
            <div className="instruction-number">
              {s.completed ? (
                <Check size={20} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </div>
            <div>
              <div className="instruction-heading">
                <h3>{s.title}</h3>
                <span>{s.completed ? "Complete" : `STEP ${i + 1}`}</span>
              </div>
              <p>{s.body}</p>
              <div className="instruction-tool">
                <Hammer size={14} />
                {s.tool}
              </div>
              <label className="project-checkbox">
                <input
                  type="checkbox"
                  checked={
                    pendingStep?.id === s.id
                      ? pendingStep.completed
                      : s.completed
                  }
                  disabled={!released || busy}
                  onChange={(e) => {
                    const completed = e.target.checked;
                    setPendingStep({ id: s.id, completed });
                    void save({ action: "step", id: s.id, completed })
                      .catch(() => {})
                      .finally(() => setPendingStep(null));
                  }}
                />
                {s.completed ? "Step completed" : "Mark step complete"}
              </label>
            </div>
          </article>
        ))}
      </div>
      {p.instructions.length > 0 && (
        <button
          className="button secondary"
          onClick={() =>
            download(`work-pack-${w.rfq.id}.json`, {
              label: released
                ? "REVIEWED DEMO WORK PACK"
                : "DRAFT — NOT RELEASED",
              rfqId: w.rfq.id,
              rfqRevision: w.rfq.revision,
              materialQuote: w.rfq.approvedVersion,
              planVersion: p.planVersion,
              reviewer: released ? p.instructionReviewer : null,
              operations: p.instructions,
              materials: w.quote.lines,
            })
          }
        >
          <Download size={16} />
          Export work pack
        </button>
      )}
      <p className="stage-disclaimer">
        Template-based prototype instructions, not AI-validated manufacturing
        guidance. Use approved procedures and qualified review. Changing the RFQ
        or plan invalidates release; the previous checklist remains visible for
        reference.
      </p>
      {review && (
        <Modal
          title="Review work instructions"
          subtitle="Confirm that the draft is suitable for this demonstration job."
          onClose={() => setReview(false)}
        >
          <div className="modal-body">
            <label className="field">
              Reviewer name
              <input
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
              />
            </label>
            <label className="project-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed every operation, reference, and instruction against the
              approved material quote.
            </label>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setReview(false)}
            >
              Back
            </button>
            <button
              className="button primary"
              disabled={busy || !confirmed || reviewer.trim().length < 2}
              onClick={() =>
                void save({
                  action: "review-instructions",
                  reviewer,
                  confirmed: true,
                })
                  .then(() => setReview(false))
                  .catch(() => {})
              }
            >
              Release demo instructions
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ProjectFind({ w, p }: { w: Workspace; p: Project }) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const docs = [
    ...w.lines.map((l) => ({
      title: `Item ${l.number} · ${specDescription(l.spec)}`,
      body: `${l.original} ${l.blockers.join(" ")} ${l.match?.sku || ""}`,
      source: l.location,
    })),
    ...p.offers.map((o) => ({
      title: o.supplier,
      body: `${o.reference} ${o.notes} ${money(o.unitCents)} ${o.leadDays} days`,
      source: `Supplier offer · ${o.source}`,
    })),
    ...w.history.map((h) => ({
      title: h.action,
      body: h.detail,
      source: `Audit history · revision ${h.revision}`,
    })),
    ...p.operations.map((o) => ({
      title: o.name,
      body: o.instruction,
      source: `Labor plan · ${o.tool}`,
    })),
  ];
  const q = query.trim().toLowerCase();
  const results = q
    ? docs
        .filter((d) => `${d.title} ${d.body}`.toLowerCase().includes(q))
        .slice(0, 8)
    : [];
  return (
    <section className="panel project-find">
      <button
        className="project-find-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Search size={18} />
        <div>
          <strong>Find in this project</strong>
          <span>Materials, supplier references, operations, and history</span>
        </div>
        <ChevronRight size={16} />
      </button>
      {open && (
        <div className="project-find-body">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search project context"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try MTR, 304, or a supplier…"
            />
          </label>
          {results.map((r, i) => (
            <article key={i}>
              <small>{r.source}</small>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </article>
          ))}
          {q && !results.length && (
            <p>
              No matching project records. Try an exact material, supplier, or
              operation name.
            </p>
          )}
          <p className="microcopy">
            Local record search. Results are source excerpts, not AI-generated
            claims.
          </p>
        </div>
      )}
    </section>
  );
}
function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
