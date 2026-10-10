import { test, expect } from "@playwright/test";
test("no login, browser-specific saves, documents, imports, approvals, and reset", async ({
  browser,
  baseURL,
}) => {
  const first = await browser.newContext({ baseURL }),
    second = await browser.newContext({ baseURL });
  const a = first.request,
    b = second.request;
  try {
    const page = await first.newPage();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", {
        name: "A clear quote starts here.",
        exact: true,
      }),
    ).toBeVisible();
    const status = await (await a.get("/api/integrations/status")).json();
    expect(status.publicDemo).toBe(true);
    expect(status.privateWorkspace).toBe(false);
    const seeded = await b.get("/api/rfqs/RFQ-1042");
    expect(seeded.status()).toBe(200);
    expect(
      (await first.cookies()).find((c) => c.name === "quoteguard_demo")
        ?.httpOnly,
    ).toBe(true);
    expect(
      (await second.cookies()).find((c) => c.name === "quoteguard_demo")?.value,
    ).not.toBe(
      (await first.cookies()).find((c) => c.name === "quoteguard_demo")?.value,
    );
    let wa = await (await a.get("/api/rfqs/RFQ-1042")).json();
    async function mutate(action: object) {
      const response = await a.post("/api/rfqs/RFQ-1042", {
        data: {
          ...action,
          expectedRevision: wa.rfq.revision,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      expect(response.status()).toBe(200);
      wa = await response.json();
    }
    await mutate({ action: "pricing", markupBps: 2500 });
    await page.goto("/#rfq/RFQ-1042");
    await page.reload();
    await expect(page.locator(".quote-running-total")).toContainText(
      "$2,625.00",
    );
    expect(
      (await (await b.get("/api/rfqs/RFQ-1042")).json()).rfq.markupBps,
    ).toBe(2000);
    await mutate({
      action: "exclude",
      lineId: "line-2",
      reason: "Sample exclusion for isolation test",
    });
    await mutate({
      action: "exclude",
      lineId: "line-3",
      reason: "Sample exclusion for isolation test",
    });
    await mutate({ action: "review-line", lineId: "line-1", confirmed: true });
    await mutate({
      action: "approve",
      reviewer: "Demo tester",
      confirmed: true,
    });
    const quoteId = wa.rfq.approvedVersion;
    expect((await a.get(`/api/quotes/${quoteId}`)).status()).toBe(200);
    expect((await b.get(`/api/quotes/${quoteId}`)).status()).toBe(404);
    const upload = await a.post("/api/documents", {
      multipart: {
        file: {
          name: "isolated-catalog.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "sku,description,stock,cost\nISOLATED,304 stainless sheet .060 in x 48 in x 96 in 2B ASTM A240,15,90.00",
          ),
        },
      },
    });
    expect(upload.status()).toBe(200);
    const doc = await upload.json();
    expect((await a.get(`/api/documents/${doc.id}`)).status()).toBe(200);
    expect((await b.get(`/api/documents/${doc.id}`)).status()).toBe(404);
    const imported = await a.post("/api/catalog/import", {
      data: {
        documentId: doc.id,
        sheet: doc.sheets[0].name,
        skuColumn: 0,
        descriptionColumn: 1,
        stockColumn: 2,
        costColumn: 3,
      },
    });
    expect(imported.status()).toBe(200);
    expect(
      (await (await a.get("/api/catalog")).json()).some(
        (c: { sku: string }) => c.sku === "ISOLATED",
      ),
    ).toBe(true);
    expect(
      (await (await b.get("/api/catalog")).json()).some(
        (c: { sku: string }) => c.sku === "ISOLATED",
      ),
    ).toBe(false);
    const newRfq = await a.post("/api/rfqs", {
      data: {
        customer: "Isolated demo",
        title: "Only browser A",
        text: "10 pcs 304 stainless sheet .060 in x 48 in x 96 in 2B",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    expect(newRfq.status()).toBe(201);
    const id = (await newRfq.json()).id;
    expect((await a.get(`/api/rfqs/${id}`)).status()).toBe(200);
    expect((await b.get(`/api/rfqs/${id}`)).status()).toBe(404);
    expect(
      (await (await b.get("/api/rfqs")).json()).map(
        (r: { id: string }) => r.id,
      ),
    ).toEqual(["RFQ-1042"]);
    expect(
      (await b.post("/api/demo/reset", { data: { confirm: true } })).status(),
    ).toBe(200);
    expect((await a.get(`/api/quotes/${quoteId}`)).status()).toBe(200);
    expect(
      (await a.post("/api/demo/reset", { data: { confirm: true } })).status(),
    ).toBe(200);
    expect((await a.get(`/api/quotes/${quoteId}`)).status()).toBe(404);
  } finally {
    await first.close();
    await second.close();
  }
});
