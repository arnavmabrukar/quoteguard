"use client";
import { dimensionLabel } from "@/domain/match-catalog";
import type { Evidence, Workspace } from "@/domain/types";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  FlaskConical,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { InstallCard } from "./mobile";
import { Empty, ErrorMessage, Status } from "./ui";
export function RfqList({
  onOpen,
  onNew,
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [rows, setRows] = useState<
    {
      id: string;
      customer: string;
      title: string;
      count: number;
      status: string;
      createdAt: string;
      updatedAt: string;
      subtotalCents: number;
    }[]
  >([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All quotes");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<typeof rows>("rfqs")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const filtered = rows.filter(
    (r) =>
      `${r.customer} ${r.title} ${r.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All quotes" ||
        (filter === "In progress"
          ? r.status !== "Approved"
          : r.status === "Approved")),
  );
  return (
    <div className="quotes-home">
      <section className="start-quote-card">
        <div className="start-quote-copy">
          <p className="eyebrow">LESS PAPERWORK. MORE MAKING.</p>
          <h1>A clear quote starts here.</h1>
          <p>
            Add your customer’s request. We’ll help you check the materials and
            prices, one item at a time.
          </p>
          <div className="start-quote-actions">
            <button className="button primary" onClick={onNew}>
              <Plus size={19} />
              New quote
            </button>
            <button
              className="button secondary"
              onClick={() => onOpen("RFQ-1042")}
            >
              Try a sample quote
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <ol className="start-quote-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Add a request</strong>
              <p>Paste an email or upload a file.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Check the items</strong>
              <p>We point out what needs your attention.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Finish your quote</strong>
              <p>Approve, download and share.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="saved-quotes" aria-label="Saved quotes">
        <div className="simple-section-heading">
          <div>
            <h2>
              Your quotes <span>{rows.length}</span>
            </h2>
            <p>Pick up where you left off.</p>
          </div>
          <span className="saved-browser-note">
            <CheckCircle2 size={15} />
            Saved in this browser
          </span>
        </div>
        <div className="home-list-controls">
          <div className="filter-tabs">
            {["All quotes", "In progress", "Approved"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search quotes"
              placeholder="Find a customer or quote"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <ErrorMessage message={error} />
        <div className="simple-request-list mobile-record-list">
          {filtered.map((r) => (
            <button
              className="simple-request-card"
              key={r.id}
              onClick={() => onOpen(r.id)}
            >
              <div className="request-icon">
                <FileText size={23} />
              </div>
              <div className="request-title">
                <div>
                  <span>{r.customer}</span>
                  {r.id === "RFQ-1042" && (
                    <span className="sample-chip">Sample</span>
                  )}
                </div>
                <h3>{r.title}</h3>
                <p>
                  {r.count} items · {shortDate(r.updatedAt)}
                </p>
              </div>
              <div className="request-amount">
                <Status status={r.status} />
                <strong>{money(r.subtotalCents)}</strong>
                <small>Subtotal so far</small>
              </div>
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
        <div className="table-scroll desktop-record-table">
          <table className="data-table rfq-list">
            <thead>
              <tr>
                <th>Quote / customer</th>
                <th>Items</th>
                <th>Received</th>
                <th>Status</th>
                <th>Priced subtotal</th>
                <th>Last update</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)}>
                  <td>
                    <button
                      className="table-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                    >
                      {r.title}
                    </button>
                    <small>
                      {r.customer} <span className="mono">· {r.id}</span>
                    </small>
                  </td>
                  <td>{r.count}</td>
                  <td>{shortDate(r.createdAt)}</td>
                  <td>
                    <Status status={r.status} />
                  </td>
                  <td className="numeric">{money(r.subtotalCents)}</td>
                  <td>{shortDate(r.updatedAt)}</td>
                  <td>
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <div className="loading-inline">
            <Loader2 className="spin" size={20} />
            Loading your quotes…
          </div>
        ) : (
          !filtered.length && (
            <Empty
              title="No quotes found"
              detail="Try a different search or start a new quote above."
            />
          )
        )}
        <p className="home-save-note">
          Your work saves automatically in this browser. This prototype uses
          sample pricing.
        </p>
      </section>
    </div>
  );
}
export function CatalogPage({
  w,
  onImport,
  onEvidence,
}: {
  w: Workspace;
  onImport: () => void;
  onEvidence: (e: Evidence) => void;
}) {
  const [query, setQuery] = useState(""),
    [grade, setGrade] = useState("All grades");
  const items = w.catalog.filter(
    (c) =>
      `${c.sku} ${c.grade} ${c.finish}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (grade === "All grades" || c.grade === grade),
  );
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">NORTHLINE METALS</div>
          <h1>Materials</h1>
          <p>
            Specifications, availability, and supporting records in one place.
          </p>
        </div>
        <button className="button primary" onClick={onImport}>
          <Upload size={16} />
          Import catalog
        </button>
      </div>
      <div className="catalog-summary">
        <div>
          <Layers3 size={20} />
          <span>
            <strong>{w.catalog.length}</strong> catalog items
          </span>
        </div>
        <div>
          <CheckCircle2 size={19} />
          <span>
            <strong>{w.catalog.filter((c) => c.stock > 0).length}</strong> with
            quoted availability
          </span>
        </div>
        <div>
          <FlaskConical size={18} />
          <span>Synthetic supplier dataset</span>
        </div>
      </div>
      <div className="panel">
        <div className="list-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Search SKU, grade or finish…"
              aria-label="Search catalog"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option>All grades</option>
            {[...new Set(w.catalog.map((c) => c.grade))].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="mobile-record-list">
          {items.map((c) => (
            <article className="mobile-catalog-card" key={c.sku}>
              <div className="mobile-catalog-top">
                <span className="mobile-product-icon">
                  <Layers3 size={24} />
                </span>
                <div>
                  <h3>{c.grade} stainless steel</h3>
                  <p>{c.finish} finish · sheet</p>
                </div>
                <span className="stock-chip">{c.stock} in stock</span>
              </div>
              <p className="mobile-dimensions">
                {dimensionLabel(c.thickness)} × {dimensionLabel(c.width)} ×{" "}
                {dimensionLabel(c.length)}
              </p>
              <span className="mono">{c.sku}</span>
              <footer>
                <div>
                  <small>Supplier cost</small>
                  <strong>
                    {money(c.costCents)} <span>/ sheet</span>
                  </strong>
                </div>
                {c.evidence.length ? (
                  <button
                    className="button secondary small"
                    onClick={() => onEvidence(c.evidence[0])}
                  >
                    <FileText size={15} />
                    Evidence
                  </button>
                ) : (
                  <span className="muted">No evidence</span>
                )}
              </footer>
            </article>
          ))}
        </div>
        <div className="table-scroll desktop-record-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU / material</th>
                <th>Grade</th>
                <th>Dimensions</th>
                <th>Finish</th>
                <th>Stock</th>
                <th>Supplier cost</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.sku}>
                  <td>
                    <strong className="mono">{c.sku}</strong>
                    <small>Stainless steel sheet</small>
                  </td>
                  <td>
                    <span className="grade-badge">{c.grade}</span>
                  </td>
                  <td>
                    {dimensionLabel(c.thickness)} × {dimensionLabel(c.width)} ×{" "}
                    {dimensionLabel(c.length)}
                  </td>
                  <td>{c.finish}</td>
                  <td>
                    <span className="stock-dot" />
                    {c.stock} sheets
                  </td>
                  <td className="numeric">
                    {money(c.costCents)}
                    <small>per sheet · USD</small>
                  </td>
                  <td>
                    {c.evidence.length ? (
                      <button
                        className="text-button"
                        onClick={() => onEvidence(c.evidence[0])}
                      >
                        <FileText size={14} />
                        View record
                      </button>
                    ) : (
                      <span className="muted">Not provided</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <Empty
            title="No matching products"
            detail="Try another SKU or grade."
          />
        )}
        <div className="table-bottom">
          {items.length} products · quoted stock is not reserved · sample prices
          are not market prices
        </div>
      </div>
      <div className="callout neutral catalog-note">
        <ShieldCheck size={19} />
        <div>
          <strong>A match needs more than a similar description.</strong>
          <p>
            Grades, dimensions, finish, and requested standards are checked
            individually. Catalog claims do not replace lot-specific supporting
            records.
          </p>
        </div>
      </div>
    </>
  );
}
export function BenchmarksPage({ w }: { w: Workspace }) {
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">PRICING CONTEXT</div>
          <h1>Reference prices</h1>
          <p>Comparable references, with the context behind every number.</p>
        </div>
        <span className="demo-pill">
          <FlaskConical size={14} />
          Demonstration data
        </span>
      </div>
      <div className="callout neutral">
        <FlaskConical size={20} />
        <div>
          <strong>Synthetic references for this prototype</strong>
          <p>
            These values demonstrate comparison logic. They are not live
            supplier offers or current market prices.
          </p>
        </div>
      </div>
      <div className="panel benchmarks-panel">
        <div className="panel-heading">
          <h2>
            Reference prices <span>{w.benchmarks.length}</span>
          </h2>
          <span className="muted">USD · per sheet</span>
        </div>
        <div className="mobile-record-list">
          {w.benchmarks.map((b) => {
            const c = w.catalog.find((c) => c.sku === b.sku);
            return (
              <article className="mobile-benchmark-card" key={b.id}>
                <div>
                  <h3>
                    {c?.grade} stainless steel · {c?.finish}
                  </h3>
                  <span className="demo-pill">Demo reference</span>
                </div>
                <p>{c && `${dimensionLabel(c.thickness)} × 48 in × 96 in`}</p>
                <strong>
                  {money(b.priceCents)} <span>/ sheet · {b.currency}</span>
                </strong>
                <dl>
                  <dt>Quantity tier</dt>
                  <dd>
                    {b.minimum}–{b.maximum} sheets
                  </dd>
                  <dt>Observed</dt>
                  <dd>{shortDate(b.observed)}</dd>
                  <dt>Source</dt>
                  <dd>{b.source}</dd>
                </dl>
                <p className="mobile-benchmark-terms">{b.terms}</p>
              </article>
            );
          })}
        </div>
        <div className="table-scroll desktop-record-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Comparable specification</th>
                <th>Reference price</th>
                <th>Quantity tier</th>
                <th>Observed</th>
                <th>Source & commercial terms</th>
              </tr>
            </thead>
            <tbody>
              {w.benchmarks.map((b) => {
                const c = w.catalog.find((c) => c.sku === b.sku);
                return (
                  <tr key={b.id}>
                    <td>
                      <strong>
                        {c?.grade} stainless steel · {c?.finish}
                      </strong>
                      <small>
                        {c && `${dimensionLabel(c.thickness)} × 48 in × 96 in`}
                      </small>
                      <small className="mono">{b.sku}</small>
                    </td>
                    <td className="numeric">
                      <strong>{money(b.priceCents)}</strong>
                      <small>
                        {b.currency} / {b.unit}
                      </small>
                    </td>
                    <td>
                      {b.minimum}–{b.maximum} sheets
                    </td>
                    <td>{shortDate(b.observed)}</td>
                    <td>
                      <strong>{b.source}</strong>
                      <small>{b.terms}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="benchmark-rules">
        <h2>When is a comparison valid?</h2>
        <div>
          {[
            "Same material, grade, dimensions & finish",
            "Same currency and price unit",
            "Requested quantity within the reference tier",
            "Observation within the last 90 days",
          ].map((r) => (
            <p key={r}>
              <CheckCircle2 size={16} />
              {r}
            </p>
          ))}
        </div>
        <p className="microcopy">
          When a reference is unavailable or not comparable, QuoteGuard reports:
          “Price calculated; competitiveness not verified.”
        </p>
      </div>
    </>
  );
}
export function SettingsPage({
  w,
  onPricing,
  onReset,
  onEvaluation,
  busy,
}: {
  w: Workspace;
  onPricing: (bps: number) => Promise<void>;
  onReset: () => void;
  onEvaluation: () => void;
  busy: boolean;
}) {
  const [markup, setMarkup] = useState(String(w.rfq.markupBps / 100)),
    [info, setInfo] = useState<{
      mode: string;
      nicrron: string;
      prism: string;
      traceId?: string;
      checkedAt?: string;
      privateWorkspace?: boolean;
      publicDemo?: boolean;
    } | null>(null),
    [connecting, setConnecting] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    api<NonNullable<typeof info>>("integrations/status")
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">WORKSPACE PREFERENCES</div>
          <h1>Settings</h1>
          <p>
            {info?.publicDemo
              ? "Saved for this browser for 30 days. Clearing cookies starts a fresh demo; other devices have separate workspaces."
              : "Transparent pricing policies and truthful integration states."}
          </p>
        </div>
        <span className="demo-pill">
          <ShieldCheck size={14} />
          {info?.publicDemo
            ? "Your browser · demo workspace"
            : "Single workspace"}
        </span>
      </div>
      <InstallCard />
      <section className="panel evaluation-settings-card">
        <div>
          <FlaskConical size={21} />
          <div>
            <h2>Software benchmarks</h2>
            <p>
              Run synthetic RFQs through the quoting rules and inspect measured
              results.
            </p>
          </div>
        </div>
        <button className="button secondary" onClick={onEvaluation}>
          View benchmarks <ArrowRight size={16} />
        </button>
      </section>
      <ConnectionOptions w={w} />
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="section-caption">
            <Settings2 size={18} />
            <h2>Pricing policy</h2>
          </div>
          <p>
            Cost-plus markup for {w.rfq.id}. Saving recalculates every line and
            clears existing review approvals.
          </p>
          <label className="field">
            Markup on supplier cost
            <div className="suffix-input">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={markup}
                onChange={(e) => {
                  setMarkup(e.target.value);
                  setSaved(false);
                }}
              />
              <span>%</span>
            </div>
          </label>
          <div className="policy-example">
            <div>
              <span>Supplier cost</span>
              <strong>$100.00</strong>
            </div>
            <Plus size={14} />
            <div>
              <span>Markup</span>
              <strong>{markup || "0"}%</strong>
            </div>
            <ArrowRight size={16} />
            <div>
              <span>Selling price</span>
              <strong>{money(10000 + Math.round(Number(markup) * 100))}</strong>
            </div>
          </div>
          <p className="microcopy">
            {markup || "0"}% markup equals{" "}
            {((Number(markup) / (100 + Number(markup))) * 100).toFixed(1)}%
            gross margin. Prices round half-up to the nearest cent.
          </p>
          <button
            className="button primary"
            disabled={
              busy ||
              markup === "" ||
              Number(markup) < 0 ||
              Number(markup) > 100
            }
            onClick={async () => {
              try {
                await onPricing(Math.round(Number(markup) * 100));
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {saved ? <CheckCircle2 size={15} /> : null}
            {saved ? "Policy saved" : "Save pricing policy"}
          </button>
        </section>
        <section className="panel settings-card">
          <div className="section-caption">
            <ShieldCheck size={18} />
            <h2>Approval policy</h2>
          </div>
          <p>
            A person approves the quote after the server checks every included
            line.
          </p>
          {[
            "Required fields resolved",
            "Exact catalog match and aggregate stock checked",
            "Required product and lot evidence reviewed",
            "Match, pricing, and evidence explicitly confirmed",
            "Current trust checks completed",
          ].map((t) => (
            <div className="policy-check" key={t}>
              <CheckCircle2 size={15} />
              {t}
            </div>
          ))}
          <div className="policy-check">
            <span className="small-dot" />
            PRISM evaluation{" "}
            {w.requirePrism ? "required" : "not required in explicit demo mode"}
          </div>
          <div className="info-note">
            <ShieldCheck size={15} />
            <p>
              Changes after approval create a new revision. Previously approved
              exports remain unchanged.
            </p>
          </div>
        </section>
        <section className="panel settings-card integrations-card">
          <div className="section-caption spread">
            <h2>Integrations</h2>
            <span className="demo-pill">
              <FlaskConical size={13} />
              {info?.mode || w.rfq.mode} mode
            </span>
          </div>
          <div className="integration-row">
            <span className="integration-icon nicrron">N</span>
            <div>
              <h3>Nicrron</h3>
              <p>AI match explanations · server-side RFQ extraction</p>
            </div>
            <Status
              status={
                connecting ? "Connecting" : info?.nicrron || "Not configured"
              }
            />
          </div>
          <div className="integration-row">
            <span className="integration-icon prism">
              <Layers3 size={20} />
            </span>
            <div>
              <h3>Block Convey PRISM</h3>
              <p>HTTP tracing · evaluation and grounding unverified</p>
            </div>
            <Status
              status={
                connecting ? "Connecting" : info?.prism || "Not configured"
              }
            />
          </div>
          <div className="integration-note">
            <p>
              Configure credentials through server environment variables. Keys
              are never shown in this workspace. Demo mode does not silently
              replace a failed live request.
            </p>
            <p>
              PRISM Knowledge Base queries, evaluator retrieval, and inline
              prevention for Nicrron are unavailable in this prototype.
            </p>
            {info?.traceId && (
              <p className="mono">Test trace: {info.traceId}</p>
            )}
          </div>
          <button
            className="button secondary"
            disabled={connecting}
            onClick={async () => {
              setConnecting(true);
              try {
                const result = await api<NonNullable<typeof info>>(
                  "integrations/verify",
                  { confirm: true },
                );
                setInfo({ ...info!, ...result });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setConnecting(false);
              }
            }}
          >
            {connecting ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Check configured connections
          </button>
          <span className="microcopy integration-time">
            {info?.checkedAt
              ? `Last check: ${new Date(info.checkedAt).toLocaleTimeString()}`
              : "No live requests verified"}
          </span>
        </section>
        <section className="panel settings-card demo-controls">
          <div className="section-caption">
            <FlaskConical size={18} />
            <h2>Demo controls</h2>
          </div>
          <p>
            Restore RFQ-1042 to its original three-line state. This removes its
            edits, history, and approved demo snapshots. Other RFQs and imported
            products stay saved.
          </p>
          <button className="button secondary" onClick={onReset}>
            <RefreshCw size={15} />
            Reset demonstration
          </button>
          <p className="microcopy">
            This demonstration uses synthetic products, prices, and evidence.
            Review every imported specification before approving a quote.
          </p>
          {info?.privateWorkspace && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const response = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  });
                  if (!response.ok)
                    throw new Error("Sign-out could not be completed.");
                  window.location.assign("/login");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Sign out of workspace
            </button>
          )}
        </section>
      </div>
      <ErrorMessage message={error} />
    </>
  );
}

function ConnectionOptions({ w }: { w: Workspace }) {
  return (
    <details className="panel connection-options">
      <summary>
        <Layers3 size={18} />
        <div>
          <h2>Business connections</h2>
          <p>Email, ERP, and distributor options</p>
        </div>
        <ChevronRight size={17} />
      </summary>
      <div className="connection-options-body">
        {[
          [
            "Email",
            "Outlook · Gmail · IMAP / SMTP",
            "Supplier outreach stays in saved drafts until an email provider is connected.",
          ],
          [
            "ERP",
            "Epicor · SAP · Dynamics 365",
            "Download a generic handoff package for mapping into your ERP. No records are synchronized.",
          ],
          [
            "Distributor pricing",
            "DigiKey · Mouser · TTI · supplier APIs",
            "This prototype compares synthetic, historical, contract, and manually entered offers. Live provider pricing is not connected.",
          ],
        ].map(([name, providers, detail]) => (
          <article key={name}>
            <div>
              <h3>{name}</h3>
              <Status status="Not connected" />
            </div>
            <strong>{providers}</strong>
            <p>{detail}</p>
          </article>
        ))}
        <button
          className="button secondary"
          onClick={() => {
            const data = {
              schema: "quoteguard.handoff.v1",
              demo: true,
              rfqId: w.rfq.id,
              revision: w.rfq.revision,
              status: w.quote.status,
              customer: w.rfq.customer,
              currency: "USD",
              lines: w.quote.lines,
              exclusions: w.quote.exclusions,
              terms: w.quote.terms,
              unresolved: w.quote.unresolved,
            };
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `erp-handoff-${w.rfq.id}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={16} />
          Download ERP handoff (JSON)
        </button>
        <p className="microcopy">
          Generic data export; provider-specific field mapping and credentials
          are required for a live integration.
        </p>
      </div>
    </details>
  );
}
