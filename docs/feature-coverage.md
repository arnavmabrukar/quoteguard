# Feature coverage

Reference: [Scint product overview](https://www.scint.ai/product/), reviewed October 10, 2026. The user selected a working prototype with sample data for the first release.

| Workflow | Working prototype | Remaining live capability |
| --- | --- | --- |
| Connected project | RFQ, source, estimate, instructions, history, and document references | Multi-user collaboration and permissions |
| Document intelligence | TXT/pasted text, CSV/XLSX mapping, text PDF; conservative sheet extraction with provenance | OCR, drawing interpretation, complex tables, general-purpose industrial BOMs |
| Material pricing | Exact catalog pricing, benchmarks, manually recorded and synthetic supplier offers | Live distributor APIs, contracts, inventory reservations |
| Sourcing | Landed cost/lead comparison, source provenance, minimum/stock/expiry checks, saved RFQ drafts | Actual outreach, automatic reminders, inbox attachment ingestion |
| Labor estimation | Editable setup/per-unit time, rates, tools, overhead, target margin, cost export | Predictive models and historical ERP jobs |
| Work instructions | Template generation, human release, revision checks, tracked completion, work-pack export | Validated engineering instructions, drawing-aware generation |
| Context assistance | Search current items, supplier records, operations, and audit history | Conversational AI with verified tool actions |
| ERP | Generic, versioned JSON handoff with quote status and unresolved items | Epicor/SAP/Dynamics adapters and synchronization |
| Email | Reviewed, copyable supplier and clarification drafts | Outlook/Gmail/IMAP/SMTP authorization and sending |
| Custom rules | Deterministic grade/unit/stock/evidence/price policies, editable operations/templates | Visual rules builder and customer extensions |
| Phone and hosting | Responsive cards, focused drawers, installable manifest, private Vercel + Neon deployment | Offline editing/sync, native push, tenant administration |

Synthetic suppliers and quotes are labeled throughout. Manual entries are user-provided references, not verified current market data. A trace submission is never represented as an AI evaluation pass. No external message is sent by the prototype.
