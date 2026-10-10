import { afterEach, describe, it, expect, vi } from "vitest";
import { nicrronCompletion, extractLive } from "@/server/integrations/nicrron";
import { emitTrace } from "@/server/integrations/prism";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Provider failure boundaries", () => {
  it("keeps the key in server headers and caps explanation output", async () => {
    vi.stubEnv("NICRRON_API_KEY", "test-secret");
    vi.stubEnv("NICRRON_MODEL", "openai/gpt-4.1-mini");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "sample output" } }] }),
      );
    vi.stubGlobal("fetch", fetcher);
    await nicrronCompletion("system instructions", "sample facts", {
      maxTokens: 1400,
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.nicrron.ai/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-secret");
    expect(options.headers["x-nicrron-cache"]).toBe("false");
    expect(JSON.parse(options.body).max_tokens).toBe(1400);
    expect(options.body).not.toContain("test-secret");
  });
  it("missing live credentials do not fall back into demo mode", async () => {
    vi.stubEnv("NICRRON_API_KEY", "");
    vi.stubEnv("NICRRON_MODEL", "");
    await expect(nicrronCompletion("test", "test")).rejects.toThrow(
      "not configured",
    );
  });
  it("network failure is returned without fixture substitution", async () => {
    vi.stubEnv("NICRRON_API_KEY", "test");
    vi.stubEnv("NICRRON_MODEL", "openai/gpt-4.1-mini");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failure", { status: 503 })),
    );
    await expect(extractLive("10 sheets")).rejects.toThrow("503");
  });
  it("invalid extraction output never reaches application state", async () => {
    vi.stubEnv("NICRRON_API_KEY", "test");
    vi.stubEnv("NICRRON_MODEL", "openai/gpt-4.1-mini");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: '{"status":"Approved"}' } }],
        }),
      ),
    );
    await expect(extractLive("10 sheets")).rejects.toThrow("schema");
  });
  it("trace acceptance is not evaluation success", async () => {
    vi.stubEnv("PRISMTRACE_HOST", "https://example.invalid");
    vi.stubEnv("PRISMTRACE_PROJECT_ID", "test");
    vi.stubEnv("PRISMTRACE_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: "actual-returned-id" })),
    );
    const result = await emitTrace(
      "Synthetic input",
      "Synthetic output",
      "RFQ-test",
      1,
    );
    expect(result.traceId).toBe("actual-returned-id");
    expect(result.telemetry).toBe("Accepted");
    expect(result.evaluation).toBe("Unavailable");
  });
  it("a failed trace has no successful reference or passed evaluation", async () => {
    vi.stubEnv("PRISMTRACE_HOST", "https://example.invalid");
    vi.stubEnv("PRISMTRACE_PROJECT_ID", "test");
    vi.stubEnv("PRISMTRACE_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const result = await emitTrace(
      "Synthetic input",
      "Synthetic output",
      "RFQ-test",
      1,
    );
    expect(result.traceId).toBeNull();
    expect(result.evaluation).toBe("Unavailable");
    expect(result.telemetry).toContain("Error");
  });
});
