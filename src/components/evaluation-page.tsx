"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FlaskConical,
  Loader2,
  Play,
  TriangleAlert,
} from "lucide-react";
import type { EvaluationReport } from "@/domain/evaluation/run";
import { api } from "@/lib/api";
import { ErrorMessage, Status } from "./ui";

export function EvaluationPage({ onBack }: { onBack: () => void }) {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ latest: EvaluationReport | null; caseCount: number }>("evaluation")
      .then((result) => {
        if (active) {
          setReport(result.latest);
          setCount(result.caseCount);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run() {
    setRunning(true);
    setError("");
    try {
      setReport(await api<EvaluationReport>("evaluation", { action: "run" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `quoteguard-benchmark-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="evaluation-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Settings
      </button>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">SOFTWARE BENCHMARKS</div>
          <h1>Put QuoteGuard to the test.</h1>
          <p>
            Repeatable RFQ scenarios. Expected answers. Every result open to
            inspection.
          </p>
        </div>
        <button
          className="button primary"
          disabled={loading || running}
          onClick={run}
        >
          {running ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Play size={16} />
          )}{" "}
          {running ? "Running checks…" : report ? "Run again" : "Run benchmark"}
        </button>
      </div>
      <ErrorMessage message={error} />
      <section className="panel evaluation-context">
        <FlaskConical size={20} />
        <div>
          <strong>Synthetic cases. Measured results.</strong>
          <p>
            These {count || "sample"} cases run the demo parsing, catalog,
            pricing, and review rules. Scores describe this fixed test set, not
            real-world accuracy or live market prices. No AI calls, messages, or
            changes to your quotes.
          </p>
        </div>
      </section>
      {loading ? (
        <p className="loading-inline">
          <Loader2 size={18} className="spin" /> Loading saved results…
        </p>
      ) : !report ? (
        <section className="panel evaluation-empty">
          <h2>Ready when you are</h2>
          <p>
            Run the benchmark to see pass rates, failures, and the exact
            expected and actual answers. Results are never prefilled.
          </p>
        </section>
      ) : (
        <>
          <div className="evaluation-totals" aria-label="Benchmark summary">
            <div className="panel">
              <span>Scenarios passed</span>
              <strong>
                {report.summary.passed}
                <small> / {report.summary.cases}</small>
              </strong>
              <p>{report.summary.failed} need attention</p>
            </div>
            <div className="panel">
              <span>Checks passed</span>
              <strong>{report.summary.checkPassRate}%</strong>
              <p>
                {report.summary.checksPassed} of {report.summary.checks}{" "}
                expected answers
              </p>
            </div>
            <div className="panel">
              <span>Rule processing · p95</span>
              <strong>
                {report.summary.p95Ms.toFixed(2)}
                <small> ms</small>
              </strong>
              <p>Single run; excludes network, AI and database</p>
            </div>
          </div>
          <section className="panel evaluation-metrics">
            <div className="simple-section-heading">
              <h2>Results by capability</h2>
              <span>QuoteGuard checks</span>
            </div>
            {report.metrics.map((metric) => (
              <div className="evaluation-metric" key={metric.category}>
                <div>
                  <strong>{metric.category}</strong>
                  <span>
                    {metric.passed} / {metric.total} checks
                  </span>
                </div>
                <div className="evaluation-meter">
                  <span style={{ width: `${metric.rate}%` }} />
                </div>
                <b>{metric.rate}%</b>
              </div>
            ))}
          </section>
          <div className="evaluation-results-heading">
            <h2>Inspect the evidence</h2>
            <button
              className={`pending-toggle ${failuresOnly ? "active" : ""}`}
              aria-pressed={failuresOnly}
              onClick={() => setFailuresOnly(!failuresOnly)}
            >
              Failures only
            </button>
          </div>
          <div className="evaluation-cases">
            {report.results
              .filter((r) => !failuresOnly || !r.passed)
              .map((result) => (
                <details key={result.id} className="panel evaluation-case">
                  <summary>
                    {result.passed ? (
                      <CheckCircle2 size={18} className="green" />
                    ) : (
                      <TriangleAlert size={18} className="amber" />
                    )}
                    <span>
                      <strong>{result.title}</strong>
                      <small>
                        {result.checks.filter((c) => c.passed).length} /{" "}
                        {result.checks.length} checks passed
                      </small>
                    </span>
                    <Status status={result.passed ? "Passed" : "Failed"} />
                  </summary>
                  <div className="evaluation-case-body">
                    <p className="section-caption">Synthetic request</p>
                    <blockquote>{result.input}</blockquote>
                    {result.error && (
                      <p className="error-message">{result.error}</p>
                    )}
                    <div className="evaluation-checks">
                      {result.checks.map((check) => (
                        <div
                          className={`evaluation-check ${check.passed ? "passed" : "failed"}`}
                          key={check.field}
                        >
                          <strong>{check.field}</strong>
                          <span>
                            {check.passed ? "Pass" : "Fail"} · {check.category}
                          </span>
                          <dl>
                            <div>
                              <dt>Expected</dt>
                              <dd>{JSON.stringify(check.expected)}</dd>
                            </div>
                            <div>
                              <dt>Actual</dt>
                              <dd>{JSON.stringify(check.actual)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
          </div>
          {failuresOnly && report.summary.failed === 0 && (
            <p className="evaluation-empty">
              All scenarios passed in this run.
            </p>
          )}
          <section className="panel evaluation-method">
            <h2>How to read these numbers</h2>
            <p>
              A scenario passes only when every expected answer matches. Each
              capability reports passed checks / total checks; the overall check
              rate weights every check equally. Failed scenarios remain in the
              denominator.
            </p>
            <p>
              This is a small development suite with authored expectations,
              including known limitations. It does not evaluate live Nicrron
              extraction or explanation quality, document OCR, CAD, email
              delivery, or real certificate validity.
            </p>
            <dl>
              <div>
                <dt>Suite</dt>
                <dd>{report.suiteVersion}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd>{new Date(report.ranAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Code revision</dt>
                <dd>{report.codeRevision}</dd>
              </div>
              <div>
                <dt>Dataset SHA-256</dt>
                <dd>{report.datasetHash}</dd>
              </div>
              <div>
                <dt>Reference date</dt>
                <dd>
                  {report.referenceTime} · fixed for reproducible price-age
                  checks
                </dd>
              </div>
            </dl>
            <div className="evaluation-actions">
              <button className="button secondary" onClick={download}>
                <Download size={16} />
                Download results
              </button>
              <a
                className="button secondary"
                href="/api/evaluation/dataset"
                download
              >
                <Download size={16} />
                Download test data
              </a>
            </div>
          </section>
        </>
      )}
      <section className="panel evaluation-provider">
        <div>
          <div className="eyebrow">BLOCKCONVEY PRISM</div>
          <h2>External evaluation</h2>
          <p>
            The scores above come from QuoteGuard’s test runner. PRISM trace
            receipt and evaluator verdicts are separate evidence; neither is
            assumed from a successful upload.
          </p>
          <p>
            PRISM is not connected to these benchmark runs. Download the test
            data and results to prepare an external evaluation. Synthetic
            Scenarios requires beta access; the Evaluators Hub requires Builder.
          </p>
        </div>
        <a
          className="button secondary"
          href="https://prism.blockconvey.com"
          target="_blank"
          rel="noreferrer"
        >
          Open PRISM <ArrowUpRight size={16} />
        </a>
      </section>
    </div>
  );
}
