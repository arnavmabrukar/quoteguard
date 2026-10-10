import { test, expect } from "@playwright/test";
for (const width of [390, 1440]) {
  test(`explanations require a click, reuse saved text, and handle errors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let response: any;
    let reads = 0;
    let generations = 0;
    const saved = new Map<string, any>();
    await page.route("**/api/rfqs/*/lines/*/explanation", async (route) => {
      if (route.request().method() === "GET") {
        reads++;
        const real = await route.fetch();
        response = await real.json();
        return route.fulfill({
          json: {
            ...response,
            configured: true,
            saved: saved.get(route.request().url()) || null,
          },
        });
      }
      generations++;
      const result = {
        ...response,
        configured: true,
        saved: {
          fingerprint: response.fingerprint,
          revision: 1,
          model: "mock-test-model",
          generatedAt: new Date().toISOString(),
          explanation: {
            match: {
              text: "Test explanation: the selected catalog item matches the requested attributes.",
              factIds: ["match.result"],
            },
            pricing: {
              text: "Test explanation: the proposed price uses the sample supplier cost and markup.",
              factIds: ["pricing.calculation"],
            },
            evidence: {
              text: "Test explanation: synthetic evidence still requires human review.",
              factIds: ["evidence.sample"],
            },
            alternatives: response.alternatives.map((a: any) => ({
              ...a,
              text: "Test explanation: this alternative does not match the requested specification.",
              factIds: [a.factId],
            })),
          },
        },
      };
      saved.set(route.request().url(), result.saved);
      return route.fulfill({ json: result });
    });
    await page.goto("/#rfq/RFQ-1042");
    await page
      .getByRole("button", { name: "Open item 1:", exact: false })
      .click();
    const card = page.getByRole("region", {
      name: "Catalog and price explanation",
    });
    await expect(
      card.getByRole("button", { name: "Explain this item" }),
    ).toBeEnabled();
    expect(reads).toBe(0);
    expect(generations).toBe(0);
    await expect(card.locator(".explanation-copy")).toHaveCount(0);
    await card.getByRole("button", { name: "Explain this item" }).click();
    await expect(card).toContainText("AI · Nicrron");
    await expect(card).toContainText(
      "Test explanation: the selected catalog item",
    );
    await expect(card).toContainText("Why alternatives weren’t accepted");
    await card.getByText("See the facts behind this", { exact: true }).click();
    await expect(card).toContainText("Supplier cost $100.00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(reads).toBe(1);
    expect(generations).toBe(1);
    await page.getByRole("button", { name: "Close item details" }).click();
    await page
      .getByRole("button", { name: "Open item 1:", exact: false })
      .click();
    await expect(
      card.getByRole("button", { name: "Explain this item" }),
    ).toBeEnabled();
    await expect(card.locator(".explanation-copy")).toHaveCount(0);
    expect(reads).toBe(1);
    await card.getByRole("button", { name: "Explain this item" }).click();
    await expect(card).toContainText(
      "Test explanation: the selected catalog item",
    );
    expect(reads).toBe(2);
    expect(generations).toBe(1);
    await page.reload();
    await page
      .getByRole("button", { name: "Open item 1:", exact: false })
      .click();
    await expect(
      card.getByRole("button", { name: "Explain this item" }),
    ).toBeEnabled();
    await expect(card.locator(".explanation-copy")).toHaveCount(0);
    expect(reads).toBe(2);
    expect(generations).toBe(1);
    await page.getByRole("button", { name: "Close item details" }).click();
    await page
      .getByRole("button", { name: "Open item 2:", exact: false })
      .click();
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.route(
      "**/api/rfqs/*/lines/line-2/explanation",
      async (route) => {
        if (route.request().method() === "GET") return route.fallback();
        return route.fulfill({
          status: 502,
          json: {
            error: {
              code: "AI_UNAVAILABLE",
              message:
                "Nicrron is temporarily unavailable. Your quote is unchanged.",
            },
          },
        });
      },
    );
    await card.getByRole("button", { name: "Explain this item" }).click();
    await expect(card.getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await expect(
      card.getByRole("button", { name: "Explain this item" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Add missing details", exact: true }),
    ).toBeEnabled();
  });
}
