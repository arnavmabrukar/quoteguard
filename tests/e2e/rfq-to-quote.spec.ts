import { test as base, expect } from "@playwright/test";
import { sampleText, edgeFixtures } from "../../src/domain/fixtures";
const test = base.extend({
  request: async ({ context }, use) => use(context.request),
});
test.beforeEach(async ({ request }) => {
  await request.post("/api/demo/reset", { data: { confirm: true } });
});
test("clarification → evidence review → human approval → immutable export", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stainless steel sheets", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".summary-strip")).toContainText("$2,520.00");
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Line review confirmed", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Draft clarification", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply clarification", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Use sample buyer reply", exact: true })
    .click();
  for (const label of [
    "Thickness",
    "Width & length",
    "Grade & finish",
    "Quantity",
    "Requirements",
  ])
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  await page
    .getByRole("button", { name: "Apply clarification", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".summary-strip")).toContainText("$4,920.00");
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Line review confirmed", exact: true }),
  ).toBeDisabled();
  await page.getByRole("row", { name: /Item 3:/ }).click();
  await page.getByRole("tab", { name: "Checks", exact: true }).click();
  await page
    .getByRole("button", { name: "Add sample supplier evidence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /View supporting record/ }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: /View supporting record/ })
    .first()
    .click();
  await page.getByRole("checkbox", { name: /I reviewed the product/ }).check();
  await page
    .getByRole("button", { name: "Confirm evidence review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Line review confirmed", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".summary-strip")).toContainText("$4,920.00");
  await page
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await expect(page.locator(".quote-paper")).not.toContainText("Supplier cost");
  await expect(page.locator(".quote-paper")).not.toContainText("markup");
  await page
    .getByRole("checkbox", { name: /I confirm the item reviews/ })
    .check();
  await page
    .getByRole("button", { name: "Approve quote", exact: true })
    .click();
  await expect(page.locator(".quote-state")).toContainText("APPROVED");
  const approved = await (await request.get("/api/rfqs/RFQ-1042")).json();
  const quoteId = approved.rfq.approvedVersion;
  expect(quoteId).toBeTruthy();
  const before = await (await request.get(`/api/quotes/${quoteId}`)).text();
  const csv = await (
    await request.get(`/api/rfqs/RFQ-1042/export?version=${quoteId}`)
  ).text();
  expect(csv).toContain("APPROVED");
  expect(csv).not.toMatch(/supplier cost|markup|trace/i);
  await page.screenshot({
    path: "test-results/approved-quote.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Markup on supplier cost").fill("25");
  await page
    .getByRole("button", { name: "Save pricing policy", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Policy saved", exact: true }),
  ).toBeVisible();
  const edited = await (await request.get("/api/rfqs/RFQ-1042")).json();
  expect(edited.rfq.approvedVersion).toBeNull();
  expect(
    edited.lines.every((l: { reviewConfirmed: boolean }) => !l.reviewConfirmed),
  ).toBe(true);
  expect(edited.summary.subtotalCents).toBe(512500);
  expect(await (await request.get(`/api/quotes/${quoteId}`)).text()).toBe(
    before,
  );
  expect(errors).toEqual([]);
});
test("API gates reject unsafe and stale mutations, and deduplicate valid ones", async ({
  request,
}) => {
  let w = await (await request.get("/api/rfqs/RFQ-1042")).json();
  const approval = await request.post("/api/rfqs/RFQ-1042", {
    data: {
      action: "approve",
      expectedRevision: 1,
      idempotencyKey: crypto.randomUUID(),
      reviewer: "Test reviewer",
      confirmed: true,
    },
  });
  expect(approval.status()).toBe(422);
  const payload = {
    action: "pricing",
    markupBps: 2500,
    expectedRevision: 1,
    idempotencyKey: crypto.randomUUID(),
  };
  const first = await request.post("/api/rfqs/RFQ-1042", { data: payload });
  expect(first.ok()).toBe(true);
  const duplicate = await request.post("/api/rfqs/RFQ-1042", { data: payload });
  expect(duplicate.ok()).toBe(true);
  expect((await duplicate.json()).rfq.revision).toBe(2);
  const stale = await request.post("/api/rfqs/RFQ-1042", {
    data: { ...payload, markupBps: 3500, idempotencyKey: crypto.randomUUID() },
  });
  expect(stale.status()).toBe(409);
  const cross = await request.post("/api/rfqs/RFQ-1042", {
    headers: { Origin: "https://malicious.example" },
    data: {
      ...payload,
      expectedRevision: 2,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(cross.status()).toBe(403);
});
test("new RFQs, CSV mapping, and malicious input preserve explicit demo states", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New RFQ", exact: true }).click();
  await page.getByLabel("Customer", { exact: true }).fill("Test Fabrication");
  await page.getByLabel("RFQ title").fill("Browser import test");
  await page.getByLabel("RFQ text", { exact: true }).fill(sampleText);
  await page.getByRole("button", { name: "Create RFQ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser import test", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser import test", exact: true }),
  ).toBeVisible();
  const malicious = await request.post("/api/rfqs", {
    data: {
      customer: "Security fixture",
      title: "Embedded instructions fixture",
      text: edgeFixtures["Embedded instructions"],
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(malicious.ok()).toBe(true);
  const w = await (
    await request.get(`/api/rfqs/${(await malicious.json()).id}`)
  ).json();
  expect(w.rfq.guardrail.passed).toBe(false);
  expect(w.rfq.markupBps).toBe(2000);
  expect(w.approvalBlockers.length).toBeGreaterThan(0);
  expect(w.rfq.prism.evaluation).toBe("Unavailable");
  const csv = await request.post("/api/documents", {
    multipart: {
      file: {
        name: "sample.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          'description,quantity\n"stainless 304 sheet, 0.060 in × 48 in × 96 in, 2B finish",10',
        ),
      },
    },
  });
  expect(csv.ok()).toBe(true);
  const doc = await csv.json();
  expect(doc.sheets[0].rows).toHaveLength(2);
  const imported = await request.post("/api/rfqs", {
    data: {
      customer: "CSV buyer",
      title: "Mapped CSV",
      text: "preview",
      documentId: doc.id,
      sheet: "CSV",
      descriptionColumn: 0,
      quantityColumn: 1,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(imported.ok()).toBe(true);
  const sheetW = await (
    await request.get(`/api/rfqs/${(await imported.json()).id}`)
  ).json();
  expect(sheetW.lines[0].location).toBe("CSV · row 2");
  expect(sheetW.lines[0].spec.quantity).toBe(10);
  const bad = await request.post("/api/documents", {
    multipart: {
      file: {
        name: "bad.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a supported file"),
      },
    },
  });
  expect(bad.status()).toBe(422);
});
test("secondary screens and smaller-screen inspector are usable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Supplier catalog", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search catalog").fill("316L");
  await expect(page.locator(".data-table tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Price benchmarks", exact: true }),
  ).toBeVisible();
  await page.goto("/#rfq/RFQ-1042");
  await page.reload();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole("row", { name: /Item 2:/ }).click();
  await expect(page.locator(".inspector")).toBeVisible();
  await page.getByRole("button", { name: "Close item details" }).click();
  await expect(page.locator(".inspector")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("phone sourcing, labor planning, and work-instruction review persist", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find the right supplier." }),
  ).toBeVisible();
  await expect(page.locator(".offer-card")).toHaveCount(3);
  await page
    .locator(".offer-card")
    .filter({ hasText: "Atlas Industrial" })
    .getByRole("button", { name: "Use in estimate" })
    .click();
  await expect(
    page.locator(".offer-card").filter({ hasText: "Atlas Industrial" }),
  ).toContainText("Selected for estimate");
  await page
    .getByRole("button", { name: "Draft request", exact: true })
    .click();
  await page.getByLabel("Supplier name").fill("Atlas Industrial");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.locator(".outreach-panel")).toContainText(
    "Atlas Industrial",
  );
  await page.screenshot({
    path: "test-results/phone-source.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A plan behind every price." }),
  ).toBeVisible();
  await page.getByLabel("Overhead on cost (%)").fill("15");
  await page
    .getByRole("button", { name: "Save estimate", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Estimate saved", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/phone-plan.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Make", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate instructions", exact: true })
    .click();
  await expect(page.locator(".instruction-card")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Review & release", exact: true }),
  ).toBeDisabled();
  const p = await (await request.get("/api/rfqs/RFQ-1042/project")).json();
  expect(p.overheadBps).toBe(1500);
  expect(p.outreach).toHaveLength(1);
  const premature = await request.post("/api/rfqs/RFQ-1042/project", {
    data: {
      expectedRevision: p.revision,
      rfqRevision: 1,
      command: {
        action: "review-instructions",
        reviewer: "QA",
        confirmed: true,
      },
    },
  });
  expect(premature.status()).toBe(422);
  await page.getByRole("button", { name: "Quote", exact: true }).click();
  await page.getByRole("button", { name: /Open item 1:/ }).click();
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close item details", exact: true })
    .click();
  await page.getByRole("button", { name: /Open item 2:/ }).click();
  await page
    .getByRole("button", { name: "Resolve clarification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use sample buyer reply", exact: true })
    .click();
  for (const name of [
    "Thickness",
    "Width & length",
    "Grade & finish",
    "Quantity",
    "Requirements",
  ])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await page
    .getByRole("button", { name: "Apply clarification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close item details", exact: true })
    .click();
  await page.getByRole("button", { name: /Open item 3:/ }).click();
  await page
    .getByRole("button", { name: "Add sample supplier evidence", exact: true })
    .click();
  await page
    .getByRole("button", { name: /View supporting record/ })
    .first()
    .click();
  await page.getByRole("checkbox", { name: /I reviewed the product/ }).check();
  await page
    .getByRole("button", { name: "Confirm evidence review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm line review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close item details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview quote", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: /I confirm the item reviews/ })
    .check();
  await page
    .getByRole("button", { name: "Approve quote", exact: true })
    .click();
  await expect(page.locator(".quote-state")).toContainText("APPROVED");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Make", exact: true }).click();
  await page
    .getByRole("button", { name: "Regenerate draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & release", exact: true })
    .click();
  await page
    .getByLabel("Reviewer name", { exact: true })
    .fill("Phone reviewer");
  await page
    .getByRole("checkbox", { name: /I reviewed every operation/ })
    .check();
  await page
    .getByRole("button", { name: "Release demo instructions", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Mark step complete", exact: true })
    .first()
    .check();
  await expect(page.locator(".make-status")).toContainText(
    "1 of 3 steps complete",
  );
  await page.screenshot({
    path: "test-results/phone-make.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Make", exact: true }).click();
  await expect(page.locator(".make-status")).toContainText(
    "1 of 3 steps complete",
  );
  const current = await (await request.get("/api/rfqs/RFQ-1042")).json();
  const saved = await (await request.get("/api/rfqs/RFQ-1042/project")).json();
  await request.post("/api/rfqs/RFQ-1042", {
    data: {
      action: "pricing",
      markupBps: 2300,
      expectedRevision: current.rfq.revision,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const stale = await request.post("/api/rfqs/RFQ-1042/project", {
    data: {
      expectedRevision: saved.revision,
      rfqRevision: current.rfq.revision + 1,
      command: {
        action: "step",
        id: saved.instructions[1].id,
        completed: true,
      },
    },
  });
  expect(stale.status()).toBe(422);
});
