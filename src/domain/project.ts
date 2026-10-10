import { z } from "zod";
import type { Workspace, Spec } from "./types";
import { specDescription } from "./match-catalog";

export const offerSchema = z
  .object({
    id: z.string().min(1).max(100),
    lineId: z.string().min(1),
    supplier: z.string().trim().min(2).max(100),
    unitCents: z.number().int().min(1).max(100000000),
    shippingCents: z.number().int().min(0).max(10000000),
    available: z.number().int().min(0).max(100000),
    leadDays: z.number().int().min(0).max(365),
    minimum: z.number().int().min(1).max(100000),
    source: z.enum(["Demo distributor", "Historical", "Manual", "Contract"]),
    reference: z.string().trim().min(3).max(500),
    notes: z.string().max(1000),
    verified: z.boolean(),
    expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export const operationSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(2).max(100),
    setupMinutes: z.number().int().min(0).max(100000),
    minutesPerUnit: z.number().min(0).max(10000),
    hourlyCents: z.number().int().min(1).max(1000000),
    tool: z.string().trim().min(2).max(120),
    instruction: z.string().trim().min(10).max(1500),
  })
  .strict();
export type SupplierOffer = z.infer<typeof offerSchema> & { specKey?: string };
export type Operation = z.infer<typeof operationSchema>;
export type Instruction = {
  id: string;
  title: string;
  body: string;
  tool: string;
  completed: boolean;
  completedAt: string | null;
};
export type Project = {
  revision: number;
  rfqRevision: number;
  offers: SupplierOffer[];
  selected: Record<string, string>;
  operations: Operation[];
  overheadBps: number;
  marginBps: number;
  instructions: Instruction[];
  instructionRfqRevision: number | null;
  instructionPlanVersion: number | null;
  planVersion: number;
  instructionReviewer: string | null;
  outreach: { id: string; supplier: string; body: string; at: string }[];
  activity: { id: string; detail: string; at: string }[];
};
export const projectCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("offer"), offer: offerSchema }),
  z.object({
    action: z.literal("select-offer"),
    lineId: z.string(),
    offerId: z.string(),
  }),
  z.object({
    action: z.literal("plan"),
    operations: z.array(operationSchema).min(1).max(30),
    overheadBps: z.number().int().min(0).max(10000),
    marginBps: z.number().int().min(0).max(9000),
  }),
  z.object({ action: z.literal("instructions") }),
  z.object({
    action: z.literal("review-instructions"),
    reviewer: z.string().trim().min(2).max(100),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("step"),
    id: z.string(),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal("draft"),
    supplier: z.string().trim().min(2).max(100),
  }),
]);
export type ProjectCommand = z.infer<typeof projectCommand>;
export const defaultOperations: Operation[] = [
  {
    id: "receiving",
    name: "Receive & identify material",
    setupMinutes: 20,
    minutesPerUnit: 2,
    hourlyCents: 4500,
    tool: "Receiving worksheet",
    instruction:
      "Check each item against the approved material list. Record supplier, SKU, lot, quantity, and visible condition. Hold material with unresolved differences.",
  },
  {
    id: "inspection",
    name: "Document & quality review",
    setupMinutes: 15,
    minutesPerUnit: 3,
    hourlyCents: 5500,
    tool: "Approved inspection checklist",
    instruction:
      "Check required mill test reports, requested standards, and origin records against each exact product and lot. A qualified reviewer must resolve missing or conflicting evidence.",
  },
  {
    id: "packing",
    name: "Pack & hand off",
    setupMinutes: 10,
    minutesPerUnit: 2,
    hourlyCents: 4000,
    tool: "Approved packing specification",
    instruction:
      "Use the reviewed packing specification. Maintain item and lot identification, count the packed quantity, and attach the approved customer documentation before handoff.",
  },
];
export function seedProject(w: Workspace): Project {
  const expires = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const offers: SupplierOffer[] =
    w.rfq.id === "RFQ-1042"
      ? w.lines
          .filter((l) => l.match)
          .flatMap((l) => [
            {
              id: `${l.id}-north`,
              lineId: l.id,
              specKey: JSON.stringify(l.spec),
              supplier: "Northline Supply",
              unitCents: l.match!.costCents,
              shippingCents: 7500,
              available: l.match!.stock,
              leadDays: 3,
              minimum: 1,
              source: "Demo distributor" as const,
              reference: "Synthetic offer N-2081 · exact catalog SKU",
              notes:
                "Sample offer. Confirm lot evidence and current availability with supplier.",
              verified: false,
              expires,
            },
            {
              id: `${l.id}-atlas`,
              lineId: l.id,
              specKey: JSON.stringify(l.spec),
              supplier: "Atlas Industrial",
              unitCents: Math.round(l.match!.costCents * 0.95),
              shippingCents: 12000,
              available: 60,
              leadDays: 8,
              minimum: 5,
              source: "Historical" as const,
              reference: "Synthetic historical job J-0920",
              notes: "Historical reference only. Reconfirmation is required.",
              verified: false,
              expires,
            },
            {
              id: `${l.id}-summit`,
              lineId: l.id,
              specKey: JSON.stringify(l.spec),
              supplier: "Summit Metals",
              unitCents: Math.round(l.match!.costCents * 1.08),
              shippingCents: 0,
              available: 30,
              leadDays: 1,
              minimum: 1,
              source: "Contract" as const,
              reference: "Synthetic contract C-004 · sample terms",
              notes:
                "Example priority service. No actual contract is in effect.",
              verified: false,
              expires,
            },
          ])
      : [];
  return {
    revision: 1,
    rfqRevision: w.rfq.revision,
    offers,
    selected: {},
    operations: structuredClone(defaultOperations),
    overheadBps: 1200,
    marginBps: 2500,
    instructions: [],
    instructionRfqRevision: null,
    instructionPlanVersion: null,
    planVersion: 1,
    instructionReviewer: null,
    outreach: [],
    activity: [],
  };
}
export function offerProblems(
  offer: SupplierOffer,
  quantity: number | null,
  today = new Date().toISOString().slice(0, 10),
  spec?: Spec,
) {
  const issues: string[] = [];
  if (spec && offer.specKey !== JSON.stringify(spec))
    issues.push("Specification changed; record a new offer");
  if (!quantity) issues.push("Confirm quantity");
  else {
    if (quantity < offer.minimum) issues.push(`Minimum ${offer.minimum}`);
    if (quantity > offer.available) issues.push("Insufficient availability");
  }
  if (offer.expires < today) issues.push("Offer expired");
  return issues;
}
export function landedCost(offer: SupplierOffer, quantity: number) {
  return offer.unitCents * quantity + offer.shippingCents;
}
export function costModel(w: Workspace, p: Project) {
  let materialCents = 0,
    covered = 0;
  const included = w.lines.filter((l) => !l.excluded);
  let units = 0;
  for (const l of included) {
    units += l.spec.quantity || 0;
    const offer = p.offers.find((o) => o.id === p.selected[l.id]);
    if (
      offer &&
      !offerProblems(offer, l.spec.quantity, undefined, l.spec).length
    ) {
      materialCents += landedCost(offer, l.spec.quantity!);
      covered++;
    } else if (l.match && l.spec.quantity) {
      materialCents += l.match.costCents * l.spec.quantity;
      covered++;
    }
  }
  const labor = p.operations.map((o) => {
    const minutes = o.setupMinutes + o.minutesPerUnit * units;
    return {
      ...o,
      minutes,
      cents: Math.floor((minutes * o.hourlyCents + 30) / 60),
    };
  });
  const laborCents = labor.reduce((s, o) => s + o.cents, 0);
  const overheadCents = Number(
    (BigInt(materialCents + laborCents) * BigInt(p.overheadBps) + 5000n) /
      10000n,
  );
  const totalCents = materialCents + laborCents + overheadCents;
  const denominator = BigInt(10000 - p.marginBps);
  const sellingCents = Number(
    (BigInt(totalCents) * 10000n + denominator / 2n) / denominator,
  );
  return {
    units,
    covered,
    total: included.length,
    materialCents,
    laborCents,
    overheadCents,
    totalCents,
    sellingCents,
    profitCents: sellingCents - totalCents,
    labor,
    minutes: labor.reduce((s, o) => s + o.minutes, 0),
  };
}
export function supplierDraft(w: Workspace, supplier: string) {
  return `Subject: Request for quotation — ${w.rfq.id}\n\nHello ${supplier},\n\nPlease quote the following for ${w.rfq.customer}:\n\n${w.lines
    .filter((l) => !l.excluded)
    .map(
      (l) =>
        `${l.number}. ${l.spec.quantity ?? "[quantity to confirm]"} ${l.spec.quantityUnit || "units"} — ${specDescription(l.spec)}${l.spec.mtr ? "; MTR required" : ""}${l.spec.standard ? `; ${l.spec.standard}` : ""}${l.spec.origin ? `; ${l.spec.origin} origin` : ""}`,
    )
    .join(
      "\n",
    )}\n\nPlease provide unit pricing in USD, quantity breaks, availability, lead time, shipping, offer validity, and lot-specific documentation. Identify any deviations explicitly. Do not substitute grades or dimensions.\n\nThank you,\nNorthline Metals\n\nDEMO DRAFT — review specifications and recipient before sending.`;
}
