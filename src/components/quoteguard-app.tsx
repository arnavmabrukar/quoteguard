"use client";
import type { Mutation } from "@/contracts/rfq";
import type {
  Evidence,
  LineView,
  QuoteSnapshot,
  Terms,
  Workspace,
} from "@/domain/types";
import { api } from "@/lib/api";
import * as Drawer from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CheckCircle2,
  ChevronsUpDown,
  CircleDollarSign,
  ClipboardList,
  Cloud,
  FlaskConical,
  Layers3,
  LifeBuoy,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  EvidenceDialog,
  ImportDialog,
  QuoteDialog,
  SpecDialog,
} from "./dialogs";
import { LineInspector, type InspectorTab } from "./line-inspector";
import { ConnectionStatus, useCompactLayout } from "./mobile";
import type { Stage } from "./project-workflows";
import { QuoteWorkspace } from "./quote-workspace";
import {
  BenchmarksPage,
  CatalogPage,
  RfqList,
  SettingsPage,
} from "./secondary-pages";
import { EvaluationPage } from "./evaluation-page";
import { Empty, ErrorMessage, Modal } from "./ui";
type Action = Mutation extends infer T
  ? T extends Mutation
    ? Omit<T, "expectedRevision" | "idempotencyKey">
    : never
  : never;
type View =
  | "workspace"
  | "rfqs"
  | "catalog"
  | "benchmarks"
  | "settings"
  | "evaluation";
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
    [view, setView] = useState<View>("rfqs"),
    [selected, setSelected] = useState("line-1"),
    [tab, setTab] = useState<InspectorTab>("Match"),
    [dialog, setDialog] = useState<Dialog>(null),
    [record, setRecord] = useState<Evidence | null>(null),
    [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [drawer, setDrawer] = useState(false);
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
    if (
      ["rfqs", "catalog", "benchmarks", "settings", "evaluation"].includes(
        parts[0],
      )
    )
      setView(parts[0] as View);
    const target = parts[0] === "rfq" && parts[1] ? parts[1] : "RFQ-1042";
    if (parts[0] === "rfq") setView("workspace");
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
          ? "Quote approved and saved. Ready to download."
          : "Saved. Your quote is up to date.",
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
    setDrawer(false);
    window.history.replaceState(null, "", `/#rfq/${rfqId}`);
    void load(rfqId);
  }
  const line = w?.lines.find((l) => l.id === selected) || w?.lines[0];
  function selectLine(l: LineView, target?: InspectorTab) {
    setSelected(l.id);
    setTab(target || "Match");
    setDrawer(true);
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
      onPricing={() => {
        setDrawer(false);
        navigate("settings");
      }}
      onClose={() => setDrawer(false)}
      busy={busy}
      onNext={() => {
        const next = w.lines.find(
          (l) => !l.excluded && !l.reviewConfirmed && l.id !== line.id,
        );
        if (next) {
          selectLine(next, "Match");
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
      <div className="app-shell restored-app">
        <aside className="sidebar">
          <a
            href="/#rfqs"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("rfqs");
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
              <small>Your quoting workspace</small>
            </span>
            <ChevronsUpDown size={14} />
          </button>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {(
              [
                { key: "rfqs", label: "Quotes", icon: ClipboardList },
                { key: "catalog", label: "Materials", icon: Layers3 },
                {
                  key: "benchmarks",
                  label: "Prices",
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
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-promise">
              <ShieldCheck size={24} />
              <strong>From request to quote.</strong>
              <p>
                Check the details.
                <br />
                Set your price.
                <br />
                Get it out the door.
              </p>
            </div>
            <button
              className={`nav-item ${view === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
            >
              <Settings size={18} />
              Settings
            </button>
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
              <span>
                {view === "workspace"
                  ? "Quote details"
                  : {
                      rfqs: "Your quotes",
                      catalog: "Materials",
                      benchmarks: "Reference prices",
                      settings: "Settings",
                      evaluation: "Software benchmarks",
                    }[view]}
              </span>
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
                aria-label="Help with quoting"
                onClick={() => setDialog("help")}
              >
                <LifeBuoy size={18} />
              </button>
            </div>
          </header>
          <main className="main-content">
            <div className="demo-banner simple-demo-banner">
              <FlaskConical size={15} />
              <span>
                <strong>Sample workspace</strong> · Prices, stock and documents
                are examples.
              </span>
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
            {loading && (!w || view === "workspace") ? (
              <div className="initial-loading">
                <span className="brand-mark">
                  <ShieldCheck size={27} />
                </span>
                <h2>Opening your quotes</h2>
                <p>Loading saved requests and catalog records…</p>
                <Loader2 className="spin" size={22} />
              </div>
            ) : (
              w && (
                <>
                  {view === "workspace" && (
                    <QuoteWorkspace
                      w={w}
                      inspector={!compact && drawer ? inspector : null}
                      selected={selected}
                      stage={stage}
                      onStage={(s) => {
                        setStage(s);
                        setDrawer(false);
                      }}
                      onBack={() => navigate("rfqs")}
                      onSelect={(item) => selectLine(item, "Match")}
                      onPreview={() => {
                        setSnapshot(null);
                        setDialog("preview");
                      }}
                      onVersion={async (quoteId) => {
                        try {
                          setSnapshot(
                            await api<QuoteSnapshot>(
                              `quotes/${encodeURIComponent(quoteId)}`,
                            ),
                          );
                          setDialog("preview");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    />
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
                  {view === "evaluation" && (
                    <EvaluationPage onBack={() => navigate("settings")} />
                  )}
                  {view === "settings" && (
                    <SettingsPage
                      w={w}
                      onPricing={async (markupBps) => {
                        await act({ action: "pricing", markupBps });
                      }}
                      onEvaluation={() => navigate("evaluation")}
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
                detail="Refresh to reconnect and load your saved workspace."
              />
            )}
          </main>
        </div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {(
          [
            { key: "rfqs", label: "Quotes", icon: ClipboardList },
            { key: "catalog", label: "Materials", icon: Layers3 },
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
            if (next) selectLine(next, "Match");
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
                "Check the first item",
                "Open item 01 to see its material, quantity and price. Use Explain this item for help, then mark it checked.",
              ],
              [
                "Fill in missing details",
                "Open item 02 and choose Add missing details. Use the sample reply, confirm the details, then check the item.",
              ],
              [
                "Check the documents",
                "Open item 03 → Documents. Add sample documents, open them and confirm your review. Then mark the item checked.",
              ],
              [
                "Approve and export",
                "Preview the quote, confirm your approval, and export CSV or use Print / save as PDF. Changes to the request require another review.",
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
              This workspace uses sample materials, prices and documents.
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
