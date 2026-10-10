# PRISM tracing handoff

Verified October 10, 2026 with the host supplied in the user's setup brief. This is TypeScript HTTP instrumentation; no SDK package or PostgreSQL connector is needed. Credentials are in ignored `.env.local` and the approved Vercel production configuration, with placeholders in `.env.example`. The API key is a server-side Vercel secret and is never committed to Git.

## Local operation

Start the local app with `npm run dev`. Click **Explain this item** for a line without a current saved explanation. The shared Nicrron adapter awaits a PRISM trace after the actual model response (or provider error). Reopening a cached explanation makes no new model call and no new trace. Demo RFQ parsing and `npm run benchmarks:run` remain deterministic local operations and do not create fake model traces.

Set `PRISMTRACE_HOST`, `PRISMTRACE_PROJECT_ID`, and `PRISMTRACE_API_KEY` to the exact values for the intended project. `PRISMTRACE_CAPTURE_CONTENT=false` is the default: text is replaced with omission markers and only operational metadata is sent. Set it to `true` only for data approved to be sent to PRISM. The verification used a separate temporary app, fresh database and seeded synthetic RFQ; full content capture there was temporary. Do not use scores on omission markers to claim content quality.

Use `X-PRISMtrace-Key` for authenticated verification, never a Bearer token. The required doctor endpoint is `GET $PRISMTRACE_HOST/api/setup-doctor?project_id=$PRISMTRACE_PROJECT_ID`. A handshake confirms only the credential. After invoking the real app, check `live_connected`, `blocked_step` and `overall`. The verification evidence file records the actual result without credentials.

## Deployment boundary

The supplied brief requires staging first and explicit approval before production writes. Local staging verification is complete. On October 10, 2026 the user explicitly approved storing the existing PRISM key in Vercel production and sending model names, latency, token counts, error codes and hashed session IDs to their PRISM project. Production is configured with `PRISMTRACE_CAPTURE_CONTENT=false`; prompt and response text stay off. Existing AI generation remains button-triggered; tracing does not approve quotes or change prices. The local verification evidence below remains a historical record of the isolated staging run.

## Maintenance

The repository's `AGENTS.md` contains the requested standing instrumentation rule. New model call sites should use the shared completion adapter and pass a stable logical session ID and operation. The adapter scopes that ID to the browser workspace. It awaits trace delivery with a bounded timeout and returns the model result even if PRISM is unavailable; delivery failures log only a sanitized status.

Validation: 81 unit tests, 10 browser tests, TypeScript checking and the production build passed. Tests cover content omission, secret redaction, error tracing, session isolation, awaited delivery, failed ingestion and disabled configuration. Existing phone and desktop tests continue to require a click before generating AI text.
