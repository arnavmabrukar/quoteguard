import "server-only";
import { db } from "./db";
import { demoBenchmarks, demoCatalog, seedRfq } from "@/domain/fixtures";
import type { Benchmark, CatalogItem, Rfq } from "@/domain/types";
import { AppError } from "./access";
import { workspaceScope } from "./workspace-context";
const seeds = new Map<string, Promise<void>>();
export function ensureSeed() {
  const key = workspaceScope() || "owner";
  let promise = seeds.get(key);
  if (!promise) {
    if (seeds.size >= 500) seeds.delete(seeds.keys().next().value!);
    promise = seed().catch((e) => {
      seeds.delete(key);
      throw e;
    });
    seeds.set(key, promise);
  }
  return promise;
}
async function seed() {
  const rfq = seedRfq();
  await db.$transaction(
    async (tx) => {
      for (const c of demoCatalog)
        await tx.catalogItem.upsert({
          where: { sku: c.sku },
          create: { sku: c.sku, data: JSON.stringify(c) },
          update: {},
        });
      for (const b of demoBenchmarks)
        await tx.benchmark.upsert({
          where: { id: b.id },
          create: { id: b.id, data: JSON.stringify(b) },
          update: {},
        });
      const exists = await tx.rfq.findUnique({ where: { id: rfq.id } });
      if (!exists) {
        await tx.rfq.create({
          data: { id: rfq.id, revision: 1, data: JSON.stringify(rfq) },
        });
        await tx.auditEvent.create({
          data: {
            id: crypto.randomUUID(),
            rfqId: rfq.id,
            revision: 1,
            action: "Demo RFQ imported",
            detail:
              "3 source lines extracted. One exact match is ready; two lines need attention.",
          },
        });
      }
    },
    { timeout: 15000 },
  );
}
export async function getRfq(id: string): Promise<Rfq> {
  await ensureSeed();
  const row = await db.rfq.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "RFQ not found.");
  return { ...JSON.parse(row.data), revision: row.revision };
}
export async function getCatalog(): Promise<CatalogItem[]> {
  await ensureSeed();
  return (await db.catalogItem.findMany()).map((row) => JSON.parse(row.data));
}
export async function getBenchmarks(): Promise<Benchmark[]> {
  await ensureSeed();
  return (await db.benchmark.findMany()).map((row) => JSON.parse(row.data));
}
