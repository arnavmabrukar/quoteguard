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

The browser suite uses an installed Google Chrome and starts the server in public-demo mode. If reusing an already running server, configure `PUBLIC_DEMO=true` and a `SESSION_SECRET` first. It resets sample RFQs and creates test requests; use a disposable local database. Screenshots go to ignored `test-results/`.

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

| Variable               | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`         | Private PostgreSQL connection with TLS                     |
| `PUBLIC_DEMO=true`     | Open directly into an isolated browser workspace; no login |
| `SESSION_SECRET`       | At least 32 random characters for signed sessions          |
| `QUOTEGUARD_MODE=demo` | Explicit sample-data mode                                  |

The deployed prototype opens directly into the app. Each browser gets a signed, HttpOnly, Secure, SameSite cookie and its own database namespace. The cookie lasts 30 days; clearing it or switching browsers starts a fresh sample workspace. Saved work persists across refreshes and deployments in the same browser. There are no user accounts, cross-device sync, or recovery links. Keep this prototype to sample data.

Generate a signing secret with `node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'`. Store it privately; never commit it. Public-demo APIs fail closed if the secret is absent. All RFQs, documents, quotes, catalog entries, and project state are scoped server-side to the signed browser workspace. Uploaded source documents are stored as database bytes (4 MB maximum) and remain downloadable only within that workspace.

Optional private deployments can set `PUBLIC_DEMO=false`, `AUTH_REQUIRED=true`, and `WORKSPACE_PASSWORD_HASH` (a `salt:hex` scrypt hash). `node scripts/create-access.mjs` generates private-mode credentials. This optional mode retains the passcode screen and one owner workspace; it is disabled on the public prototype.

## Demo walkthrough

1. Review item 01: $100 supplier cost, 20% markup, $120 selling price.
2. Resolve item 02 with **Use sample buyer reply**. Confirm all five field groups and the line review.
3. Open item 03 → **Checks**, attach sample evidence, review the record, then confirm the line.
4. Preview and approve the $4,920 priced subtotal. Freight, tax, and processing remain disclosed separately. Export or print/PDF.
5. Try Source → Plan → Make. Draft supplier requests, save an estimate, generate instructions, review/release them, and complete a step.
6. Edit the RFQ or plan to verify that prior approvals cannot silently apply to changed work.

See [feature coverage](docs/feature-coverage.md), [integration status](docs/integration-status.md), [architecture](docs/architecture.md), and [limitations](docs/limitations.md).
