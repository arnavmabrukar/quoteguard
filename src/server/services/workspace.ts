import "server-only";
import { getBenchmarks, getCatalog, getRfq } from "../repositories";
import { db } from "../db";
import { approvalBlockers, buildQuote, reviewLines } from "@/domain/review";
import type { Workspace } from "@/domain/types";
export const requirePrism = () =>
  process.env.REQUIRE_PRISM_EVALUATION === "true" ||
  process.env.QUOTEGUARD_MODE === "live";
export async function getWorkspace(id: string): Promise<Workspace> {
  const [rfq, catalog, benchmarks] = await Promise.all([
    getRfq(id),
    getCatalog(),
    getBenchmarks(),
  ]);
  const [events, versions] = await Promise.all([
    db.auditEvent.findMany({
      where: { rfqId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.quoteVersion.findMany({
      where: { rfqId: id },
      orderBy: { revision: "desc" },
    }),
  ]);
  const now = new Date().toISOString();
  const lines = reviewLines(rfq, catalog, benchmarks, now);
  const approved = versions.find((v) => v.id === rfq.approvedVersion);
  return {
    rfq,
    catalog,
    benchmarks,
    lines,
    history: events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    versions: versions.map((v) => ({
      id: v.id,
      revision: v.revision,
      createdAt: v.createdAt.toISOString(),
    })),
    quote: approved
      ? JSON.parse(approved.snapshot)
      : buildQuote(rfq, lines, now),
    summary: {
      total: lines.length,
      ready: lines.filter((l) =>
        ["Ready for review", "Approved"].includes(l.status),
      ).length,
      clarification: lines.filter((l) => l.status === "Needs clarification")
        .length,
      evidence: lines.filter((l) => l.status === "Awaiting supplier evidence")
        .length,
      attention: lines.filter(
        (l) => !["Ready for review", "Approved", "Excluded"].includes(l.status),
      ).length,
      excluded: lines.filter((l) => l.excluded).length,
      subtotalCents: lines.reduce((s, l) => s + (l.subtotalCents || 0), 0),
    },
    approvalBlockers: approvalBlockers(rfq, lines, requirePrism()),
    requirePrism: requirePrism(),
  };
}
