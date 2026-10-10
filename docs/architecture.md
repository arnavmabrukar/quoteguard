# Architecture

QuoteGuard is a Next.js App Router / TypeScript modular monolith. The React UI consumes validated same-origin HTTP operations. The catch-all transport delegates imports, edits, review, approval, and export to application services. Pure domain modules do not import React, the database, or providers.

Prisma with SQLite persists RFQ aggregates, separate immutable quote versions and approvals, audit events, private document metadata, workflow runs, catalog items, benchmarks, and integration-check settings. Within each RFQ aggregate, line specifications, provenance, evidence and clarification records are serialized JSON. This is an intentional prototype simplification; these have explicit typed shapes but are not separate relational tables. Split them out when query or concurrency requirements justify it.

Money is held in integer cents. Markup uses integer basis points, calculates using BigInt, and rounds half-up at the unit price. Explicit dimension conversions use rational comparison; no unapproved dimensional tolerance is introduced. Match selection cannot approve a near product. Inventory demand is aggregated across included lines.

Mutation transactions check expectedRevision, write audit history, and persist an idempotency key. Provider work is awaited and has bounded timeouts. Failed imports retain their original request and run failure. Customer exports are constructed from an allowlist. Approved snapshots never change when drafts are edited; demo reset is the explicit destructive exception.

Uploads use generated keys under `.data/uploads`, outside public assets. The document download endpoint enforces local access and forces attachment delivery. Files are limited to 5 MB; expanded XLSX size is bounded and formulas are rejected. PDF extraction preserves page labels, CSV/XLSX preserve sheet and row labels, pasted requests preserve line labels.

This service binds to loopback and verifies Host/Origin. It is not an authentication system; all users of the same local machine share the one reviewer workspace. Do not expose it via a proxy or tunnel.

## Hosted and phone expansion

The same application can generate a SQLite Prisma client for local use or PostgreSQL for Vercel. Hosted files are database bytes, avoiding ephemeral serverless filesystem persistence. The catch-all API applies origin and signed-session checks before loading data. `/api/auth` uses scrypt passcode verification, signed HttpOnly sessions, and persisted attempt limiting; Vercel requires authentication even with a forged loopback Host header.

Project planning state is a versioned `Setting` record per RFQ. Project commands validate the RFQ revision and compare-and-swap the serialized project record in a transaction. Supplier offer selections are tied to the requested specification. The quote review system stays independent of the internal labor-and-margin model. Instruction release is bound to both the RFQ revision and plan version and requires material quote approval.

Phone navigation uses four project stages with bottom workspace navigation. Item review uses a Radix modal drawer for focus trapping and keyboard access. Source files, private APIs, and quotes are not service-worker cached. A web manifest, maskable icon, Apple icon, safe-area padding, and standalone metadata support home-screen installation.
