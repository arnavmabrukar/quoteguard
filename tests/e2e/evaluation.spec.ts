import { test, expect } from "@playwright/test";

test("software benchmarks report real failures, preserve quotes, and persist on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "View benchmarks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Put QuoteGuard to the test." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ready when you are" }),
  ).toBeVisible();
  const before = await (await page.request.get("/api/rfqs/RFQ-1042")).json();
  await page
    .getByRole("button", { name: "Run benchmark", exact: true })
    .click();
  await expect(page.getByLabel("Benchmark summary")).toContainText(
    "Scenarios passed",
  );
  await expect(page.locator(".evaluation-case")).toHaveCount(24);
  await page
    .getByRole("button", { name: "Failures only", exact: true })
    .click();
  await page
    .getByText("Negated MTR requirement is understood", { exact: true })
    .click();
  await expect(
    page.locator(".evaluation-case").filter({ hasText: "Negated MTR" }),
  ).toContainText("ExpectedfalseActualtrue");
  const report = (await (await page.request.get("/api/evaluation")).json())
    .latest;
  expect(report.summary.failed).toBeGreaterThan(0);
  expect(report.summary.cases).toBe(24);
  expect(report.evaluator).toBe("QuoteGuard deterministic checks");
  expect(report.datasetHash).toMatch(/^[a-f0-9]{64}$/);
  const after = await (await page.request.get("/api/rfqs/RFQ-1042")).json();
  expect(after.rfq).toEqual(before.rfq);
  const downloaded = await page.request.get("/api/evaluation/dataset");
  expect(downloaded.headers()["content-disposition"]).toContain("attachment");
  expect((await downloaded.json()).scenarios).toHaveLength(24);
  await page.reload();
  await expect(page.getByLabel("Benchmark summary")).toContainText(
    `${report.summary.checkPassRate}%`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("button", { name: "Run again", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const invalid = await page.request.post("/api/evaluation", {
    data: { action: "run", fakeScore: 100 },
  });
  expect(invalid.ok()).toBe(false);
});
