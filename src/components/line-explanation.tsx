"use client";
import { explanationFacts, type ExplanationView } from "@/domain/explanation";
import type { LineView, Workspace } from "@/domain/types";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { Check, ChevronDown, Info, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LineExplanation({ w, line }: { w: Workspace; line: LineView }) {
  const [view, setView] = useState<ExplanationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const request = useRef(0);
  const url = `rfqs/${encodeURIComponent(w.rfq.id)}/lines/${encodeURIComponent(line.id)}/explanation`;
  const basis = JSON.stringify(explanationFacts(w, line));
  useEffect(() => {
    const ticket = ++request.current;
    setView(null);
    setError("");
    setLoading(true);
    setGenerating(false);
    api<ExplanationView>(url)
      .then((result) => {
        if (request.current === ticket) setView(result);
      })
      .catch((e) => {
        if (request.current === ticket) setError(e.message);
      })
      .finally(() => {
        if (request.current === ticket) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [url, w.rfq.revision, basis, reload]);

  async function generate() {
    if (!view) return;
    const ticket = request.current;
    setGenerating(true);
    setError("");
    try {
      const result = await api<ExplanationView>(url, {
        expectedRevision: w.rfq.revision,
        fingerprint: view.fingerprint,
      });
      if (request.current === ticket) setView(result);
    } catch (e) {
      if (request.current === ticket) {
        setError((e as Error).message);
        // Refresh the source fingerprint so retry never sends stale facts.
        try {
          const latest = await api<ExplanationView>(url);
          if (request.current === ticket) setView(latest);
        } catch {
          /* Keep the original useful error. */
        }
      }
    } finally {
      if (request.current === ticket) setGenerating(false);
    }
  }
  const saved = view?.saved;
  const sources = view?.facts || explanationFacts(w, line).facts;
  return (
    <section
      className="line-explanation"
      aria-label="Catalog and price explanation"
    >
      <div className="explanation-heading">
        <span className="explanation-icon">
          <Sparkles size={17} />
        </span>
        <div>
          <h3>Need a hand checking this?</h3>
          <span>A plain-English explanation</span>
        </div>
        {saved && <span className="explanation-ai-label">AI · Nicrron</span>}
      </div>
      {saved ? (
        <div className="explanation-copy" aria-live="polite">
          <strong className="mono">
            {line.match?.sku || "No accepted match"}
          </strong>
          <p>{saved.explanation.match.text}</p>
          {line.unitPriceCents !== null && (
            <div className="explanation-price">
              <strong>
                {money(line.unitPriceCents)}
                <small> / sheet</small>
              </strong>
              {line.benchmark.available && (
                <span>vs {money(line.benchmark.priceCents)} reference</span>
              )}
            </div>
          )}
          <p>{saved.explanation.pricing.text}</p>
          <div className="explanation-evidence">
            <Info size={14} />
            <p>{saved.explanation.evidence.text}</p>
          </div>
          {saved.explanation.alternatives.length > 0 && (
            <details className="explanation-details">
              <summary>
                Why alternatives weren’t accepted{" "}
                <span>{saved.explanation.alternatives.length}</span>
                <ChevronDown size={15} />
              </summary>
              {saved.explanation.alternatives.map((a) => (
                <div className="explanation-alternative" key={a.sku}>
                  <strong className="mono">{a.sku}</strong>
                  <p>{a.text}</p>
                </div>
              ))}
            </details>
          )}
          <div className="explanation-stamp">
            <Check size={12} />
            Explanation saved
            <span>
              {new Date(saved.generatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ) : (
        <>
          <p className="explanation-intro">
            Get a short explanation of the material, price and any missing
            information.
          </p>
          <button
            className="button explanation-generate full"
            onClick={generate}
            disabled={
              loading || generating || !view?.configured || !view?.allowed
            }
          >
            {loading || generating ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            {generating
              ? "Writing explanation…"
              : loading
                ? "Checking saved explanation…"
                : "Explain this item"}
          </button>
          <p className="explanation-note" role="status">
            {generating
              ? "Nicrron is reviewing the checked facts. You can keep reviewing this item."
              : view && !view.allowed
                ? "Resolve the flagged request before using AI."
                : view && !view.configured
                  ? "AI isn’t connected yet. You can still review the checked facts below."
                  : "Shares this item’s specification and price checks with Nicrron."}
          </p>
        </>
      )}
      {error && (
        <p className="explanation-error" role="alert">
          {error}
        </p>
      )}
      {!view && !loading && (
        <button
          className="button secondary full"
          onClick={() => setReload((value) => value + 1)}
        >
          Retry loading explanation
        </button>
      )}
      <details className="explanation-details explanation-sources">
        <summary>
          <Check size={14} />
          See the facts behind this
          <ChevronDown size={15} />
        </summary>
        <ul>
          {sources.map((fact) => (
            <li key={fact.id}>{fact.text}</li>
          ))}
        </ul>
      </details>
      <p className="explanation-footnote">
        {w.rfq.mode === "demo" ? "Sample data · " : ""}AI explains. You review
        and approve.
      </p>
    </section>
  );
}
