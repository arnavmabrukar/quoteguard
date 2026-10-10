import "server-only";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { publicDemo } from "./session";
import { workspaceScope } from "./workspace-context";
import { logicalResult, scopeQueryArgs } from "./workspace-keys";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
const base =
  globalDb.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          `file:${path.join(process.cwd(), ".data/database/quoteguard.db")}`,
      },
    },
  });
if (process.env.NODE_ENV !== "production") globalDb.prisma = base;

function scopedClient(scope: string) {
  const prefix = `demo_${scope}:`;
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(
            scopeQueryArgs(args, model, operation, prefix) as typeof args,
          );
          return logicalResult(result, prefix);
        },
      },
    },
  });
}
const clients = new Map<string, ReturnType<typeof scopedClient>>();
export const db = new Proxy(base, {
  get(target, property) {
    const scope = workspaceScope();
    if (publicDemo() && !scope)
      throw new Error("Missing demo workspace context.");
    if (!scope) return Reflect.get(target, property);
    if (
      typeof property === "string" &&
      property.startsWith("$") &&
      property !== "$transaction"
    ) {
      throw new Error(
        "Direct database access is unavailable in a demo workspace.",
      );
    }
    let client = clients.get(scope);
    if (!client) {
      client = scopedClient(scope);
      if (clients.size >= 500) clients.delete(clients.keys().next().value!);
      clients.set(scope, client);
    }
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
