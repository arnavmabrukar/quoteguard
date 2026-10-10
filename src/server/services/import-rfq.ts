import "server-only";
import { z } from "zod";
import { createSchema } from "@/contracts/rfq";
import { extractDemo, provenanceFor } from "@/domain/extract-demo";
import { checkInput } from "@/domain/guardrail";
import { seedRfq } from "@/domain/fixtures";
import { reviewLines } from "@/domain/review";
import { db } from "../db";
import { getCatalog, getBenchmarks } from "../repositories";
import { extractLive } from "../integrations/nicrron";
import type { TraceResult } from "../integrations/prism";
import { AppError } from "../access";
export async function importRfq(input: z.infer<typeof createSchema>) {
  const [catalog, benchmarks] = await Promise.all([
    getCatalog(),
    getBenchmarks(),
  ]);
  const existing = await db.workflowRun.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { id: existing.rfqId };
  let text = input.text;
  let locations: string[] = [];
  let filename = "Pasted request";
  if (input.documentId) {
    const doc = await db.document.findUnique({
      where: { id: input.documentId },
    });
    if (!doc) throw new AppError(404, "DOCUMENT", "Source document not found.");
    filename = doc.filename;
    const parsed = JSON.parse(doc.data);
    if (parsed.sheets?.length) {
      const sheet = parsed.sheets.find(
        (s: { name: string }) => s.name === input.sheet,
      );
      if (!sheet) throw new AppError(422, "SHEET", "Choose a worksheet.");
      const dc = input.descriptionColumn ?? 0;
      text = sheet.rows
        .slice(1)
        .map((row: string[], i: number) => {
          locations.push(`${sheet.name} · row ${i + 2}`);
          return `${input.quantityColumn != null && row[input.quantityColumn] ? `${row[input.quantityColumn]} sheets, ` : ""}${row[dc] || ""}`;
        })
        .join("\n");
    } else {
      text = parsed.text;
      locations = parsed.locations || [];
    }
  }
  const id = `RFQ-${Date.now().toString().slice(-7)}`;
  const now = new Date().toISOString();
  const rfq = {
    ...seedRfq(now),
    id,
    customer: input.customer,
    contact: "Purchasing team",
    title: input.title,
    original: text,
    lines: [],
    mode: (process.env.QUOTEGUARD_MODE === "live" ? "live" : "demo") as
      | "live"
      | "demo",
    documentName: filename,
    documentId: input.documentId || null,
    guardrail: checkInput(text),
  };
  const runId = crypto.randomUUID();
  await db.$transaction(async (tx) => {
    await tx.rfq.create({
      data: { id, revision: 1, data: JSON.stringify(rfq) },
    });
    await tx.workflowRun.create({
      data: {
        id: runId,
        rfqId: id,
        revision: 1,
        idempotencyKey: input.idempotencyKey,
        operation: "import",
        stage: "Source saved",
        status: "Processing",
      },
    });
  });
  try {
    let lines;
    let extractionTrace: TraceResult | undefined;
    if (!rfq.guardrail.passed) lines = extractDemo(text);
    else if (rfq.mode === "demo") lines = extractDemo(text);
    else {
      const extracted = await extractLive(text, {
        sessionId: id,
        revision: 1,
        operation: "rfq-extraction",
        onResult: (result) => {
          extractionTrace = result;
        },
      });
      lines = extracted.map((l, i) => ({
        ...l,
        id: `line-${i + 1}`,
        number: i + 1,
        provenance: provenanceFor(l.spec, l.original, l.location),
        evidence: [],
        selectedSku: null,
        reviewConfirmed: false,
        excluded: null,
        clarification: [],
      }));
    }
    lines.forEach((l) => {
      const sourceLine = Number(l.location.match(/Line (\d+)/)?.[1]);
      if (sourceLine && locations[sourceLine - 1]) {
        l.location = locations[sourceLine - 1];
        l.provenance = provenanceFor(l.spec, l.original, l.location);
      }
    });
    const completed = { ...rfq, lines };
    const reviewed = reviewLines(completed, catalog, benchmarks, now);
    for (const l of lines) {
      l.evidence = structuredClone(
        reviewed.find((v) => v.id === l.id)?.match?.evidence || [],
      );
    }
    if (extractionTrace)
      completed.prism = { ...completed.prism, ...extractionTrace };
    await db.$transaction(async (tx) => {
      await tx.rfq.update({
        where: { id },
        data: { data: JSON.stringify(completed) },
      });
      await tx.workflowRun.update({
        where: { id: runId },
        data: {
          stage: "Match & price completed",
          status: rfq.guardrail.passed ? "Completed" : "Blocked",
        },
      });
      await tx.auditEvent.create({
        data: {
          id: crypto.randomUUID(),
          rfqId: id,
          revision: 1,
          action: rfq.guardrail.passed
            ? "RFQ imported"
            : "Input guardrail blocked request",
          detail: rfq.guardrail.passed
            ? `${lines.length} line items extracted in explicit ${rfq.mode} mode. Source preserved.`
            : rfq.guardrail.detail,
        },
      });
    });
    return { id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed.";
    await db.workflowRun.update({
      where: { id: runId },
      data: { status: "Failed", error: message },
    });
    throw new AppError(
      422,
      "IMPORT_FAILED",
      `${message} The original request is saved as ${id}.`,
    );
  }
}
