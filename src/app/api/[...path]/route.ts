import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { checkAccess, AppError } from "@/server/access";
import { authRequired, publicDemo } from "@/server/session";
import { withWorkspace } from "@/server/workspace-context";
import { db } from "@/server/db";
import { ensureSeed, getCatalog, getBenchmarks } from "@/server/repositories";
import { getProject, saveProject } from "@/server/services/project";
import {
  getExplanation,
  generateExplanation,
} from "@/server/services/explanation";
import { reserveAiRequest } from "@/server/integrations/ai-budget";
import { getWorkspace } from "@/server/services/workspace";
import { mutateRfq } from "@/server/services/mutate-rfq";
import { importRfq } from "@/server/services/import-rfq";
import { quoteCsv } from "@/server/services/export-quote";
import { parseUpload } from "@/server/documents/parse-upload";
import { createSchema, mutationSchema } from "@/contracts/rfq";
import { seedRfq } from "@/domain/fixtures";
import { nicrronCompletion } from "@/server/integrations/nicrron";
import { emitTrace, prismCapabilities } from "@/server/integrations/prism";
import type { CatalogItem, Rfq } from "@/domain/types";
import { parseSpec } from "@/domain/extract-demo";
import { blankDxf, blankStep, buildBlank } from "@/domain/blank-cad";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    checkAccess(req);
    await ensureSeed();
    const parts = (await ctx.params).path;
    const route = parts.join("/");
    if (req.method === "GET") {
      if (
        parts[0] === "rfqs" &&
        parts[2] === "lines" &&
        parts[4] === "explanation" &&
        parts.length === 5
      )
        return json(await getExplanation(parts[1], parts[3]));
      if (route === "rfqs") {
        const rows = await db.rfq.findMany({ orderBy: { updatedAt: "desc" } });
        return json(
          await Promise.all(
            rows.map(async (row) => {
              const w = await getWorkspace(row.id);
              return {
                id: row.id,
                customer: w.rfq.customer,
                title: w.rfq.title,
                createdAt: w.rfq.createdAt,
                updatedAt: w.rfq.updatedAt,
                count: w.lines.length,
                status: w.rfq.approvedVersion
                  ? "Approved"
                  : w.summary.attention
                    ? "Needs attention"
                    : w.lines.length
                      ? "Ready for review"
                      : "Import failed",
                subtotalCents: w.summary.subtotalCents,
              };
            }),
          ),
        );
      }
      if (parts[0] === "rfqs" && parts.length === 2)
        return json(await getWorkspace(parts[1]));
      if (parts[0] === "rfqs" && parts[2] === "project" && parts.length === 3)
        return json(await getProject(parts[1]));
      if (route === "catalog") return json(await getCatalog());
      if (route === "benchmarks") return json(await getBenchmarks());
      if (route === "integrations/status") {
        const stored = await db.setting.findUnique({
          where: { id: "integrations" },
        });
        const aiSuccess = await db.setting.findUnique({
          where: { id: "nicrron-last-success" },
        });
        const verifiedAi = aiSuccess ? JSON.parse(aiSuccess.data) : null;
        return json({
          privateWorkspace: authRequired(),
          publicDemo: publicDemo(),
          mode: process.env.QUOTEGUARD_MODE === "live" ? "live" : "demo",
          nicrron: process.env.NICRRON_API_KEY
            ? "Not verified"
            : "Not configured",
          prism: process.env.PRISMTRACE_API_KEY
            ? "Not verified"
            : "Not configured",
          ...(stored ? JSON.parse(stored.data) : {}),
          ...(process.env.NICRRON_API_KEY &&
          verifiedAi?.model === process.env.NICRRON_MODEL
            ? {
                nicrron: "Connected (AI explanation)",
                checkedAt: verifiedAi.checkedAt,
              }
            : {}),
          capabilities: prismCapabilities,
        });
      }
      if (parts[0] === "documents" && parts.length === 2) {
        const doc = await db.document.findUnique({ where: { id: parts[1] } });
        if (!doc) throw new AppError(404, "NOT_FOUND", "Document not found.");
        const bytes = doc.content
          ? Buffer.from(doc.content)
          : await fs.readFile(
              path.join(process.cwd(), ".data/uploads", doc.storageKey),
            );
        return new NextResponse(bytes, {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (parts[0] === "rfqs" && parts[2] === "export") {
        const w = await getWorkspace(parts[1]);
        let quote = w.quote;
        const version = req.nextUrl.searchParams.get("version");
        if (version) {
          const saved = await db.quoteVersion.findFirst({
            where: { id: version, rfqId: parts[1] },
          });
          if (!saved)
            throw new AppError(404, "NOT_FOUND", "Quote version not found.");
          quote = JSON.parse(saved.snapshot);
        }
        return new NextResponse(quoteCsv(quote), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "private, no-store",
            "Content-Disposition": `attachment; filename="${quote.id}-${quote.status}.csv"`,
          },
        });
      }
      if (parts[0] === "rfqs" && parts[2] === "cad" && parts.length === 3) {
        const w = await getWorkspace(parts[1]);
        if (!w.rfq.approvedVersion)
          throw new AppError(
            409,
            "NOT_APPROVED",
            "CAD export requires an approved quote.",
          );
        const params = req.nextUrl.searchParams;
        const format = params.get("format") === "step" ? "step" : "dxf";
        const number = Number(params.get("line"));
        // w.quote is the immutable approved snapshot; draft edits cannot leak in.
        const quoted = w.quote.lines.find((l) => l.number === number);
        if (!quoted?.sku)
          throw new AppError(404, "NOT_FOUND", "Approved quote line not found.");
        const built = buildBlank(
          w.catalog.find((c) => c.sku === quoted.sku) || null,
        );
        if (!built.ok)
          throw new AppError(
            422,
            "CAD_INCOMPLETE",
            `Cannot build blank; missing: ${built.missing.join(", ")}.`,
          );
        const demo = w.quote.demo;
        const body =
          format === "step"
            ? blankStep(built.blank, demo)
            : blankDxf(built.blank, demo);
        const safeSku = built.blank.sku.replace(/[^A-Za-z0-9_-]/g, "_");
        return new NextResponse(body, {
          headers: {
            "Content-Type":
              format === "step" ? "model/step" : "application/dxf",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": `attachment; filename="${safeSku}-blank.${format === "step" ? "step" : "dxf"}"`,
          },
        });
      }
      if (parts[0] === "quotes" && parts.length === 2) {
        const quote = await db.quoteVersion.findUnique({
          where: { id: parts[1] },
        });
        if (!quote)
          throw new AppError(404, "NOT_FOUND", "Quote version not found.");
        return json(JSON.parse(quote.snapshot));
      }
      if (parts[0] === "runs" && parts.length === 2) {
        const run = await db.workflowRun.findUnique({
          where: { id: parts[1] },
        });
        if (!run) throw new AppError(404, "NOT_FOUND", "Run not found.");
        return json(run);
      }
    }
    if (req.method === "POST") {
      if (route === "documents") {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File))
          throw new AppError(422, "FILE", "Choose a file.");
        return json(await parseUpload(file));
      }
      if (Number(req.headers.get("content-length") || 0) > 100000)
        throw new AppError(413, "SIZE", "Request is too large.");
      const body = await req.json();
      if (
        parts[0] === "rfqs" &&
        parts[2] === "lines" &&
        parts[4] === "explanation" &&
        parts.length === 5
      )
        return json(await generateExplanation(parts[1], parts[3], body));
      if (parts[0] === "rfqs" && parts[2] === "project" && parts.length === 3)
        return json(await saveProject(parts[1], body));
      if (route === "rfqs")
        return json(await importRfq(createSchema.parse(body)), 201);
      if (parts[0] === "rfqs" && parts.length === 2)
        return json(await mutateRfq(parts[1], mutationSchema.parse(body)));
      if (route === "demo/reset") {
        z.object({ confirm: z.literal(true) }).parse(body);
        if (process.env.QUOTEGUARD_MODE === "live")
          throw new AppError(
            403,
            "DEMO_ONLY",
            "Reset is only available in demo mode.",
          );
        await db.$transaction(async (tx) => {
          await tx.setting.deleteMany({ where: { id: "project:RFQ-1042" } });
          await tx.workflowRun.deleteMany({ where: { rfqId: "RFQ-1042" } });
          await tx.auditEvent.deleteMany({ where: { rfqId: "RFQ-1042" } });
          const quotes = await tx.quoteVersion.findMany({
            where: { rfqId: "RFQ-1042" },
          });
          await tx.approval.deleteMany({
            where: { quoteId: { in: quotes.map((q) => q.id) } },
          });
          await tx.quoteVersion.deleteMany({ where: { rfqId: "RFQ-1042" } });
          await tx.rfq.update({
            where: { id: "RFQ-1042" },
            data: { revision: 1, data: JSON.stringify(seedRfq()) },
          });
          await tx.auditEvent.create({
            data: {
              id: crypto.randomUUID(),
              rfqId: "RFQ-1042",
              revision: 1,
              action: "Demo reset",
              detail: "Original three-line demonstration restored.",
            },
          });
        });
        return json(await getWorkspace("RFQ-1042"));
      }
      if (route === "catalog/import") {
        const s = z
          .object({
            documentId: z.string(),
            sheet: z.string(),
            skuColumn: z.number().int().min(0),
            descriptionColumn: z.number().int().min(0),
            stockColumn: z.number().int().min(0),
            costColumn: z.number().int().min(0),
          })
          .parse(body);
        const doc = await db.document.findUnique({
          where: { id: s.documentId },
        });
        if (!doc)
          throw new AppError(404, "NOT_FOUND", "Import document not found.");
        const sheet = JSON.parse(doc.data).sheets.find(
          (x: { name: string }) => x.name === s.sheet,
        );
        if (!sheet) throw new AppError(422, "SHEET", "Choose a sheet.");
        const items: CatalogItem[] = sheet.rows
          .slice(1)
          .map((row: string[], i: number) => {
            const spec = parseSpec(row[s.descriptionColumn] || "");
            const sku = row[s.skuColumn]?.trim();
            const stock = Number(row[s.stockColumn]);
            const cost = row[s.costColumn]?.replace(/[$,]/g, "");
            if (
              !sku ||
              !spec.grade ||
              !spec.material ||
              !spec.form ||
              !spec.thickness ||
              !spec.width ||
              !spec.length ||
              !spec.finish ||
              !/^\d+(?:\.\d{1,2})?$/.test(cost) ||
              !Number.isSafeInteger(stock) ||
              stock < 0 ||
              stock > 100000
            )
              throw new AppError(
                422,
                "CATALOG",
                `Row ${i + 2}: provide a SKU, explicit material/grade/form/dimensions/finish, integer stock, and a USD cost with up to two decimal places.`,
              );
            const [whole, decimal = ""] = cost.split(".");
            return {
              sku,
              material: spec.material,
              grade: spec.grade,
              form: spec.form,
              thickness: spec.thickness,
              width: spec.width,
              length: spec.length,
              finish: spec.finish,
              standard: spec.standard || "",
              stock,
              costCents: Number(whole) * 100 + Number(decimal.padEnd(2, "0")),
              lot: "Unspecified",
              evidence: [],
              updated: new Date().toISOString().slice(0, 10),
            };
          });
        const existing = await getCatalog();
        if (
          items.some((x) => existing.some((e) => e.sku === x.sku)) ||
          new Set(items.map((x) => x.sku)).size !== items.length
        )
          throw new AppError(
            409,
            "DUPLICATE_SKU",
            "Import new SKUs only. Duplicate SKUs would affect saved quote reviews.",
          );
        await db.$transaction(
          items.map((item) =>
            db.catalogItem.create({
              data: { sku: item.sku, data: JSON.stringify(item) },
            }),
          ),
        );
        return json({ count: items.length });
      }
      if (route === "integrations/verify") {
        z.object({ confirm: z.literal(true) }).parse(body);
        const result: {
          nicrron: string;
          prism: string;
          traceId: string | null;
          checkedAt: string;
        } = {
          nicrron: "Not configured",
          prism: process.env.PRISMTRACE_API_KEY
            ? "Not verified"
            : "Not configured",
          traceId: null,
          checkedAt: new Date().toISOString(),
        };
        if (process.env.NICRRON_API_KEY) {
          await reserveAiRequest();
          try {
            const reply = await nicrronCompletion(
              "Reply exactly: QuoteGuard connection verified.",
              "Synthetic connection check; no customer data.",
            );
            result.nicrron = "Connected";
            const trace = await emitTrace(
              "Synthetic connection check; no customer data.",
              reply,
              "quoteguard-connection-test",
              1,
            );
            result.prism =
              trace.telemetry === "Accepted"
                ? "Connected (test trace)"
                : trace.telemetry;
            result.traceId = trace.traceId;
          } catch (e) {
            result.nicrron =
              e instanceof Error ? e.message : "Connection error";
          }
        }
        await db.setting.upsert({
          where: { id: "integrations" },
          create: { id: "integrations", data: JSON.stringify(result) },
          update: { data: JSON.stringify(result) },
        });
        return json(result);
      }
    }
    throw new AppError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: {
            code: "VALIDATION",
            message: "Check the highlighted input values.",
            fields: e.flatten(),
          },
        },
        422,
      );
    if (e instanceof AppError)
      return json({ error: { code: e.code, message: e.message } }, e.status);
    console.error(e instanceof Error ? e.message : "Request failed");
    return json(
      {
        error: {
          code: "SERVER_ERROR",
          message:
            "The request could not be completed. Your saved work is preserved.",
        },
      },
      500,
    );
  }
}
export const GET = (req: NextRequest, ctx: Parameters<typeof handler>[1]) =>
  withWorkspace(req, () => handler(req, ctx));
export const POST = GET;
