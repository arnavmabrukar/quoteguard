import "server-only";
import { db } from "../db";
import { AppError } from "../access";
import { runInWorkspace, workspaceScope } from "../workspace-context";

// Fixed server-only namespace cannot be chosen by signed UUID browser cookies.
// One persisted allowance bounds provider calls even if visitors clear cookies.
export async function reserveAiRequest() {
  const limit = Math.max(
    1,
    Math.min(1000, Number(process.env.NICRRON_DAILY_REQUEST_LIMIT) || 100),
  );
  const workspace = workspaceScope() || "owner";
  const date = new Date().toISOString().slice(0, 10);
  return runInWorkspace("system-ai-budget", async () => {
    const id = `nicrron:${date}`;
    await db.setting.upsert({
      where: { id },
      create: { id, data: JSON.stringify({ total: 0, workspaces: {} }) },
      update: {},
    });
    await db.$transaction(async (tx) => {
      const row = (await tx.setting.findUnique({ where: { id } }))!;
      const counts = JSON.parse(row.data) as {
        total: number;
        workspaces: Record<string, number>;
      };
      const used = counts.workspaces[workspace] || 0;
      if (counts.total >= limit || used >= 20)
        throw new AppError(
          429,
          "AI_LIMIT",
          "The demo’s daily AI allowance has been reached. Saved explanations and quote checks are still available.",
        );
      counts.total++;
      counts.workspaces[workspace] = used + 1;
      const changed = await tx.setting.updateMany({
        where: { id, data: row.data },
        data: { data: JSON.stringify(counts) },
      });
      if (!changed.count)
        throw new AppError(
          429,
          "AI_BUSY",
          "Another AI request is being started. Try again in a moment.",
        );
    });
  });
}
