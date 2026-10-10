"use client";
import { dimensionLabel, specDescription } from "@/domain/match-catalog";
import type { LineView, Workspace } from "@/domain/types";
import { money } from "@/lib/format";
import {
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  Layers3,
  MessageSquareText,
  Plus,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Status } from "./ui";
export function useCompactLayout() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width:1180px)");
    const update = () => setCompact(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return compact;
}
export function MobileSummary({ w }: { w: Workspace }) {
  return (
    <div className="mobile-summary">
      <div className="mobile-progress">
        <div>
          <span className="mobile-step">
            {w.rfq.approvedVersion
              ? "REVIEW COMPLETE"
              : "STEP 3 OF 4 · MATCH & PRICE"}
          </span>
          <h2>
            {w.rfq.approvedVersion
              ? "Your quote is approved"
              : w.summary.attention
                ? `${w.summary.attention} items to resolve`
                : "Ready for your final review"}
          </h2>
          <p>
            <CheckCircle2 size={14} />
            {w.summary.ready} of {w.summary.total} items ready
            {w.summary.excluded ? ` · ${w.summary.excluded} excluded` : ""}
          </p>
        </div>
        <span className="mobile-progress-count">
          {w.summary.ready}
          <span>/{w.summary.total}</span>
        </span>
      </div>
      <div className="mobile-subtotal">
        <div>
          <span>Priced subtotal</span>
          <small>Unresolved lines & charges excluded</small>
        </div>
        <strong>{money(w.summary.subtotalCents)}</strong>
      </div>
    </div>
  );
}
export function MobileLineCards({
  lines,
  onSelect,
}: {
  lines: LineView[];
  onSelect: (l: LineView) => void;
}) {
  return (
    <div className="mobile-line-cards">
      {lines.map((line) => (
        <button
          className={`mobile-line-card ${line.excluded ? "is-excluded" : ""}`}
          key={line.id}
          onClick={() => onSelect(line)}
          aria-label={`Open item ${line.number}: ${specDescription(line.spec)}, ${line.status}`}
        >
          <div className="mobile-card-top">
            <span>ITEM {String(line.number).padStart(2, "0")}</span>
            <Status
              status={
                line.reviewConfirmed && !line.blockers.length && !line.excluded
                  ? "Checked"
                  : line.status
              }
            />
          </div>
          <div className="mobile-card-product">
            <span className="mobile-product-icon">
              <Layers3 size={23} />
            </span>
            <div>
              <h3>{line.spec.grade || "Unspecified grade"} stainless steel</h3>
              <p>
                {line.spec.thickness
                  ? `${dimensionLabel(line.spec.thickness)} · ${dimensionLabel(line.spec.width)} × ${dimensionLabel(line.spec.length)}`
                  : "Dimensions need confirmation"}
              </p>
              <span>
                {line.spec.finish || "Finish not specified"}
                {line.spec.mtr ? " · Material test report needed" : ""}
                {line.spec.origin ? ` · ${line.spec.origin} origin` : ""}
              </span>
            </div>
          </div>
          <div className="mobile-card-price">
            <span>
              <b>{line.spec.quantity ?? "—"}</b> sheets
            </span>
            <span>
              {line.unitPriceCents === null ? (
                <em>Price pending</em>
              ) : (
                <>
                  <b>{money(line.unitPriceCents)}</b> / sheet
                </>
              )}
            </span>
          </div>
          <div
            className={`mobile-card-action ${line.blockers.length ? "needs-action" : ""}`}
          >
            <span>
              {line.excluded ? (
                "Excluded: " + line.excluded
              ) : line.status === "Needs clarification" ? (
                <>
                  <MessageSquareText size={15} />
                  Add missing details
                </>
              ) : line.status === "Awaiting supplier evidence" ? (
                <>
                  <FileCheck2 size={15} />
                  Check documents
                </>
              ) : line.status === "No catalog match" ? (
                <>
                  <Layers3 size={15} />
                  Check material options
                </>
              ) : line.reviewConfirmed ? (
                <>
                  <CheckCircle2 size={15} />
                  Item checked
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Check this item
                </>
              )}
            </span>
            <ChevronRight size={17} />
          </div>
        </button>
      ))}
    </div>
  );
}
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [installed, setInstalled] = useState(false),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const before = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section className="panel install-card">
      <span className="install-card-icon">
        <Smartphone size={24} />
      </span>
      <div>
        <h2>
          {installed ? "On your home screen" : "QuoteGuard, one tap away"}
        </h2>
        <p>
          {installed
            ? "You’re using the installed app."
            : "Add QuoteGuard to your home screen for a simpler, full-screen workspace."}
        </p>
        {!installed && (
          <button
            className="button secondary"
            onClick={async () => {
              if (prompt) {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
              } else setExpanded(!expanded);
            }}
          >
            <Plus size={15} />
            {prompt
              ? "Add to home screen"
              : expanded
                ? "Hide install instructions"
                : "How to add to home screen"}
          </button>
        )}
        {expanded && (
          <div className="install-instructions">
            <p>
              <strong>iPhone / iPad</strong>
              <br />
              Open in Safari, tap Share, then Add to Home Screen.
            </p>
            <p>
              <strong>Android</strong>
              <br />
              Open in Chrome, tap the menu, then Install app or Add to Home
              screen.
            </p>
            <p className="microcopy">
              Your installed app uses the same workspace and requires a
              connection to save changes.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="connection-banner" role="status">
      <WifiOff size={16} />
      You’re offline. Reconnect to load or save your quote.
    </div>
  ) : null;
}
