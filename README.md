# QuoteGuard

A phone-first manufacturing workspace for quoting, supplier comparison, labor planning, and reviewed work instructions. Built with Next.js, React, TypeScript, Prisma, and PostgreSQL/SQLite.

This is a working prototype with clearly labeled synthetic data. It does not claim live Scint integration or complete Scint feature parity. The main workflows are functional; distributor, ERP, email, OCR, and AI integrations have explicit limits described below.

## Get started

Use Node 24 LTS (Node 22 LTS also works). Install on an internal disk; the original USB workspace produced npm filesystem errors.

```sh
npm ci
npm run db:setup
npm run dev
```

Open `http://127.0.0.1:3000`. Local development uses SQLite and accepts only loopback connections unless authentication is configured. The sample RFQ seeds on first use. No API keys are required for demo mode.

```sh
npm test
npm run typecheck
npm run test:e2e
npm run build
npm start
```

The browser suite uses an installed Google Chrome. It resets the demonstration RFQ and creates test requests; run it against a disposable local database. Screenshots go to ignored `test-results/`.

## Four connected workflows

- **Quote:** import pasted text, TXT, mapped CSV/XLSX, or text-based PDF; preserve sources; resolve ambiguity; match exact specifications; review lot evidence; calculate cents; approve immutable customer quotes; export CSV or print/PDF.
- **Source:** compare synthetic supplier offers by landed cost or lead time; record manual/historical/contract responses; check minimums, availability, expiration, and changed specifications; select an estimate source; save and copy supplier request drafts.
- **Plan:** edit setup and per-unit labor, hourly rates, operations, tools, and instruction templates; model overhead and gross margin; export an internal cost worksheet. The planning estimate is distinct from the approved material quote.
- **Make:** generate a draft from saved operations; require an approved material quote and explicit reviewer release; complete tracked steps; invalidate release when the RFQ or plan changes; export a work pack.

RFQ history, searchable catalog, benchmarks, project-context search, business connection status, and generic ERP handoff export are included. Phone screens use cards, full-screen review panels, touch-sized controls, and bottom navigation. The web manifest and icons support Add to Home Screen. The service worker provides a connection-loss page; sensitive records are not cached for offline editing.

## Hosted deployment

The Vercel build selects `prisma/postgres/schema.prisma` when `DATABASE_URL` is PostgreSQL. Local setup uses `prisma/schema.prisma` (SQLite). Keep both model definitions aligned. Database migrations are explicit:

```sh
npm run db:deploy
npm run build
```

Set these server-only environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Private PostgreSQL connection with TLS |
| `AUTH_REQUIRED=true` | Require a workspace session |
| `WORKSPACE_PASSWORD_HASH` | `salt:hex` scrypt hash, 64-byte output |
| `SESSION_SECRET` | At least 32 random characters for signed sessions |
| `QUOTEGUARD_MODE=demo` | Explicit sample-data mode |

Generate credentials locally with `node scripts/create-access.mjs`. Store the output privately; do not commit secrets. Hosted deployments fail closed if authentication is absent. Sessions use HttpOnly, Secure, SameSite cookies and expire after 14 days. Sign-in attempts are limited per client. This is one private workspace, not a multi-tenant organization product.

Uploaded source documents are persisted in the database (4 MB maximum) and require the same authenticated session as the RFQ API. The original file bytes remain available for download.

## Demo walkthrough

1. Review item 01: $100 supplier cost, 20% markup, $120 selling price.
2. Resolve item 02 with **Use sample buyer reply**. Confirm all five field groups and the line review.
3. Open item 03 → **Checks**, attach sample evidence, review the record, then confirm the line.
4. Preview and approve the $4,920 priced subtotal. Freight, tax, and processing remain disclosed separately. Export or print/PDF.
5. Try Source → Plan → Make. Draft supplier requests, save an estimate, generate instructions, review/release them, and complete a step.
6. Edit the RFQ or plan to verify that prior approvals cannot silently apply to changed work.

See [feature coverage](docs/feature-coverage.md), [integration status](docs/integration-status.md), [architecture](docs/architecture.md), and [limitations](docs/limitations.md).
