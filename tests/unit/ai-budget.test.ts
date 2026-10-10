import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  db: {
    setting: {
      findUnique: mocks.read,
      upsert: mocks.upsert,
      updateMany: mocks.update,
    },
    $transaction: async (work: any) =>
      work({ setting: { findUnique: mocks.read, updateMany: mocks.update } }),
  },
}));
import { reserveAiRequest } from "@/server/integrations/ai-budget";
import { runInWorkspace, workspaceScope } from "@/server/workspace-context";
let data: string;
beforeEach(() => {
  vi.clearAllMocks();
  data = JSON.stringify({ total: 0, workspaces: {} });
  mocks.upsert.mockResolvedValue(undefined);
  mocks.read.mockImplementation(async () => ({ data }));
  mocks.update.mockImplementation(async (args) => {
    expect(workspaceScope()).toBe("system-ai-budget");
    if (args.where.data !== data) return { count: 0 };
    data = args.data.data;
    return { count: 1 };
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("Persisted AI allowance", () => {
  it("bounds total usage across different browser workspaces", async () => {
    vi.stubEnv("NICRRON_DAILY_REQUEST_LIMIT", "2");
    await runInWorkspace("one", reserveAiRequest);
    await runInWorkspace("two", reserveAiRequest);
    await expect(
      runInWorkspace("fresh-cookie", reserveAiRequest),
    ).rejects.toThrow("daily AI allowance");
    expect(JSON.parse(data).total).toBe(2);
    expect(workspaceScope()).toBeUndefined();
  });
  it("limits one workspace without using another’s allowance", async () => {
    data = JSON.stringify({ total: 20, workspaces: { one: 20 } });
    await expect(runInWorkspace("one", reserveAiRequest)).rejects.toThrow(
      "daily AI allowance",
    );
    await runInWorkspace("two", reserveAiRequest);
    expect(JSON.parse(data).workspaces).toEqual({ one: 20, two: 1 });
  });
  it("rejects a lost update instead of overspending under concurrency", async () => {
    mocks.update.mockResolvedValueOnce({ count: 0 });
    await expect(runInWorkspace("one", reserveAiRequest)).rejects.toThrow(
      "Another AI request",
    );
    expect(JSON.parse(data).total).toBe(0);
  });
});
