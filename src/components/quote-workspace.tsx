"use client";
import type { LineView, Workspace } from "@/domain/types";
import { money } from "@/lib/format";
import { specDescription } from "@/domain/match-catalog";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
} from "lucide-react";
import { useState } from "react";
import { MobileLineCards } from "./mobile";
import {
  ProjectStages,
  ProjectWorkflow,
  type Stage,
} from "./project-workflows";
import { Empty, Status } from "./ui";

export function QuoteWorkspace({
  w,
  stage,
  onStage,
  onBack,
  onSelect,
  onPreview,
  onVersion,
  inspector,
  selected,
}: {
  w: Workspace;
  stage: Stage;
  onStage: (stage: Stage) => void;
  onBack: () => void;
  onSelect: (line: LineView) => void;
  onPreview: () => void;
  onVersion: (id: string) => void;
  inspector: ReactNode;
  selected?: string;
}) {
  const [pendingOnly, setPendingOnly] = useState(false);
  const included = w.lines.filter((l) => !l.excluded);
  const checked = included.filter(
    (l) => l.reviewConfirmed && !l.blockers.length,
  ).length;
  const next = included.find((l) => !l.reviewConfirmed || l.blockers.length);
  const approved = !!w.rfq.approvedVersion;
  const rows = pendingOnly
    ? w.lines.filter(
        (l) => !l.excluded && (!l.reviewConfirmed || l.blockers.length),
      )
    : w.lines;
  const nextLabel =
    next?.status === "Needs clarification"
      ? "Confirm missing details"
      : next?.status === "Awaiting supplier evidence"
        ? "Check item documents"
        : "Check next item";
  return (
    <div className="simple-workspace">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> All quotes
      </button>
      <div className="simple-quote-heading">
        <div>
          <p className="quote-customer">{w.rfq.customer}</p>
          <h1>{w.rfq.title}</h1>
          <p className="quote-reference">
            {w.rfq.id} · {w.summary.total} items
            {w.summary.excluded ? ` · ${w.summary.excluded} left out` : ""}
          </p>
        </div>
        <button className="button secondary" onClick={onPreview}>
          <FileText size={17} />{" "}
          {approved ? "View approved quote" : "Preview quote"}
        </button>
      </div>
      {stage === "Quote" ? (
        <>
          <ol className="quote-steps" aria-label="Quote progress">
            <li className="done">
              <span>
                <Check size={14} />
              </span>
              Request added
            </li>
            <li
              className={next && !approved ? "current" : "done"}
              aria-current={next && !approved ? "step" : undefined}
            >
              <span>{next && !approved ? "2" : <Check size={14} />}</span>Check
              items
            </li>
            <li
              className={approved ? "done" : !next ? "current" : ""}
              aria-current={!next && !approved ? "step" : undefined}
            >
              <span>{approved ? <Check size={14} /> : "3"}</span>
              {approved ? "Quote approved" : "Finish quote"}
            </li>
          </ol>
          <section
            className={`quote-next-step ${approved ? "is-complete" : ""}`}
            aria-label="Your next step"
          >
            <div className="next-step-copy">
              <p className="eyebrow">
                {approved ? "READY TO SHARE" : "YOUR NEXT STEP"}
              </p>
              <h2>
                {approved
                  ? "Your quote is ready."
                  : next
                    ? "Let’s check the items."
                    : "Give your quote a final check."}
              </h2>
              <p>
                {approved
                  ? "Download your approved quote or save it as a PDF."
                  : next
                    ? `${checked} of ${included.length} items checked. Open each item, confirm the details, then finish your quote.`
                    : w.approvalBlockers.length
                      ? "All items are checked. Review the remaining quote requirements before approval."
                      : "All items are checked. Review the total and terms, then approve."}
              </p>
              <button
                className="button primary"
                onClick={() =>
                  next && !approved ? onSelect(next) : onPreview()
                }
              >
                {approved
                  ? "Download quote"
                  : next
                    ? nextLabel
                    : "Finish quote"}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="quote-running-total">
              <span>Quote subtotal</span>
              <strong>{money(w.summary.subtotalCents)}</strong>
              <small>
                Before shipping, tax and other charges. <br />
                Items without a price are not included.
              </small>
            </div>
          </section>
          {!w.rfq.guardrail.passed && (
            <div className="error-message" role="alert">
              This request needs a safety review before approval.{" "}
              {w.rfq.guardrail.detail}
            </div>
          )}
          <div
            className={`workspace-grid restored-workspace-grid ${inspector ? "has-inspector" : ""}`}
          >
            <div className="workspace-left">
              <section
                className="quote-item-section panel line-panel"
                aria-label="Quote items"
              >
                <div className="simple-section-heading">
                  <h2>
                    Items to quote <span>{w.summary.total}</span>
                  </h2>
                  <button
                    className={`pending-toggle ${pendingOnly ? "active" : ""}`}
                    aria-pressed={pendingOnly}
                    onClick={() => setPendingOnly(!pendingOnly)}
                  >
                    Still to check
                  </button>
                </div>
                <MobileLineCards lines={rows} onSelect={onSelect} />
                <div className="table-scroll desktop-line-table">
                  <table className="line-table">
                    <thead>
                      <tr>
                        <th className="number-cell">#</th>
                        <th>Requested item</th>
                        <th>Qty</th>
                        <th>Material match</th>
                        <th>Unit price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <tr
                          key={item.id}
                          className={`${inspector && selected === item.id ? "selected" : ""} ${item.excluded ? "excluded" : ""}`}
                          onClick={() => onSelect(item)}
                        >
                          <td className="number-cell">
                            <span>{String(item.number).padStart(2, "0")}</span>
                          </td>
                          <td className="item-cell">
                            <button
                              className="table-link"
                              aria-label={`Open item ${item.number}: ${specDescription(item.spec)}, ${item.status}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelect(item);
                              }}
                            >
                              {specDescription(item.spec)}
                            </button>
                            <span className="original-text">
                              {item.original}
                            </span>
                            <span className="item-tags">
                              {item.spec.finish && (
                                <span>{item.spec.finish}</span>
                              )}
                              {item.spec.mtr && <span>MTR</span>}
                              {item.spec.origin && (
                                <span>{item.spec.origin} origin</span>
                              )}
                            </span>
                          </td>
                          <td className="quantity-cell">
                            <strong>{item.spec.quantity ?? "—"}</strong>
                            <span>{item.spec.quantityUnit || "Unknown"}</span>
                          </td>
                          <td className="match-cell">
                            {item.match ? (
                              <>
                                <span className="mono">{item.match.sku}</span>
                                <small>
                                  <CheckCircle2 size={11} />
                                  Exact match
                                </small>
                              </>
                            ) : (
                              <>
                                <span className="unmatched">
                                  Details needed
                                </span>
                                <small>Check specifications</small>
                              </>
                            )}
                          </td>
                          <td className="unit-price-cell">
                            <strong>{money(item.unitPriceCents)}</strong>
                            {item.unitPriceCents !== null && (
                              <small>/ sheet</small>
                            )}
                          </td>
                          <td className="status-column">
                            <Status
                              status={
                                item.reviewConfirmed &&
                                !item.blockers.length &&
                                !item.excluded
                                  ? "Checked"
                                  : item.status
                              }
                              compact
                            />
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
                      pendingOnly ? "Every item is checked" : "No items found"
                    }
                    detail={
                      pendingOnly
                        ? "You can finish your quote above."
                        : "Add a request with material descriptions and quantities."
                    }
                  />
                )}
              </section>
              <details className="simple-disclosure">
                <summary>
                  <FileText size={18} />
                  <span>Customer’s original request</span>
                  <ChevronDown size={17} />
                </summary>
                <div className="simple-disclosure-body">
                  <p>{w.rfq.documentName}</p>
                  <pre>{w.rfq.original}</pre>
                  {w.rfq.documentId && (
                    <a
                      className="text-button"
                      href={`/api/documents/${w.rfq.documentId}`}
                    >
                      Download original document <ArrowRight size={14} />
                    </a>
                  )}
                </div>
              </details>
              <details className="simple-disclosure">
                <summary>
                  <History size={18} />
                  <span>Activity & saved quotes</span>
                  <ChevronDown size={17} />
                </summary>
                <div className="simple-disclosure-body">
                  {w.versions.map((v) => (
                    <button
                      key={v.id}
                      className="button secondary saved-quote-link"
                      onClick={() => onVersion(v.id)}
                    >
                      Open approved quote {v.id}
                      <ArrowRight size={14} />
                    </button>
                  ))}
                  {w.history.slice(0, 6).map((event) => (
                    <div className="simple-activity" key={event.id}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>{event.action}</strong>
                        <p>{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
            {inspector}
          </div>
        </>
      ) : (
        <>
          <ProjectStages stage={stage} onChange={onStage} />
          <ProjectWorkflow
            w={w}
            stage={stage}
            onQuote={() => onStage("Quote")}
          />
        </>
      )}
      {stage === "Quote" && (
        <details className="simple-disclosure extra-tools">
          <summary>
            <span>Suppliers & production tools</span>
            <small>Optional</small>
            <ChevronDown size={17} />
          </summary>
          <div className="simple-disclosure-body">
            <p>
              Compare suppliers, estimate labor, or prepare work instructions
              for this request.
            </p>
            <ProjectStages stage={stage} onChange={onStage} />
          </div>
        </details>
      )}
    </div>
  );
}
