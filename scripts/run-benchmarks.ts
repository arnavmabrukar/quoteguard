import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { evaluationDataset } from "../src/domain/evaluation/cases";
import { runEvaluation } from "../src/domain/evaluation/run";

// Runs only the application's deterministic rules against fixed synthetic input.
// It makes no provider requests and reads no API keys.
async function main() {
  const report = runEvaluation({
    id: randomUUID(),
    datasetHash: createHash("sha256")
      .update(JSON.stringify(evaluationDataset()))
      .digest("hex"),
    codeRevision: "local working tree",
  });
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const changed = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    report.codeRevision = sha + (changed ? " + working tree changes" : "");
  } catch {
    /* A packaged checkout may not include Git metadata. */
  }
  const dir = path.resolve(".data/evaluations", report.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "results.json"),
    JSON.stringify(report, null, 2),
  );
  await fs.writeFile(
    path.join(dir, "dataset.json"),
    JSON.stringify(evaluationDataset(), null, 2),
  );
  const markdown = [
    "# QuoteGuard software benchmark",
    "",
    `Run: ${report.ranAt}`,
    `Suite: ${report.suiteVersion}`,
    `Code: ${report.codeRevision}`,
    `Dataset SHA-256: ${report.datasetHash}`,
    "",
    `${report.summary.passed}/${report.summary.cases} scenarios passed. ${report.summary.checksPassed}/${report.summary.checks} checks passed (${report.summary.checkPassRate}%).`,
    "",
    "| Capability | Passed checks | Rate |",
    "| --- | --- | --- |",
    ...report.metrics.map(
      (m) => `| ${m.category} | ${m.passed}/${m.total} | ${m.rate}% |`,
    ),
    "",
    "## Failed checks",
    "",
    ...report.results
      .filter((r) => !r.passed)
      .flatMap((r) => [
        `### ${r.title}`,
        "",
        ...r.checks
          .filter((c) => !c.passed)
          .map(
            (c) =>
              `- ${c.field}: expected ${JSON.stringify(c.expected)}; actual ${JSON.stringify(c.actual)}.`,
          ),
        "",
      ]),
    "## Scope",
    "",
    "Actual execution of the demo rule pipeline on authored synthetic data. Every case remains in the denominator. No live LLM, PRISM evaluation, market-price feed, CAD, OCR, email delivery or production accuracy is measured. Single-run rule timing excludes network and storage. This development suite is not an independent held-out evaluation.",
    "",
  ];
  await fs.writeFile(path.join(dir, "report.md"), markdown.join("\n"));
  console.log(
    JSON.stringify(
      {
        directory: dir,
        summary: report.summary,
        metrics: report.metrics,
        failed: report.results.filter((r) => !r.passed).map((r) => r.id),
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
