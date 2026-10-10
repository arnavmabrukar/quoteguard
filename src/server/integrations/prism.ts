import "server-only";
import { createHash } from "node:crypto";
import { workspaceScope } from "../workspace-context";

export type TraceResult = {
  telemetry: string;
  traceId: string | null;
  evaluation: "Unavailable";
};
export type TraceOptions = {
  model: string;
  operation: string;
  latencyMs: number;
  system?: string;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
  synthetic?: boolean;
  sampleData?: boolean;
};
// The same RFQ in different browser workspaces must not share a PRISM session.
export function prismSessionId(logicalId: string) {
  return `qg-${createHash("sha256")
    .update(`${workspaceScope() || "private-workspace"}\0${logicalId}`)
    .digest("hex")}`;
}
function safeContent(value: string) {
  for (const secret of [
    process.env.PRISMTRACE_API_KEY,
    process.env.NICRRON_API_KEY,
  ]) {
    if (secret) value = value.replaceAll(secret, "[redacted]");
  }
  return value.slice(0, 32000);
}
// Documented HTTP ingestion only. Trace delivery never sets an evaluation to Passed.
export async function emitTrace(
  input: string,
  output: string,
  sessionId: string,
  revision: number,
  options?: TraceOptions,
): Promise<TraceResult> {
  const {
    PRISMTRACE_HOST: host,
    PRISMTRACE_PROJECT_ID: project,
    PRISMTRACE_API_KEY: key,
  } = process.env;
  if (!host || !project || !key)
    return {
      telemetry: "Not configured",
      traceId: null,
      evaluation: "Unavailable" as const,
    };
  try {
    if (new URL(host).protocol !== "https:")
      return {
        telemetry: "Error: PRISM requires HTTPS",
        traceId: null,
        evaluation: "Unavailable",
      };
    const captureContent = process.env.PRISMTRACE_CAPTURE_CONTENT === "true";
    const messages = captureContent
      ? [
          ...(options?.system
            ? [{ role: "system", content: safeContent(options.system) }]
            : []),
          { role: "user", content: safeContent(input) },
        ]
      : [{ role: "user", content: "[Prompt content omitted by QuoteGuard]" }];
    const response = await fetch(`${host.replace(/\/$/, "")}/api/traces`, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": key },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        project_id: project,
        model: options?.model || "quoteguard-connection-check",
        input_messages: messages,
        output_message: captureContent
          ? safeContent(output)
          : "[Response content omitted by QuoteGuard]",
        latency_ms: Math.max(0, Math.round(options?.latencyMs || 0)),
        session_id: prismSessionId(sessionId),
        agent_id: "quoteguard-estimator",
        agent_name: "QuoteGuard estimator",
        trace_id: crypto.randomUUID(),
        ...(options?.inputTokens !== undefined
          ? { token_count_input: options.inputTokens }
          : {}),
        ...(options?.outputTokens !== undefined
          ? { token_count_output: options.outputTokens }
          : {}),
        metadata: {
          source: "quoteguard",
          environment:
            process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
          operation: options?.operation || "connection-check",
          revision,
          synthetic: options?.synthetic ?? true,
          sample_data: options?.sampleData ?? false,
          status: options?.errorCode ? "error" : "ok",
          ...(options?.errorCode ? { error_code: options.errorCode } : {}),
          content_captured: captureContent,
          content_truncated:
            captureContent &&
            [input, output, options?.system || ""].some(
              (s) => s.length > 32000,
            ),
          input_characters: input.length,
          output_characters: output.length,
        },
      }),
    });
    if (!response.ok)
      return {
        telemetry: `Error (${response.status})`,
        traceId: null,
        evaluation: "Unavailable" as const,
      };
    const body = await response.json();
    if (typeof body.id !== "string")
      return {
        telemetry: "Error: missing trace reference",
        traceId: null,
        evaluation: "Unavailable" as const,
      };
    return {
      telemetry: "Accepted",
      traceId: body.id,
      evaluation: "Unavailable" as const,
    };
  } catch {
    return {
      telemetry: "Error: request timed out or network unavailable",
      traceId: null,
      evaluation: "Unavailable" as const,
    };
  }
}
export const prismCapabilities = {
  guardrails: "Unavailable: Nicrron proxy chaining has not been verified.",
  evaluation: "Unavailable: no verified evaluator result retrieval contract.",
  grounding:
    "Unavailable: no documented Knowledge Base query contract was confirmed.",
};
