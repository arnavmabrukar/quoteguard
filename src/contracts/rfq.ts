import { z } from "zod";
const dimension = z
  .object({
    value: z.number().positive().max(100000),
    unit: z.enum(["in", "mm", "ft"]),
  })
  .nullable();
export const specSchema = z
  .object({
    material: z.string().max(100).nullable(),
    grade: z.string().max(30).nullable(),
    form: z.string().max(50).nullable(),
    thickness: dimension,
    width: dimension,
    length: dimension,
    finish: z.string().max(50).nullable(),
    standard: z.string().max(100).nullable(),
    quantity: z.number().int().positive().max(100000).nullable(),
    quantityUnit: z.string().max(30).nullable(),
    mtr: z.boolean(),
    origin: z.string().max(100).nullable(),
    other: z.array(z.string().max(300)).max(20),
  })
  .strict();
const base = {
  expectedRevision: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
};
export const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("edit"),
    lineId: z.string(),
    spec: specSchema,
  }),
  z.object({
    ...base,
    action: z.literal("clarify"),
    lineId: z.string(),
    spec: specSchema,
    reply: z.string().min(5).max(10000),
    confirmed: z.literal(true),
  }),
  z.object({ ...base, action: z.literal("evidence"), lineId: z.string() }),
  z.object({
    ...base,
    action: z.literal("review-evidence"),
    lineId: z.string(),
    evidenceId: z.string(),
    confirmed: z.literal(true),
  }),
  z.object({
    ...base,
    action: z.literal("review-line"),
    lineId: z.string(),
    confirmed: z.literal(true),
  }),
  z.object({
    ...base,
    action: z.literal("select"),
    lineId: z.string(),
    sku: z.string(),
  }),
  z.object({
    ...base,
    action: z.literal("exclude"),
    lineId: z.string(),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({ ...base, action: z.literal("restore"), lineId: z.string() }),
  z.object({
    ...base,
    action: z.literal("pricing"),
    markupBps: z.number().int().min(0).max(10000),
  }),
  z.object({
    ...base,
    action: z.literal("terms"),
    terms: z.object({
      shipping: z.string().trim().min(1).max(300),
      tax: z.string().trim().min(1).max(300),
      processing: z.string().trim().min(1).max(300),
      delivery: z.string().trim().min(1).max(300),
      validityDays: z.number().int().min(1).max(90),
    }),
  }),
  z.object({
    ...base,
    action: z.literal("approve"),
    reviewer: z.string().trim().min(2).max(100),
    confirmed: z.literal(true),
  }),
]);
export type Mutation = z.infer<typeof mutationSchema>;
export const createSchema = z.object({
  customer: z.string().trim().min(1).max(150),
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(5).max(60000),
  documentId: z.string().nullable().optional(),
  sheet: z.string().optional(),
  descriptionColumn: z.number().int().min(0).max(50).optional(),
  quantityColumn: z.number().int().min(0).max(50).nullable().optional(),
  idempotencyKey: z.string().uuid(),
});
export const extractionSchema = z
  .object({
    lines: z
      .array(
        z.object({
          original: z.string().min(1).max(5000),
          location: z.string().max(200),
          spec: specSchema,
          issues: z.array(z.string().max(300)),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();
