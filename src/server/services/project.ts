import "server-only";
import { z } from "zod";
import { db } from "../db";
import { AppError } from "../access";
import { getWorkspace } from "./workspace";
import {
  seedProject,
  projectCommand,
  supplierDraft,
  offerProblems,
  type Project,
} from "@/domain/project";
import type { Workspace } from "@/domain/types";

export async function getProject(id: string) {
  const w = await getWorkspace(id);
  const row = await db.setting.findUnique({ where: { id: `project:${id}` } });
  return row ? (JSON.parse(row.data) as Project) : seedProject(w);
}
export async function saveProject(id: string, body: unknown) {
  const envelope = z
    .object({
      expectedRevision: z.number().int().positive(),
      rfqRevision: z.number().int().positive(),
      command: projectCommand,
    })
    .parse(body);
  const w = await getWorkspace(id);
  if (w.rfq.revision !== envelope.rfqRevision)
    throw new AppError(
      409,
      "STALE",
      "The RFQ has changed. Refresh before continuing.",
    );
  const key = `project:${id}`;
  const initial = seedProject(w);
  await db.setting.upsert({
    where: { id: key },
    create: { id: key, data: JSON.stringify(initial) },
    update: {},
  });
  await db.$transaction(
    async (tx) => {
      const row = (await tx.setting.findUnique({ where: { id: key } }))!;
      const p: Project = JSON.parse(row.data);
      if (p.revision !== envelope.expectedRevision)
        throw new AppError(
          409,
          "STALE",
          "This project changed in another window. Refresh before saving.",
        );
      const current = await tx.rfq.findUnique({ where: { id } });
      if (current?.revision !== envelope.rfqRevision)
        throw new AppError(
          409,
          "STALE",
          "The RFQ has changed. Refresh before continuing.",
        );
      const c = envelope.command;
      let detail = "";
      if (c.action === "offer") {
        if (!w.lines.some((l) => l.id === c.offer.lineId && !l.excluded))
          throw new AppError(422, "LINE", "Choose an included line.");
        p.offers = [
          ...p.offers.filter((o) => o.id !== c.offer.id),
          {
            ...c.offer,
            specKey: JSON.stringify(
              w.lines.find((l) => l.id === c.offer.lineId)!.spec,
            ),
          },
        ];
        p.planVersion++;
        p.instructionReviewer = null;
        detail = `Offer from ${c.offer.supplier} recorded. Source: ${c.offer.source}.`;
      }
      if (c.action === "select-offer") {
        const offer = p.offers.find(
          (o) => o.id === c.offerId && o.lineId === c.lineId,
        );
        const l = w.lines.find((l) => l.id === c.lineId && !l.excluded);
        if (!offer || !l)
          throw new AppError(422, "OFFER", "Choose an offer for this line.");
        const problems = offerProblems(
          offer,
          l.spec.quantity,
          undefined,
          l.spec,
        );
        if (problems.length)
          throw new AppError(422, "OFFER", problems.join(". "));
        p.selected[c.lineId] = c.offerId;
        p.planVersion++;
        p.instructionReviewer = null;
        detail = `${offer.supplier} selected for the planning estimate. Customer quote prices unchanged.`;
      }
      if (c.action === "plan") {
        if (new Set(c.operations.map((o) => o.id)).size !== c.operations.length)
          throw new AppError(422, "OPERATION", "Operation IDs must be unique.");
        p.operations = c.operations;
        p.overheadBps = c.overheadBps;
        p.marginBps = c.marginBps;
        p.planVersion++;
        p.instructionReviewer = null;
        detail =
          "Labor, overhead, and target margin saved. Instruction review cleared.";
      }
      if (c.action === "instructions") {
        p.instructions = p.operations.map((o) => ({
          id: crypto.randomUUID(),
          title: o.name,
          body: o.instruction,
          tool: o.tool,
          completed: false,
          completedAt: null,
        }));
        p.instructionRfqRevision = w.rfq.revision;
        p.instructionPlanVersion = p.planVersion;
        p.instructionReviewer = null;
        detail =
          "Draft work instructions generated from the saved operations. Qualified review required.";
      }
      if (c.action === "review-instructions") {
        assertCurrentInstructions(w, p);
        if (!w.rfq.approvedVersion)
          throw new AppError(
            422,
            "APPROVAL",
            "Approve the material quote before releasing work instructions.",
          );
        p.instructionReviewer = c.reviewer;
        detail = `${c.reviewer} reviewed the instruction draft for this revision.`;
      }
      if (c.action === "step") {
        assertCurrentInstructions(w, p);
        if (!p.instructionReviewer || !w.rfq.approvedVersion)
          throw new AppError(
            422,
            "REVIEW",
            "Review and release instructions first.",
          );
        const step = p.instructions.find((s) => s.id === c.id);
        if (!step) throw new AppError(404, "STEP", "Step not found.");
        step.completed = c.completed;
        step.completedAt = c.completed ? new Date().toISOString() : null;
        detail = `${step.title}: ${c.completed ? "complete" : "reopened"}.`;
      }
      if (c.action === "draft") {
        if (p.outreach.length >= 50)
          throw new AppError(
            422,
            "LIMIT",
            "This prototype supports 50 drafts per project.",
          );
        p.outreach.unshift({
          id: crypto.randomUUID(),
          supplier: c.supplier,
          body: supplierDraft(w, c.supplier),
          at: new Date().toISOString(),
        });
        detail = `Supplier request drafted for ${c.supplier}. Nothing sent.`;
      }
      p.revision++;
      p.rfqRevision = w.rfq.revision;
      p.activity = [
        { id: crypto.randomUUID(), detail, at: new Date().toISOString() },
        ...p.activity,
      ].slice(0, 100);
      const saved = await tx.setting.updateMany({
        where: { id: key, data: row.data },
        data: { data: JSON.stringify(p) },
      });
      if (saved.count !== 1)
        throw new AppError(
          409,
          "STALE",
          "Another save completed first. Refresh and retry.",
        );
    },
    { timeout: 10000 },
  );
  return getProject(id);
}
function assertCurrentInstructions(w: Workspace, p: Project) {
  if (
    !p.instructions.length ||
    p.instructionRfqRevision !== w.rfq.revision ||
    p.instructionPlanVersion !== p.planVersion
  )
    throw new AppError(
      422,
      "STALE_INSTRUCTIONS",
      "Generate a fresh instruction draft after changes to the RFQ or plan.",
    );
}
