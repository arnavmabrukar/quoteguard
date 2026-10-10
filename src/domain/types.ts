export type Unit = "in" | "mm" | "ft";
export type Dimension = { value: number; unit: Unit } | null;
export type Spec = {
  material: string | null;
  grade: string | null;
  form: string | null;
  thickness: Dimension;
  width: Dimension;
  length: Dimension;
  finish: string | null;
  standard: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  mtr: boolean;
  origin: string | null;
  other: string[];
};
export type Provenance = {
  value: string | null;
  text: string;
  location: string;
  state: "extracted" | "confirmed" | "unknown" | "conflicting";
};
export type Evidence = {
  id: string;
  label: string;
  sku: string;
  lot: string;
  supports: ("mtr" | "standard" | "origin")[];
  origin: string | null;
  standard: string | null;
  reviewed: boolean;
  content: string;
  demo: boolean;
  reviewedAt: string | null;
};
export type Line = {
  id: string;
  number: number;
  original: string;
  location: string;
  spec: Spec;
  provenance: Record<string, Provenance>;
  issues: string[];
  evidence: Evidence[];
  selectedSku: string | null;
  reviewConfirmed: boolean;
  excluded: string | null;
  clarification: { question: string; reply: string; at: string }[];
};
export type CatalogItem = {
  sku: string;
  material: string;
  grade: string;
  form: string;
  thickness: NonNullable<Dimension>;
  width: NonNullable<Dimension>;
  length: NonNullable<Dimension>;
  finish: string;
  standard: string;
  stock: number;
  costCents: number;
  lot: string;
  evidence: Evidence[];
  updated: string;
};
export type Benchmark = {
  id: string;
  sku: string;
  priceCents: number;
  currency: string;
  unit: string;
  minimum: number;
  maximum: number;
  observed: string;
  source: string;
  terms: string;
  demo: boolean;
};
export type Event = {
  id: string;
  action: string;
  detail: string;
  lineId: string | null;
  createdAt: string;
  revision: number;
};
export type Terms = {
  shipping: string;
  tax: string;
  processing: string;
  delivery: string;
  validityDays: number;
};
export type EvaluationState =
  | "Not run"
  | "Pending"
  | "Passed"
  | "Failed"
  | "Unavailable";
export type Rfq = {
  id: string;
  customer: string;
  contact: string;
  title: string;
  original: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lines: Line[];
  markupBps: number;
  terms: Terms;
  mode: "demo" | "live";
  guardrail: { passed: boolean; detail: string };
  prism: {
    evaluation: EvaluationState;
    evaluatedRevision: number | null;
    traceId: string | null;
    telemetry: string;
    grounding: string;
  };
  approvedVersion: string | null;
  documentId: string | null;
  documentName: string;
};
export type LineStatus =
  | "Needs clarification"
  | "No catalog match"
  | "Awaiting supplier evidence"
  | "Ready for review"
  | "Approved"
  | "Excluded";
export type RequirementCheck = {
  name: string;
  status:
    | "Supporting record present"
    | "Supplier confirmation needed"
    | "Missing"
    | "Conflicting"
    | "Not requested";
  detail: string;
  evidenceId?: string;
};
export type MatchCandidate = {
  item: CatalogItem;
  exact: boolean;
  checks: {
    field: string;
    request: string;
    catalog: string;
    state: "agree" | "different" | "unknown";
  }[];
};
export type LineView = Line & {
  status: LineStatus;
  blockers: string[];
  candidates: MatchCandidate[];
  match: CatalogItem | null;
  requirements: RequirementCheck[];
  unitPriceCents: number | null;
  subtotalCents: number | null;
  benchmark: {
    available: boolean;
    priceCents?: number;
    difference?: number;
    source?: string;
    reason: string;
  };
};
export type QuoteSnapshot = {
  id: string;
  rfqId: string;
  revision: number;
  status: "DRAFT" | "APPROVED";
  customer: string;
  contact: string;
  title: string;
  issuedAt: string;
  validityDays: number;
  partial: boolean;
  demo: boolean;
  lines: {
    number: number;
    description: string;
    sku: string | null;
    quantity: number | null;
    unit: string;
    unitPriceCents: number | null;
    subtotalCents: number | null;
    documentation: string[];
    status: string;
  }[];
  exclusions: { number: number; description: string; reason: string }[];
  pricedSubtotalCents: number;
  terms: Terms;
  unresolved: string[];
};
export type Workspace = {
  rfq: Rfq;
  lines: LineView[];
  catalog: CatalogItem[];
  benchmarks: Benchmark[];
  history: Event[];
  quote: QuoteSnapshot;
  versions: { id: string; revision: number; createdAt: string }[];
  summary: {
    total: number;
    ready: number;
    clarification: number;
    evidence: number;
    attention: number;
    excluded: number;
    subtotalCents: number;
  };
  approvalBlockers: string[];
  requirePrism: boolean;
};
