import "server-only";
import type { Mutation } from "@/contracts/rfq";
import type { Rfq } from "@/domain/types";
import { approvalBlockers, buildQuote, reviewLines } from "@/domain/review";
import { demoEvidence } from "@/domain/fixtures";
import { provenanceFor } from "@/domain/extract-demo";
import { db } from "../db";
import { AppError } from "../access";
import { getCatalog, getBenchmarks } from "../repositories";
import { getWorkspace, requirePrism } from "./workspace";
export async function mutateRfq(id: string, command: Mutation) {
  const [catalog, benchmarks] = await Promise.all([
    getCatalog(),
    getBenchmarks(),
  ]);
  await db.$transaction(
    async (tx) => {
      const duplicate = await tx.workflowRun.findUnique({
        where: { idempotencyKey: command.idempotencyKey },
      });
      if (duplicate) {
        if (duplicate.rfqId !== id || duplicate.operation !== command.action)
          throw new AppError(
            409,
            "DUPLICATE",
            "This request key belongs to another action.",
          );
        return;
      }
      const row = await tx.rfq.findUnique({ where: { id } });
      if (!row) throw new AppError(404, "NOT_FOUND", "RFQ not found.");
      if (row.revision !== command.expectedRevision)
        throw new AppError(
          409,
          "STALE_REVISION",
          "This RFQ has changed. Refresh to load the latest saved revision. Your unsaved input is still in this dialog.",
        );
      const rfq: Rfq = JSON.parse(row.data);
      const now = new Date().toISOString();
      const line =
        "lineId" in command
          ? rfq.lines.find((l) => l.id === command.lineId)
          : undefined;
      if ("lineId" in command && !line)
        throw new AppError(404, "NOT_FOUND", "Line not found.");
      let detail = "";
      let action = "";
      if (command.action === "approve") {
        const lines = reviewLines(rfq, catalog, benchmarks, now);
        const blockers = approvalBlockers(rfq, lines, requirePrism());
        if (blockers.length)
          throw new AppError(422, "BLOCKED", blockers.join(" "));
        if (rfq.approvedVersion)
          throw new AppError(
            409,
            "ALREADY_APPROVED",
            "This revision is already approved.",
          );
        rfq.approvedVersion = `${id.replace("RFQ", "Q")}-V${rfq.revision}`;
        const snapshot = buildQuote(rfq, lines, now);
        snapshot.lines.forEach((l) => (l.status = "Approved"));
        await tx.quoteVersion.create({
          data: {
            id: rfq.approvedVersion,
            rfqId: id,
            revision: rfq.revision,
            snapshot: JSON.stringify(snapshot),
            approval: {
              create: { id: crypto.randomUUID(), reviewer: command.reviewer },
            },
          },
        });
        action = "Quote approved";
        detail = `${command.reviewer} approved ${rfq.approvedVersion}. Immutable snapshot saved; inventory is not reserved.`;
      } else {
        rfq.revision++;
        rfq.approvedVersion = null;
        rfq.prism.evaluatedRevision = null;
        if (rfq.prism.evaluation === "Passed") rfq.prism.evaluation = "Not run";
        switch (command.action) {
          case "edit":
          case "clarify":
            if (!line) break;
            line.spec = command.spec;
            line.issues = [];
            line.reviewConfirmed = false;
            line.selectedSku = null;
            line.provenance = provenanceFor(
              command.spec,
              command.action === "clarify" ? command.reply : line.original,
              command.action === "clarify"
                ? `Buyer reply · ${now}`
                : "Reviewer-confirmed edit",
              "confirmed",
            );
            if (command.action === "clarify")
              line.clarification.push({
                question:
                  "Confirm unresolved dimensions, finish, and requested requirements.",
                reply: command.reply,
                at: now,
              });
            action =
              command.action === "clarify"
                ? "Buyer clarification applied"
                : "Line specification edited";
            detail = `Line ${line.number}: fields explicitly confirmed; matching, requirements, and pricing recalculated.`;
            break;
          case "evidence":
            if (rfq.mode !== "demo")
              throw new AppError(
                422,
                "DEMO_ONLY",
                "Synthetic evidence is available only for demo RFQs.",
              );
            if (!line) break;
            const match = reviewLines(rfq, catalog, benchmarks, now).find(
              (l) => l.id === line.id,
            )?.match;
            if (!match)
              throw new AppError(
                422,
                "NO_MATCH",
                "Resolve the catalog match before attaching lot-specific evidence.",
              );
            const record = demoEvidence(match.sku, match.lot, line.spec.origin);
            if (line.evidence.some((e) => e.id === record.id))
              throw new AppError(
                409,
                "ALREADY_ADDED",
                "This sample record is already attached.",
              );
            line.evidence.push(record);
            line.reviewConfirmed = false;
            action = "Synthetic evidence attached";
            detail = `Line ${line.number}: demo record for ${match.sku}, lot ${match.lot}. Review is still required.`;
            break;
          case "review-evidence":
            const evidence = line?.evidence.find(
              (e) => e.id === command.evidenceId,
            );
            if (!evidence)
              throw new AppError(
                404,
                "NOT_FOUND",
                "Evidence record not found.",
              );
            evidence.reviewed = true;
            evidence.reviewedAt = now;
            line!.reviewConfirmed = false;
            action = "Supporting record reviewed";
            detail = `Line ${line!.number}: ${evidence.label} reviewed against the product and lot.`;
            break;
          case "review-line":
            const checked = reviewLines(rfq, catalog, benchmarks, now).find(
              (l) => l.id === line!.id,
            )!;
            if (checked.blockers.length || checked.excluded)
              throw new AppError(
                422,
                "BLOCKED",
                "Resolve every line blocker before confirming review.",
              );
            line!.reviewConfirmed = true;
            action = "Line review confirmed";
            detail = `Line ${line!.number}: reviewer confirmed match, selling price, and supporting documentation.`;
            break;
          case "select":
            const candidate = reviewLines(rfq, catalog, benchmarks, now)
              .find((l) => l.id === line!.id)
              ?.candidates.find((c) => c.item.sku === command.sku);
            if (!candidate?.exact)
              throw new AppError(
                422,
                "SUBSTITUTION",
                "This product differs from the request. Obtain an explicit buyer specification change first.",
              );
            line!.selectedSku = command.sku;
            line!.reviewConfirmed = false;
            action = "Catalog match selected";
            detail = `Line ${line!.number}: ${command.sku} selected after exact attribute checks.`;
            break;
          case "exclude":
            line!.excluded = command.reason;
            line!.reviewConfirmed = false;
            action = "Line excluded";
            detail = `Line ${line!.number}: ${command.reason}`;
            break;
          case "restore":
            line!.excluded = null;
            line!.reviewConfirmed = false;
            action = "Line restored";
            detail = `Line ${line!.number} returned to quote review.`;
            break;
          case "pricing":
            rfq.markupBps = command.markupBps;
            rfq.lines.forEach((l) => (l.reviewConfirmed = false));
            action = "Pricing policy changed";
            detail = `Cost-plus markup changed to ${command.markupBps / 100}%. All line reviews and quote approval invalidated.`;
            break;
          case "terms":
            rfq.terms = command.terms;
            action = "Commercial terms updated";
            detail =
              "Shipping, tax, processing, delivery, and validity terms saved. Quote approval invalidated.";
            break;
        }
        // Seeded catalog records may support a clarified exact item; evidence still carries its real review state.
        for (const item of reviewLines(rfq, catalog, benchmarks, now)) {
          if (item.match) {
            const target = rfq.lines.find((l) => l.id === item.id)!;
            for (const ev of item.match.evidence)
              if (!target.evidence.some((e) => e.id === ev.id))
                target.evidence.push(structuredClone(ev));
          }
        }
      }
      rfq.updatedAt = now;
      const result = await tx.rfq.updateMany({
        where: { id, revision: command.expectedRevision },
        data: { revision: rfq.revision, data: JSON.stringify(rfq) },
      });
      if (result.count !== 1)
        throw new AppError(
          409,
          "STALE_REVISION",
          "The RFQ changed while saving. Refresh and retry.",
        );
      await tx.auditEvent.create({
        data: {
          id: crypto.randomUUID(),
          rfqId: id,
          revision: rfq.revision,
          action,
          detail,
          lineId: line?.id,
        },
      });
      await tx.workflowRun.create({
        data: {
          id: crypto.randomUUID(),
          rfqId: id,
          revision: rfq.revision,
          idempotencyKey: command.idempotencyKey,
          operation: command.action,
          stage: "Complete",
          status: "Completed",
        },
      });
    },
    { timeout: 10000 },
  );
  return getWorkspace(id);
}
