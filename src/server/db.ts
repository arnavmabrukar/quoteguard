import "server-only";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
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
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
