import { spawnSync } from "node:child_process";
const postgres = /^postgres(?:ql)?:/.test(process.env.DATABASE_URL || "");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "prisma",
    "generate",
    "--schema",
    postgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma",
  ],
  { stdio: "inherit" },
);
process.exit(result.status || 0);
