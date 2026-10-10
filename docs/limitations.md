# Prototype limitations

- Hosted access is one passcode-protected workspace. There is no multi-tenant isolation, organization management, SSO, role-based authorization, password recovery, or approval identity verification. Reviewer names are attestations entered by the workspace user.
- No actual buyer/supplier messaging, ERP sync, purchase orders, stock reservation, distributor API pricing, or real certification. Email and ERP connection states are explicit. Handoff exports require provider-specific mapping.
- Nicrron extraction and PRISM trace adapters are implemented but unverified without credentials. PRISM evaluation, grounding, and inline prevention with Nicrron remain unavailable. Live policy blocks approval rather than fabricating a pass.
- Demo extraction is conservative and limited to recognizable stainless sheet vocabulary, one item per source line. PDF extraction is text-only; there is no OCR, drawing recognition, or complex table reconstruction. Spreadsheet formulas are rejected.
- Supplier offers support manual records, simple pasted price/stock/lead extraction, synthetic distributor examples, and labeled historical/contract examples. Selecting an offer affects the internal planning estimate, not the independently reviewed material quote. Shipping is entered per offered line; consolidated freight is not calculated.
- Evidence attachment currently uses synthetic demonstration records. Real mill-test-report processing requires an additional reviewed evidence workflow.
- Labor calculations use reviewer-entered assumptions. Work instructions come from editable operation templates, not an engineering model. A qualified person must review actual manufacturing instructions. The prototype cannot certify operational safety or quality.
- Gross-margin modeling includes material, labor, and percentage overhead. Tax, freight outside selected line offers, and other commercial charges are not calculated automatically. Unresolved materials are visibly excluded from partial estimates.
- The local pattern-based input guard is not comprehensive prompt-injection detection. Strict schemas, deterministic calculations, and approval gates are independent of source-document instructions.
- Catalog imports add new SKUs only. Existing SKU cost/stock replacement awaits propagation and revision management across RFQs.
- Offline behavior is a connection-loss page; no cached private data or offline writes. Home-screen installation still needs connectivity and a valid workspace session.
- Uploaded files are limited to 4 MB and stored in PostgreSQL in hosted mode. This is suitable for a small prototype; production document retention and object storage are future work.
- Quote approvals are immutable snapshots. Instruction checklists retain the latest draft and event history; regeneration replaces the working checklist. Export before regenerating if a separate work-pack copy is needed.
- Saved changes survive refresh and deployment in PostgreSQL. Unsaved dialog edits remain only in memory. Local SQLite data stays in the development checkout's ignored `.data` folder.
