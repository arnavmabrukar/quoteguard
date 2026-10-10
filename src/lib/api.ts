export async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Sign in to continue.");
  }
  if (!response.ok)
    throw new Error(
      result.error?.message || "Request failed. Please try again.",
    );
  return result;
}
