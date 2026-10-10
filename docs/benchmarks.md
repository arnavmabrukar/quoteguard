# QuoteGuard software benchmarks

The user selected local benchmarks first. BlockConvey PRISM is not connected to this suite, and no trace or evaluator call is made by the runner. CAD remains outside this work.

## What runs

`src/domain/evaluation/cases.ts` defines 24 synthetic scenarios with 85 independently authored expected answers. `run.ts` executes the same demo extraction, exact catalog matching, cost-plus pricing, comparable-price selection, evidence checks and approval gates used by the application. It attaches sample catalog evidence as the demo import does. Tests never modify a real RFQ or approve/send a quote.

The catalog, supplier costs, market references and evidence are synthetic. The reference date is fixed at 2026-10-10T16:00:00Z so date-dependent checks are reproducible. The dataset SHA-256 includes inputs, setup, expected answers, catalog, price references and suite version. Hosted runs record the Vercel commit; local CLI runs record the Git commit plus a working-tree-change marker when available.

A scenario passes only when every check passes. Overall check rate = passed checks / all checks. Capability rates use the same calculation within each category. Execution exceptions count as failed checks. No case is removed for failing. Timing is the p95 of one pass over the scenarios; it excludes network, LLM, database and UI time and is not a production latency benchmark.

This is a development suite, not a held-out dataset or a statistically representative accuracy estimate. Many cases are related. It does not test live extraction, AI explanation quality, OCR/CAD, real certificates, email delivery or supplier APIs. No claim of 100% model confidence or production readiness follows from these results.

## First measured run

On October 10, 2026, the initial implementation passed 21/24 scenarios and 78/85 checks (91.8%). Parsing: 28/33; catalog matching: 11/12; pricing: 13/13; compliance: 5/6; review safeguards: 21/21. These are measurements of the initial fixed suite, not constants used by the UI.

The three failed scenarios remain visible:

- `negated-mtr`: “MTR not required” is incorrectly read as an MTR requirement.
- `canadian-origin`: “Canadian origin required” is not retained as a country restriction.
- `named-dimensions`: width/length/thickness presented out of order are assigned by position rather than their labels, causing a missed catalog match.

Future fixes should improve these results without changing the intended expected answers. Version the suite if cases or expected behavior change.

## Run and share

From the app: Settings → Software benchmarks → Run benchmark. The latest result is stored under the current signed browser workspace; reload preserves it. A fresh browser starts with no report. The API accepts only `{ "action": "run" }`; clients cannot submit scores. JSON exports contain the raw evidence. Each run replaces the latest report; download a result before rerunning if you want to keep it.

From the repository: `npm run benchmarks:run`. This requires the installed Node dependencies but no database, API key or network. It writes `results.json`, `dataset.json` and `report.md` into a unique `.data/evaluations/<run-id>/` directory. Known benchmark failures are data, not a CLI infrastructure error; inability to execute or write the report exits nonzero.

## Later BlockConvey integration

[PRISM documentation](https://blockconvey.com/docs) documents HTTP trace ingestion, automatic scoring, project credentials and data export. Its [Synthetic Scenarios](https://blockconvey.com/prism/synthetic-scenarios) feature is beta, while the [Evaluators Hub](https://blockconvey.com/prism/evaluators) requires Builder (checked October 10, 2026).

The local dataset and results are generic JSON exports; no compatibility with a PRISM dataset-import schema has been verified. After project access is available, confirm the supported import/evaluator contract, submit bounded synthetic traces, and retrieve actual results. Label local field-level checks separately from PRISM model judgments. A stored trace ID proves receipt, not a passing evaluation. Use an independently reviewed held-out RFQ set before making broader accuracy claims.
