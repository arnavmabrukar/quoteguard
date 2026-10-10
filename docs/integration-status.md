# Integration status

No live sponsor connection was verified during this build. No credentials were supplied. Demo mode is explicit and never replaces a failed live call.

## Nicrron

The server adapter uses the documented OpenAI-compatible `POST https://api.nicrron.ai/v1/chat/completions` endpoint. `NICRRON_MODEL` is configurable; the example `openai/gpt-4.1-mini` appears in the published model catalog. Requests use only model/messages. A 30-second timeout and strict schema/source checks protect state. The Settings connection check performs a real synthetic completion if credentials exist; a configured key alone never displays Connected.

Live extraction is implemented but unverified. Clarification drafting and interpretation in the current UI use explicit demo rules, not a verified live AI drafting integration. Do not present the latter as complete.

Sources checked October 10, 2026: [Nicrron quickstart](https://nicrron.ai/docs/quickstart), [model catalog](https://nicrron.ai/docs/models).

## Block Convey PRISM

The adapter implements documented HTTP trace ingestion using `X-PRISMtrace-Key`, stable RFQ sessions, stable `quoteguard-estimator` agent identity, and returned trace references. A received trace ID means only that ingestion was accepted. The connection check labels its trace as synthetic. The extraction path sends only a limited synthetic summary and does not claim content evaluation.

PRISM evaluation, Knowledge Base grounding, and inline prevention with Nicrron remain **Unavailable**. The reviewed public documentation did not establish the necessary callable contracts or support for chaining Nicrron through PRISM's provider proxy. No endpoints or SDKs were invented. The local regex input check and deterministic readiness evaluator are labeled as application checks, never as PRISM results.

Setting `REQUIRE_PRISM_EVALUATION=true`, or selecting live mode, blocks final approval until a current passed evaluation can be supplied by a future verified adapter. There is no browser bypass for this policy. Keep demo mode enabled for the complete prototype walkthrough.

Source: [PRISM documentation](https://blockconvey.com/docs). No live completion, trace, evaluator result, guardrail prevention, or Knowledge Base query was verified.
