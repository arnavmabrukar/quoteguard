"use client";
import { useEffect, useRef, useState } from "react";
import * as Drawer from "@radix-ui/react-dialog";
import {
  ProjectStages,
  ProjectWorkflow,
  type Stage,
} from "./project-workflows";
import {
  MobileSummary,
  MobileLineCards,
  useCompactLayout,
  ConnectionStatus,
} from "./mobile";
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  ClipboardList,
  Cloud,
  FileCheck2,
  FileText,
  Filter,
  FlaskConical,
  History,
  Info,
  Layers3,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquareText,
  PanelRightClose,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  Evidence,
  LineView,
  QuoteSnapshot,
  Terms,
  Workspace,
} from "@/domain/types";
import type { Mutation } from "@/contracts/rfq";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { specDescription } from "@/domain/match-catalog";
import { LineInspector, type InspectorTab } from "./line-inspector";
import {
  EvidenceDialog,
  ImportDialog,
  QuoteDialog,
  SpecDialog,
} from "./dialogs";
import {
  BenchmarksPage,
  CatalogPage,
  RfqList,
  SettingsPage,
} from "./secondary-pages";
import { Empty, ErrorMessage, Modal, Status } from "./ui";
type Action = Mutation extends infer T
  ? T extends Mutation
    ? Omit<T, "expectedRevision" | "idempotencyKey">
    : never
  : never;
type View = "workspace" | "rfqs" | "catalog" | "benchmarks" | "settings";
type Dialog =
  | "new"
  | "clarify"
  | "edit"
  | "exclude"
  | "preview"
  | "evidence"
  | "reset"
  | "catalogImport"
  | "help"
  | "terms"
  | null;
export function QuoteGuardApp() {
  const [w, setW] = useState<Workspace | null>(null),
    [id, setId] = useState("RFQ-1042"),
    [view, setView] = useState<View>("workspace"),
    [selected, setSelected] = useState("line-1"),
    [tab, setTab] = useState<InspectorTab>("Match"),
    [dialog, setDialog] = useState<Dialog>(null),
    [record, setRecord] = useState<Evidence | null>(null),
    [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [attention, setAttention] = useState(false),
    [sort, setSort] = useState("line"),
    [trust, setTrust] = useState(false),
    [drawer, setDrawer] = useState(false),
    [sourceExpanded, setSourceExpanded] = useState(false);
  const compact = useCompactLayout();
  const [stage, setStage] = useState<Stage>("Quote");
  const wRef = useRef(w);
  wRef.current = w;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  };
  function navigate(v: View) {
    setView(v);
    window.history.replaceState(
      null,
      "",
      v === "workspace" ? `/#rfq/${id}` : `/#${v}`,
    );
  }
  async function load(rfqId: string) {
    setLoading(true);
    setError("");
    try {
      setW(await api<Workspace>(`rfqs/${rfqId}`));
      setId(rfqId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const parts = hash.split("/");
    if (["rfqs", "catalog", "benchmarks", "settings"].includes(parts[0]))
      setView(parts[0] as View);
    const target = parts[0] === "rfq" && parts[1] ? parts[1] : "RFQ-1042";
    void load(target);
  }, []);
  async function act(action: Action) {
    if (!wRef.current) throw new Error("Load an RFQ first.");
    setBusy(true);
    setError("");
    try {
      const updated = await api<Workspace>(`rfqs/${wRef.current.rfq.id}`, {
        ...action,
        expectedRevision: wRef.current.rfq.revision,
        idempotencyKey: crypto.randomUUID(),
      });
      setW(updated);
      wRef.current = updated;
      notify(
        action.action === "approve"
          ? "Quote approved. Immutable snapshot saved."
          : "Changes saved. Checks recalculated.",
      );
      return updated;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const fire = (action: Action) => {
    void act(action).catch(() => {});
  };
  function openRfq(rfqId: string) {
    setStage("Quote");
    setId(rfqId);
    setSelected("line-1");
    setView("workspace");
    setAttention(false);
    setDrawer(false);
    window.history.replaceState(null, "", `/#rfq/${rfqId}`);
    void load(rfqId);
  }
  const line = w?.lines.find((l) => l.id === selected) || w?.lines[0];
  const rows =
    w?.lines
      .filter(
        (l) =>
          !attention ||
          !["Ready for review", "Approved", "Excluded"].includes(l.status),
      )
      .sort((a, b) =>
        sort === "status"
          ? a.status.localeCompare(b.status)
          : sort === "price"
            ? (b.unitPriceCents ?? -1) - (a.unitPriceCents ?? -1)
            : a.number - b.number,
      ) || [];
  function selectLine(l: LineView, target?: InspectorTab) {
    setSelected(l.id);
    if (target) setTab(target);
    setDrawer(true);
  }
  function clarify() {
    const l = w?.lines.find((l) => l.status === "Needs clarification");
    if (l) {
      setSelected(l.id);
      setDialog("clarify");
    } else {
      setSnapshot(null);
      setDialog("preview");
    }
  }
  const inspector = w && line && (
    <LineInspector
      key={line.id}
      w={w}
      line={line}
      tab={tab}
      setTab={setTab}
      onEdit={() => setDialog("edit")}
      onClarify={() => setDialog("clarify")}
      onEvidence={(e) => {
        setRecord(e);
        setDialog("evidence");
      }}
      onAddEvidence={() => {
        fire({ action: "evidence", lineId: line.id });
      }}
      onReview={() =>
        fire({ action: "review-line", lineId: line.id, confirmed: true })
      }
      onExclude={() => setDialog("exclude")}
      onRestore={() => fire({ action: "restore", lineId: line.id })}
      onPricing={() => navigate("settings")}
      onClose={() => setDrawer(false)}
      busy={busy}
      onNext={() => {
        const next = w.lines.find(
          (l) => !l.excluded && !l.reviewConfirmed && l.id !== line.id,
        );
        if (next) {
          selectLine(
            next,
            next.status === "Needs clarification"
              ? "Source"
              : next.blockers.length
                ? "Requirements"
                : "Match",
          );
        } else {
          setDrawer(false);
          setSnapshot(null);
          setDialog("preview");
        }
      }}
    />
  );
  return (
    <>
      <ConnectionStatus />
      <div className="app-shell">
        <aside className="sidebar">
          <a
            href="/#rfq/RFQ-1042"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              openRfq("RFQ-1042");
            }}
          >
            <span className="brand-mark">
              <ShieldCheck size={25} />
            </span>
            QuoteGuard
          </a>
          <button
            className="workspace-switch"
            onClick={() => navigate("settings")}
          >
            <span className="company-avatar">N</span>
            <span>
              <strong>Northline Metals</strong>
              <small>Supplier workspace</small>
            </span>
            <ChevronsUpDown size={14} />
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {(
              [
                { key: "rfqs", label: "RFQs", icon: ClipboardList },
                { key: "catalog", label: "Catalog", icon: Layers3 },
                {
                  key: "benchmarks",
                  label: "Benchmarks",
                  icon: CircleDollarSign,
                },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`nav-item ${view === key || (key === "rfqs" && view === "workspace") ? "active" : ""}`}
                onClick={() => navigate(key)}
              >
                <Icon size={18} />
                {label}
                {key === "rfqs" && w && (
                  <span className="nav-count">{w.summary.total}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-promise">
              <span className="promise-icon">
                <ShieldCheck size={20} />
              </span>
              <strong>Confidence in every quote.</strong>
              <p>
                Trace the request.
                <br />
                Check the evidence.
                <br />
                Keep a human in control.
              </p>
              <button className="text-button" onClick={() => setDialog("help")}>
                Explore the demo <ArrowRight size={13} />
              </button>
            </div>
            <button
              className={`nav-item ${view === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
            >
              <Settings size={18} />
              Settings
            </button>
            <div className="reviewer">
              <span className="reviewer-avatar">LR</span>
              <div>
                <strong>Workspace owner</strong>
                <small>Single-reviewer prototype</small>
              </div>
              <span className="presence-dot" />
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <button className="mobile-brand" onClick={() => navigate("rfqs")}>
              <ShieldCheck size={24} />
              <span>QuoteGuard</span>
            </button>
            <div className="breadcrumb">
              <span className="topbar-icon">
                <ClipboardList size={17} />
              </span>
              <button onClick={() => navigate("rfqs")}>Workspace</button>
              <ChevronRight size={13} />
              <button
                onClick={() => navigate(view === "workspace" ? "rfqs" : view)}
              >
                {view === "workspace"
                  ? "RFQs"
                  : view[0].toUpperCase() + view.slice(1)}
              </button>
              {view === "workspace" && (
                <>
                  <ChevronRight size={13} />
                  <span className="mono">{id}</span>
                </>
              )}
            </div>
            <div className="topbar-right">
              <button
                className="mobile-new icon-button"
                aria-label="New request"
                onClick={() => setDialog("new")}
              >
                <Plus size={21} />
              </button>
              <span className={`save-state ${error ? "error" : ""}`}>
                {busy ? (
                  <Loader2 className="spin" size={14} />
                ) : error ? (
                  <TriangleAlert size={14} />
                ) : (
                  <Cloud size={15} />
                )}{" "}
                {busy
                  ? "Saving changes…"
                  : error
                    ? "Action failed"
                    : loading
                      ? "Loading…"
                      : "All changes saved"}
              </span>
              <span className="topbar-divider" />
              <button
                className="icon-button"
                aria-label="Demo walkthrough"
                onClick={() => setDialog("help")}
              >
                <LifeBuoy size={18} />
              </button>
            </div>
          </header>
          <main className="main-content">
            <div className="demo-banner">
              <span>
                <FlaskConical size={15} />
                <strong>
                  {w?.rfq.mode === "live"
                    ? "Live interpretation mode"
                    : "Demo data"}
                </strong>
                <span>
                  {w?.rfq.mode === "live"
                    ? "Local prototype · sponsor evaluations remain unverified."
                    : "You’re exploring a sample RFQ. Products, prices, and evidence are synthetic."}
                </span>
              </span>
              <button onClick={() => setDialog("new")}>
                Try your own RFQ
                <ArrowRight size={14} />
              </button>
            </div>
            {error && (
              <div className="global-error">
                <ErrorMessage message={error} />
                <button className="text-button" onClick={() => void load(id)}>
                  Refresh saved state
                </button>
                <button
                  className="icon-button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {loading && !w ? (
              <div className="initial-loading">
                <span className="brand-mark">
                  <ShieldCheck size={27} />
                </span>
                <h2>Opening your quoting workspace</h2>
                <p>Loading saved requests and catalog records…</p>
                <Loader2 className="spin" size={22} />
              </div>
            ) : (
              w && (
                <>
                  {view === "workspace" && (
                    <>
                      <div
                        className={`workspace-heading ${stage !== "Quote" ? "secondary-stage" : ""}`}
                      >
                        <div>
                          <div className="rfq-meta">
                            <span className="mono">{w.rfq.id}</span>
                            <span className="meta-dot" />
                            <span>Version {w.rfq.revision}</span>
                            <Status
                              status={
                                w.rfq.approvedVersion
                                  ? "Approved"
                                  : w.summary.attention
                                    ? "Needs attention"
                                    : "Ready for review"
                              }
                              compact
                            />
                          </div>
                          <h1>{w.rfq.title}</h1>
                          <div className="customer-line">
                            <Building2 size={15} />
                            <strong>{w.rfq.customer}</strong>
                            <span>·</span>
                            <span>{w.rfq.contact}</span>
                            <span>·</span>
                            <span>Received {shortDate(w.rfq.createdAt)}</span>
                          </div>
                        </div>
                        <div className="heading-actions">
                          <button
                            className="button secondary"
                            onClick={() => {
                              setSnapshot(null);
                              setDialog("preview");
                            }}
                          >
                            <FileText size={16} />
                            Preview quote
                          </button>
                          <button className="button primary" onClick={clarify}>
                            {w.summary.clarification ? (
                              <MessageSquareText size={16} />
                            ) : (
                              <ShieldCheck size={16} />
                            )}{" "}
                            {w.summary.clarification
                              ? "Draft clarification"
                              : w.rfq.approvedVersion
                                ? "View approved quote"
                                : "Review quote"}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                      <ProjectStages
                        stage={stage}
                        onChange={(s) => {
                          setStage(s);
                          setDrawer(false);
                        }}
                      />
                      {stage !== "Quote" ? (
                        <ProjectWorkflow
                          w={w}
                          stage={stage}
                          onQuote={() => setStage("Quote")}
                        />
                      ) : (
                        <>
                          <div className="workflow">
                            <div className="workflow-steps">
                              {[
                                "Import",
                                "Extract",
                                "Match & price",
                                "Review",
                              ].map((s, i) => (
                                <div
                                  className={`workflow-step ${i < 2 || w.rfq.approvedVersion ? "complete" : i === 2 ? "current" : ""}`}
                                  key={s}
                                >
                                  <span className="step-dot">
                                    {i < 2 || w.rfq.approvedVersion ? (
                                      <Check size={11} />
                                    ) : (
                                      i + 1
                                    )}
                                  </span>
                                  <span>{s}</span>
                                  {i < 3 && <span className="step-connector" />}
                                </div>
                              ))}
                            </div>
                            <span className="workflow-context">
                              {w.rfq.approvedVersion ? (
                                <>
                                  <CheckCircle2 size={13} />
                                  Human review completed
                                </>
                              ) : (
                                <>
                                  <span className="small-dot amber" />
                                  {w.summary.attention
                                    ? `${w.summary.attention} items need attention`
                                    : "Ready for human review"}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="summary-strip">
                            {[
                              {
                                label: "Line items",
                                value: w.summary.total,
                                icon: ClipboardList,
                                color: "blue",
                              },
                              {
                                label: "Ready for review",
                                value: w.summary.ready,
                                icon: CheckCircle2,
                                color: "green",
                              },
                              {
                                label: "Needs clarification",
                                value: w.summary.clarification,
                                icon: MessageSquareText,
                                color: "amber",
                              },
                              {
                                label: "Missing evidence",
                                value: w.summary.evidence,
                                icon: FileCheck2,
                                color: "amber",
                              },
                              {
                                label: "Priced subtotal",
                                value: money(w.summary.subtotalCents),
                                icon: CircleDollarSign,
                                color: "dark",
                              },
                            ].map(({ label, value, icon: Icon, color }) => (
                              <div className="summary-item" key={label}>
                                <div>
                                  <span>{label}</span>
                                  <Icon size={16} className={color} />
                                </div>
                                <strong className={color}>{value}</strong>
                                {label === "Priced subtotal" && (
                                  <small>
                                    Excludes unresolved lines & charges
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                          <MobileSummary w={w} />
                          <div
                            className={`workspace-grid ${drawer ? "drawer-open" : ""}`}
                          >
                            <div className="workspace-left">
                              <section className="panel line-panel">
                                <div className="panel-heading">
                                  <h2>
                                    Line items <span>{w.summary.total}</span>
                                  </h2>
                                  <div className="table-controls">
                                    <button
                                      className={`filter-button ${attention ? "active" : ""}`}
                                      onClick={() => setAttention(!attention)}
                                      aria-pressed={attention}
                                    >
                                      <Filter size={13} />
                                      Needs attention
                                      {w.summary.attention > 0 && (
                                        <b>{w.summary.attention}</b>
                                      )}
                                    </button>
                                    <label className="sort-control">
                                      <ArrowUpDown size={13} />
                                      <select
                                        aria-label="Sort line items"
                                        value={sort}
                                        onChange={(e) =>
                                          setSort(e.target.value)
                                        }
                                      >
                                        <option value="line">Line order</option>
                                        <option value="status">Status</option>
                                        <option value="price">
                                          Price: high to low
                                        </option>
                                      </select>
                                    </label>
                                  </div>
                                </div>
                                <MobileLineCards
                                  lines={rows}
                                  onSelect={(l) =>
                                    selectLine(
                                      l,
                                      l.status === "Needs clarification"
                                        ? "Source"
                                        : l.status ===
                                            "Awaiting supplier evidence"
                                          ? "Requirements"
                                          : "Match",
                                    )
                                  }
                                />
                                <div className="table-scroll desktop-line-table">
                                  <table className="line-table">
                                    <thead>
                                      <tr>
                                        <th className="number-cell">#</th>
                                        <th>Requested item</th>
                                        <th>Qty</th>
                                        <th>Catalog match</th>
                                        <th>Unit price</th>
                                        <th className="status-column">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((l) => (
                                        <tr
                                          key={l.id}
                                          className={`${line?.id === l.id ? "selected" : ""} ${l.excluded ? "excluded" : ""}`}
                                          onClick={() => selectLine(l)}
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" ||
                                              e.key === " "
                                            ) {
                                              e.preventDefault();
                                              selectLine(l);
                                            }
                                          }}
                                          tabIndex={0}
                                          aria-label={`Item ${l.number}: ${specDescription(l.spec)}, ${l.status}`}
                                        >
                                          <td className="number-cell">
                                            <span>
                                              {String(l.number).padStart(
                                                2,
                                                "0",
                                              )}
                                            </span>
                                          </td>
                                          <td className="item-cell">
                                            <strong>
                                              {specDescription(l.spec)}
                                            </strong>
                                            <span className="original-text">
                                              {l.original}
                                            </span>
                                            {l.excluded ? (
                                              <small className="excluded-reason">
                                                Excluded: {l.excluded}
                                              </small>
                                            ) : (
                                              <span className="item-tags">
                                                {l.spec.finish && (
                                                  <span>{l.spec.finish}</span>
                                                )}
                                                {l.spec.mtr && (
                                                  <span>
                                                    <FileCheck2 size={10} />
                                                    MTR
                                                  </span>
                                                )}
                                                {l.spec.origin && (
                                                  <span>
                                                    {l.spec.origin} origin
                                                  </span>
                                                )}
                                              </span>
                                            )}
                                          </td>
                                          <td className="quantity-cell">
                                            <strong>
                                              {l.spec.quantity ?? "—"}
                                            </strong>
                                            <span>
                                              {l.spec.quantityUnit || "Unknown"}
                                            </span>
                                          </td>
                                          <td className="match-cell">
                                            {l.match ? (
                                              <>
                                                <span className="mono">
                                                  {l.match.sku}
                                                </span>
                                                <small>
                                                  <CheckCircle2 size={11} />
                                                  Exact match
                                                </small>
                                              </>
                                            ) : (
                                              <>
                                                <span className="unmatched">
                                                  {l.status ===
                                                  "Needs clarification"
                                                    ? "Pending clarification"
                                                    : "No exact match"}
                                                </span>
                                                <small>
                                                  Review specifications
                                                </small>
                                              </>
                                            )}
                                          </td>
                                          <td className="unit-price-cell">
                                            <strong>
                                              {money(l.unitPriceCents)}
                                            </strong>
                                            {l.unitPriceCents !== null && (
                                              <small>/ sheet</small>
                                            )}
                                          </td>
                                          <td className="status-column">
                                            <Status status={l.status} compact />
                                            <ChevronRight size={14} />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {!rows.length && (
                                  <Empty
                                    title={
                                      attention
                                        ? "All items are clear"
                                        : "No extracted items"
                                    }
                                    detail={
                                      attention
                                        ? "There are no line items requiring clarification or evidence."
                                        : "Create a new RFQ with explicit sheet specifications."
                                    }
                                  />
                                )}
                                <div className="line-table-footer">
                                  <span>
                                    <Info size={13} />
                                    Select an item to inspect its source, match,
                                    and checks.
                                  </span>
                                  <span>
                                    {w.summary.excluded
                                      ? `${w.summary.excluded} excluded · partial quote`
                                      : `${w.summary.total} line items`}
                                  </span>
                                </div>
                              </section>
                              {w.summary.attention > 0 && (
                                <section className="next-actions">
                                  <div className="section-caption">
                                    <span className="attention-icon">
                                      <Sparkles size={15} />
                                    </span>
                                    <h2>Move this quote forward</h2>
                                    <span>
                                      {w.summary.attention} open items
                                    </span>
                                  </div>
                                  <div className="action-cards">
                                    {w.lines
                                      .filter(
                                        (l) =>
                                          ![
                                            "Ready for review",
                                            "Approved",
                                            "Excluded",
                                          ].includes(l.status),
                                      )
                                      .slice(0, 3)
                                      .map((l) => (
                                        <button
                                          key={l.id}
                                          className="action-card"
                                          onClick={() => {
                                            selectLine(
                                              l,
                                              l.status === "Needs clarification"
                                                ? "Source"
                                                : "Requirements",
                                            );
                                            if (
                                              l.status === "Needs clarification"
                                            )
                                              setDialog("clarify");
                                          }}
                                        >
                                          <span
                                            className={`action-card-icon ${l.status === "Needs clarification" ? "amber" : "blue"}`}
                                          >
                                            {l.status ===
                                            "Needs clarification" ? (
                                              <MessageSquareText size={18} />
                                            ) : (
                                              <FileCheck2 size={18} />
                                            )}
                                          </span>
                                          <div>
                                            <small>
                                              ITEM{" "}
                                              {String(l.number).padStart(
                                                2,
                                                "0",
                                              )}
                                            </small>
                                            <strong>
                                              {l.status ===
                                              "Needs clarification"
                                                ? "Confirm missing specifications"
                                                : l.status ===
                                                    "No catalog match"
                                                  ? "Resolve the catalog match"
                                                  : "Review supplier evidence"}
                                            </strong>
                                            <p>
                                              {l.status ===
                                              "Needs clarification"
                                                ? "Thickness and dimension units need confirmation."
                                                : l.status ===
                                                    "No catalog match"
                                                  ? l.blockers[0]
                                                  : "Product and lot records are needed before approval."}
                                            </p>
                                          </div>
                                          <ArrowRight size={15} />
                                        </button>
                                      ))}
                                  </div>
                                </section>
                              )}
                              <section className="panel source-panel">
                                <button
                                  className="source-panel-heading"
                                  aria-expanded={sourceExpanded}
                                  onClick={() =>
                                    setSourceExpanded(!sourceExpanded)
                                  }
                                >
                                  <span className="attachment-icon">
                                    <FileText size={20} />
                                  </span>
                                  <div>
                                    <strong>Original request</strong>
                                    <span>
                                      {w.rfq.documentName} ·{" "}
                                      {w.rfq.lines.length} extracted items
                                    </span>
                                  </div>
                                  <span className="source-label">
                                    Source preserved
                                  </span>
                                  <ChevronDown
                                    size={17}
                                    className={sourceExpanded ? "flipped" : ""}
                                  />
                                </button>
                                {sourceExpanded && (
                                  <div className="original-document">
                                    <div className="email-meta">
                                      <span>From</span>
                                      {w.rfq.contact}
                                      <span>Subject</span>
                                      {w.rfq.title}
                                    </div>
                                    <pre>{w.rfq.original}</pre>
                                    {w.rfq.documentId && (
                                      <a
                                        className="text-button"
                                        href={`/api/documents/${w.rfq.documentId}`}
                                      >
                                        Download original document{" "}
                                        <ArrowRight size={13} />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </section>
                              <section className="panel trust-panel">
                                <button
                                  className="trust-heading"
                                  aria-expanded={trust}
                                  onClick={() => setTrust(!trust)}
                                >
                                  <ShieldCheck size={19} />
                                  <div>
                                    <strong>Trust checks</strong>
                                    <span>
                                      Deterministic rules, evidence, and
                                      integration status
                                    </span>
                                  </div>
                                  <span className="trust-summary">
                                    {w.rfq.guardrail.passed
                                      ? "Input checked"
                                      : "Input blocked"}
                                  </span>
                                  <ChevronDown
                                    size={17}
                                    className={trust ? "flipped" : ""}
                                  />
                                </button>
                                {trust && (
                                  <div className="trust-details">
                                    <div>
                                      <span>Application input guardrail</span>
                                      <Status
                                        status={
                                          w.rfq.guardrail.passed
                                            ? "Passed"
                                            : "Failed"
                                        }
                                      />
                                    </div>
                                    <p>{w.rfq.guardrail.detail}</p>
                                    <div>
                                      <span>
                                        Deterministic match & readiness check
                                      </span>
                                      <span className="mono">
                                        v{w.rfq.revision} · {w.summary.ready}/
                                        {w.summary.total - w.summary.excluded}{" "}
                                        ready
                                      </span>
                                    </div>
                                    <div>
                                      <span>PRISM evaluation</span>
                                      <Status status={w.rfq.prism.evaluation} />
                                    </div>
                                    <div>
                                      <span>PRISM trace delivery</span>
                                      <span>{w.rfq.prism.telemetry}</span>
                                    </div>
                                    <div>
                                      <span>Knowledge Base grounding</span>
                                      <Status status={w.rfq.prism.grounding} />
                                    </div>
                                    {w.rfq.prism.traceId && (
                                      <p className="mono">
                                        Trace: {w.rfq.prism.traceId}
                                      </p>
                                    )}
                                    <p>
                                      Local checks are not PRISM evaluations.
                                      External evaluation and grounding have not
                                      been verified.{" "}
                                      {w.requirePrism
                                        ? "A current PRISM pass is required for approval."
                                        : "The explicit demo policy permits human approval after local checks."}
                                    </p>
                                  </div>
                                )}
                              </section>
                              <section className="recent-activity">
                                <div className="section-caption spread">
                                  <h2>
                                    <History size={15} />
                                    Recent activity
                                  </h2>
                                  {w.versions.length > 0 && (
                                    <select
                                      aria-label="View approved quote version"
                                      value=""
                                      onChange={async (e) => {
                                        try {
                                          setSnapshot(
                                            await api<QuoteSnapshot>(
                                              `quotes/${encodeURIComponent(e.target.value)}`,
                                            ),
                                          );
                                          setDialog("preview");
                                        } catch (err) {
                                          setError((err as Error).message);
                                        }
                                      }}
                                    >
                                      <option value="">
                                        Approved versions ({w.versions.length})
                                      </option>
                                      {w.versions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                          {v.id}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                {w.history.slice(0, 2).map((e) => (
                                  <div className="activity-row" key={e.id}>
                                    <span className="activity-check">
                                      <Check size={11} />
                                    </span>
                                    <div>
                                      <strong>{e.action}</strong>
                                      <p>{e.detail}</p>
                                    </div>
                                    <span>v{e.revision}</span>
                                  </div>
                                ))}
                              </section>
                            </div>
                            {!compact && inspector}
                          </div>
                          <div className="workspace-footer">
                            <span>
                              <Shield size={13} />
                              Every quote has a source. Every approval has a
                              person.
                            </span>
                            <button
                              className="text-button muted"
                              onClick={() => setDialog("new")}
                            >
                              <Plus size={13} />
                              New RFQ
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {view === "rfqs" && (
                    <RfqList onOpen={openRfq} onNew={() => setDialog("new")} />
                  )}
                  {view === "catalog" && (
                    <CatalogPage
                      w={w}
                      onImport={() => setDialog("catalogImport")}
                      onEvidence={(e) => {
                        setRecord(e);
                        setDialog("evidence");
                      }}
                    />
                  )}
                  {view === "benchmarks" && <BenchmarksPage w={w} />}
                  {view === "settings" && (
                    <SettingsPage
                      w={w}
                      onPricing={async (markupBps) => {
                        await act({ action: "pricing", markupBps });
                      }}
                      onReset={() => setDialog("reset")}
                      busy={busy}
                    />
                  )}
                </>
              )
            )}
            {!w && !loading && (
              <Empty
                title="Workspace could not be loaded"
                detail="Refresh saved state or sign in again to reconnect."
              />
            )}
          </main>
        </div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {(
          [
            { key: "rfqs", label: "RFQs", icon: ClipboardList },
            { key: "catalog", label: "Catalog", icon: Layers3 },
            { key: "benchmarks", label: "Prices", icon: CircleDollarSign },
            { key: "settings", label: "Settings", icon: Settings },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            aria-current={
              view === key || (key === "rfqs" && view === "workspace")
                ? "page"
                : undefined
            }
            className={
              view === key || (key === "rfqs" && view === "workspace")
                ? "active"
                : ""
            }
            onClick={() => navigate(key)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {compact && (
        <Drawer.Root
          open={drawer && view === "workspace"}
          onOpenChange={setDrawer}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="inspector-drawer-overlay" />
            <Drawer.Content
              className="inspector-drawer"
              aria-describedby={undefined}
            >
              <Drawer.Title className="sr-only">
                Item {line?.number} details
              </Drawer.Title>
              {inspector}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
      {dialog === "new" && (
        <ImportDialog
          onClose={() => setDialog(null)}
          onCreated={(newId) => {
            setDialog(null);
            openRfq(newId);
            notify("Request imported and saved.");
          }}
        />
      )}
      {dialog === "catalogImport" && (
        <ImportDialog
          catalogMode
          onClose={() => setDialog(null)}
          onCreated={(message) => {
            setDialog(null);
            void load(id);
            notify(message);
          }}
        />
      )}
      {w && line && (dialog === "edit" || dialog === "clarify") && (
        <SpecDialog
          key={`${dialog}-${line.id}`}
          line={line}
          clarify={dialog === "clarify"}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (spec, reply) => {
            if (reply !== undefined)
              await act({
                action: "clarify",
                lineId: line.id,
                spec,
                reply,
                confirmed: true,
              });
            else await act({ action: "edit", lineId: line.id, spec });
            setDialog(null);
            setTab("Match");
          }}
        />
      )}
      {w && dialog === "preview" && (
        <QuoteDialog
          w={w}
          quote={snapshot || w.quote}
          busy={busy}
          onClose={() => setDialog(null)}
          onApprove={async (reviewer) => {
            const updated = await act({
              action: "approve",
              reviewer,
              confirmed: true,
            });
            setSnapshot(updated.quote);
          }}
          onReviewItems={() => {
            setDialog(null);
            const next = w.lines.find(
              (l) => !l.excluded && (!l.reviewConfirmed || l.blockers.length),
            );
            if (next)
              selectLine(
                next,
                next.status === "Needs clarification"
                  ? "Source"
                  : next.blockers.length
                    ? "Requirements"
                    : "Match",
              );
          }}
          onTerms={() => setDialog("terms")}
        />
      )}
      {dialog === "evidence" && record && (
        <EvidenceDialog
          evidence={record}
          onClose={() => setDialog(null)}
          busy={busy}
          onReview={() => {
            if (line)
              void act({
                action: "review-evidence",
                lineId: line.id,
                evidenceId: record.id,
                confirmed: true,
              })
                .then(() => {
                  setDialog(null);
                  setTab("Requirements");
                })
                .catch(() => {});
          }}
        />
      )}
      {dialog === "exclude" && line && (
        <ExcludeDialog
          onClose={() => setDialog(null)}
          busy={busy}
          onExclude={async (reason) => {
            await act({ action: "exclude", lineId: line.id, reason });
            setDialog(null);
          }}
        />
      )}
      {dialog === "terms" && w && (
        <TermsDialog
          terms={w.rfq.terms}
          busy={busy}
          onClose={() => setDialog("preview")}
          onSave={async (terms) => {
            await act({ action: "terms", terms });
            setSnapshot(null);
            setDialog("preview");
          }}
        />
      )}
      {dialog === "reset" && (
        <Modal
          title="Reset the demonstration?"
          subtitle="This action restores the original RFQ-1042 dataset."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <p>
              Edits, clarification history, and approved snapshots for this demo
              RFQ will be removed. Your other RFQs and imported catalog items
              will stay saved.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const updated = await api<Workspace>("demo/reset", {
                    confirm: true,
                  });
                  setW(updated);
                  setId("RFQ-1042");
                  setSelected("line-1");
                  setView("workspace");
                  setDialog(null);
                  setAttention(false);
                  notify("Demo restored to its original state.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              Reset demo
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="From request to confident quote"
          subtitle="A quick tour of the three-line demonstration."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body walkthrough">
            {[
              [
                "Inspect the exact match",
                "Item 01 matches SS-304-060-2B. See its source, $120 unit price, and supporting demo MTR. Confirm the line review.",
              ],
              [
                "Clarify the ambiguous request",
                "Open item 02, choose Use sample buyer reply, confirm the field groups, then apply the clarification and review the line.",
              ],
              [
                "Review supplier evidence",
                "Open item 03 → Checks. Add sample supplier evidence, view it, and explicitly confirm its review. Then confirm the line review.",
              ],
              [
                "Approve and export",
                "Preview the quote, confirm your approval, and export CSV or use Print / save as PDF. A material edit creates a new revision.",
              ],
            ].map(([title, body], i) => (
              <div key={title}>
                <span>{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
            <div className="demo-inline">
              <FlaskConical size={15} />
              Sponsor evaluations and Knowledge Base grounding are unverified.
            </div>
          </div>
          <div className="modal-footer">
            <span className="microcopy">
              All progress is saved in your workspace.
            </span>
            <button className="button primary" onClick={() => setDialog(null)}>
              Explore workspace
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
function ExcludeDialog({
  onClose,
  onExclude,
  busy,
}: {
  onClose: () => void;
  onExclude: (r: string) => Promise<void>;
  busy: boolean;
}) {
  const [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <Modal
      title="Exclude this line item"
      subtitle="The resulting quote will be labeled as a partial quote."
      onClose={onClose}
    >
      <div className="modal-body">
        <label className="field">
          Exclusion reason
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this item is excluded. This reason is included in the customer quote."
          />
        </label>
        <ErrorMessage message={error} />
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={reason.trim().length < 5 || busy}
          onClick={async () => {
            try {
              await onExclude(reason);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Exclude item
        </button>
      </div>
    </Modal>
  );
}
function TermsDialog({
  terms,
  onClose,
  onSave,
  busy,
}: {
  terms: Terms;
  onClose: () => void;
  onSave: (t: Terms) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState(terms),
    [error, setError] = useState("");
  return (
    <Modal
      title="Commercial terms"
      subtitle="Unknown charges must remain explicit in the quote."
      onClose={onClose}
    >
      <div className="modal-body">
        {(["shipping", "tax", "processing", "delivery"] as const).map((k) => (
          <label className="field" key={k}>
            {k[0].toUpperCase() + k.slice(1)}
            <textarea
              rows={2}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          Validity (days)
          <input
            type="number"
            min="1"
            max="90"
            value={form.validityDays}
            onChange={(e) =>
              setForm({ ...form, validityDays: Number(e.target.value) })
            }
          />
        </label>
        <ErrorMessage message={error} />
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Back
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            try {
              await onSave(form);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save terms
        </button>
      </div>
    </Modal>
  );
}
