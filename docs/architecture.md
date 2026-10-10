# Architecture

QuoteGuard is a Next.js App Router / TypeScript modular monolith. The React UI consumes validated same-origin HTTP operations. The catch-all transport delegates imports, edits, review, approval, and export to application services. Pure domain modules do not import React, the database, or providers.

Prisma with SQLite persists RFQ aggregates, separate immutable quote versions and approvals, audit events, private document metadata, workflow runs, catalog items, benchmarks, and integration-check settings. Within each RFQ aggregate, line specifications, provenance, evidence and clarification records are serialized JSON. This is an intentional prototype simplification; these have explicit typed shapes but are not separate relational tables. Split them out when query or concurrency requirements justify it.

Money is held in integer cents. Markup uses integer basis points, calculates using BigInt, and rounds half-up at the unit price. Explicit dimension conversions use rational comparison; no unapproved dimensional tolerance is introduced. Match selection cannot approve a near product. Inventory demand is aggregated across included lines.

Mutation transactions check expectedRevision, write audit history, and persist an idempotency key. Provider work is awaited and has bounded timeouts. Failed imports retain their original request and run failure. Customer exports are constructed from an allowlist. Approved snapshots never change when drafts are edited; demo reset is the explicit destructive exception.

Uploads persist original bytes and metadata in the database. The document download endpoint enforces workspace scope and forces attachment delivery. Files are limited to 4 MB; expanded XLSX size is bounded and formulas are rejected. PDF extraction preserves page labels, CSV/XLSX preserve sheet and row labels, pasted requests preserve line labels.

Local development binds to loopback and verifies Host/Origin. Without public-demo or private authentication configuration, all local users share one development workspace and external connections are refused.

## Hosted and phone expansion

The same application can generate a SQLite Prisma client for local use or PostgreSQL for Vercel. Hosted files are database bytes, avoiding ephemeral serverless filesystem persistence. In public-demo mode the app opens without login. The catch-all API assigns a signed browser workspace cookie and applies origin checks before loading data. AsyncLocalStorage carries its scope through services and transactions. A Prisma query extension prefixes primary, foreign, and unique keys, restricts lists and bulk writes to that namespace, and returns logical IDs. Serialized domain JSON keeps logical IDs. Database access without a scope and raw queries are blocked in public mode. One Prisma connection pool is shared; scoped extensions and seed promises have bounded caches.

The cookie is HttpOnly, Secure on hosted deployments, SameSite Strict, and expires after 30 days. Clearing it starts a fresh demo. It is a browser capability, not an account or verified reviewer identity. Public sessions have a different purpose discriminator from optional owner sessions, so they cannot authenticate private mode. Existing owner records remain unscoped and are inaccessible from public workspaces. Optional private mode retains scrypt passcode verification, owner sessions, and persisted sign-in attempt limits.

Project planning state is a versioned `Setting` record per RFQ. Project commands validate the RFQ revision and compare-and-swap the serialized project record in a transaction. Supplier offer selections are tied to the requested specification. The quote review system stays independent of the internal labor-and-margin model. Instruction release is bound to both the RFQ revision and plan version and requires material quote approval.

AI explanations live in separate `Setting` records keyed by RFQ and line. Their fingerprint includes the fact bundle, RFQ revision, prompt version, and model. GET returns current facts plus a valid cached explanation; POST checks the fingerprint, reserves a bounded provider allowance, calls Nicrron, validates the structured response and citations, rechecks current facts, and saves advisory text. Quotes and approvals are untouched. The provider allowance uses a fixed server-only namespace that browser UUID cookies cannot select and a transactional compare-and-swap counter. It does not expose a general cross-workspace query endpoint.

Phone navigation uses four project stages with bottom workspace navigation. Item review uses a Radix modal drawer for focus trapping and keyboard access. Source files, private APIs, and quotes are not service-worker cached. A web manifest, maskable icon, Apple icon, safe-area padding, and standalone metadata support home-screen installation.
