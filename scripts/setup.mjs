import { mkdirSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync(".data/database", { recursive: true });
mkdirSync(".data/uploads", { recursive: true });
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
if (!existsSync(".data/database/quoteguard.db"))
  writeFileSync(".data/database/quoteguard.db", "");
for (const args of [
  ["prisma", "generate"],
  ["prisma", "migrate", "deploy"],
]) {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
