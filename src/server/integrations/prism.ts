import "server-only";
// Documented HTTP ingestion only. Trace delivery never sets an evaluation to Passed.
export async function emitTrace(
  input: string,
  output: string,
  sessionId: string,
  revision: number,
) {
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
    const response = await fetch(`${host.replace(/\/$/, "")}/api/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": key },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        project_id: project,
        model: process.env.NICRRON_MODEL || "quoteguard-demo",
        input_messages: [{ role: "user", content: input }],
        output_message: output,
        latency_ms: 0,
        session_id: sessionId,
        agent_id: "quoteguard-estimator",
        trace_id: crypto.randomUUID(),
        metadata: {
          source: "quoteguard-local-prototype",
          revision,
          synthetic: true,
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
