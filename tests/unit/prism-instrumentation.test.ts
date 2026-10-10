import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nicrronCompletion } from "@/server/integrations/nicrron";
import { prismSessionId } from "@/server/integrations/prism";
import { runInWorkspace } from "@/server/workspace-context";

beforeEach(() => {
  vi.stubEnv("NICRRON_API_KEY", "nicrron-test-secret");
  vi.stubEnv("NICRRON_MODEL", "openai/gpt-4.1-mini");
  vi.stubEnv("PRISMTRACE_HOST", "https://prism.example.invalid");
  vi.stubEnv("PRISMTRACE_PROJECT_ID", "test-project");
  vi.stubEnv("PRISMTRACE_API_KEY", "prism-test-secret");
  vi.stubEnv("PRISMTRACE_CAPTURE_CONTENT", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const completion = () =>
  Response.json({
    choices: [{ message: { content: "A real model response" } }],
    usage: { prompt_tokens: 41, completion_tokens: 12 },
  });
function mockDelivery(
  second: () => Promise<Response> = async () =>
    Response.json({ id: "received-trace" }),
) {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(completion())
    .mockImplementationOnce(second);
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("PRISM instrumentation", () => {
  it("emits one awaited trace for the real model call, including usage and measured latency", async () => {
    vi.stubEnv("PRISMTRACE_CAPTURE_CONTENT", "true");
    let finish!: (response: Response) => void;
    const fetcher = mockDelivery(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onResult = vi.fn();
    let completed = false;
    const request = nicrronCompletion("System", "Sample RFQ", {
      trace: {
        sessionId: "RFQ-1",
        operation: "line-explanation",
        revision: 3,
        sampleData: true,
        onResult,
      },
    }).then((value) => {
      completed = true;
      return value;
    });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(completed).toBe(false);
    const [url, options] = fetcher.mock.calls[1];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://prism.example.invalid/api/traces");
    expect(options.headers["X-PRISMtrace-Key"]).toBe("prism-test-secret");
    expect(options.redirect).toBe("error");
    expect(body).toMatchObject({
      model: "openai/gpt-4.1-mini",
      token_count_input: 41,
      token_count_output: 12,
      session_id: prismSessionId("RFQ-1"),
      agent_id: "quoteguard-estimator",
      output_message: "A real model response",
      metadata: {
        operation: "line-explanation",
        revision: 3,
        synthetic: false,
        sample_data: true,
        status: "ok",
      },
    });
    expect(body.input_messages).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Sample RFQ" },
    ]);
    expect(Number.isInteger(body.latency_ms)).toBe(true);
    expect(body.latency_ms).toBeGreaterThanOrEqual(0);
    expect(options.body).not.toContain("prism-test-secret");
    finish(Response.json({ id: "received-trace" }));
    await expect(request).resolves.toBe("A real model response");
    expect(onResult).toHaveBeenCalledWith({
      telemetry: "Accepted",
      traceId: "received-trace",
      evaluation: "Unavailable",
    });
  });
  it("omits prompts and responses by default and redacts configured secrets when opted in", async () => {
    let fetcher = mockDelivery();
    await nicrronCompletion("Private system", "Private customer details");
    expect(fetcher.mock.calls[1][1].body).not.toMatch(
      /Private|A real model response/,
    );
    vi.stubEnv("PRISMTRACE_CAPTURE_CONTENT", "true");
    fetcher = mockDelivery();
    await nicrronCompletion("nicrron-test-secret", "prism-test-secret");
    expect(fetcher.mock.calls[1][1].body).not.toMatch(
      /nicrron-test-secret|prism-test-secret/,
    );
    expect(fetcher.mock.calls[1][1].body).toContain("[redacted]");
  });
  it("preserves the response when PRISM is down", async () => {
    mockDelivery(async () => {
      throw new Error("sensitive provider details");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(nicrronCompletion("system", "input")).resolves.toBe(
      "A real model response",
    );
    expect(warn).toHaveBeenCalledWith(
      "PRISM trace delivery failed:",
      expect.stringContaining("Error"),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive");
  });
  it.each(["http", "network", "malformed"])(
    "records sanitized %s errors without replacing the original failure",
    async (kind) => {
      const fetcher = vi.fn();
      if (kind === "http")
        fetcher.mockResolvedValueOnce(
          new Response("private provider response", { status: 503 }),
        );
      if (kind === "network")
        fetcher.mockRejectedValueOnce(new Error("network down"));
      if (kind === "malformed")
        fetcher.mockResolvedValueOnce(Response.json({ choices: [] }));
      fetcher.mockResolvedValueOnce(Response.json({ id: "failure-trace" }));
      vi.stubGlobal("fetch", fetcher);
      await expect(nicrronCompletion("system", "input")).rejects.toThrow();
      const payload = JSON.parse(fetcher.mock.calls[1][1].body);
      expect(payload.metadata).toMatchObject({
        status: "error",
        error_code: {
          http: "HTTP_503",
          network: "NETWORK_OR_TIMEOUT",
          malformed: "MALFORMED_RESPONSE",
        }[kind],
      });
      expect(fetcher.mock.calls[1][1].body).not.toMatch(
        /private provider response|network down/,
      );
    },
  );
  it("groups an RFQ consistently within a workspace and separates browser workspaces", () => {
    const first = runInWorkspace("browser-one", () =>
      prismSessionId("RFQ-1042"),
    );
    expect(
      runInWorkspace("browser-one", () => prismSessionId("RFQ-1042")),
    ).toBe(first);
    expect(
      runInWorkspace("browser-two", () => prismSessionId("RFQ-1042")),
    ).not.toBe(first);
    expect(first).not.toMatch(/browser-one|RFQ-1042/);
  });
  it("marks connection checks synthetic and does not send anything when unconfigured", async () => {
    let fetcher = mockDelivery();
    await nicrronCompletion("check", "check", {
      trace: {
        sessionId: "connection",
        operation: "connection-check",
        synthetic: true,
      },
    });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).metadata.synthetic).toBe(
      true,
    );
    vi.stubEnv("PRISMTRACE_API_KEY", "");
    fetcher = mockDelivery();
    await nicrronCompletion("system", "input");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
