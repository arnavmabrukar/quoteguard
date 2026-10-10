import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  scenarios,
  evaluationDataset,
  suiteVersion,
} from "@/domain/evaluation/cases";
import { runEvaluation, type EvaluationReport } from "@/domain/evaluation/run";
import { db } from "../db";
const key = "software-evaluation";
export { evaluationDataset };
export function evaluateSoftware() {
  return runEvaluation({
    id: randomUUID(),
    datasetHash: createHash("sha256")
      .update(JSON.stringify(evaluationDataset()))
      .digest("hex"),
    codeRevision: process.env.VERCEL_GIT_COMMIT_SHA || "local working tree",
  });
}
export async function getEvaluation() {
  const saved = await db.setting.findUnique({ where: { id: key } });
  return {
    latest: saved ? (JSON.parse(saved.data) as EvaluationReport) : null,
    suiteVersion,
    caseCount: scenarios.length,
  };
}
export async function saveEvaluation() {
  const report = evaluateSoftware();
  await db.setting.upsert({
    where: { id: key },
    create: { id: key, data: JSON.stringify(report) },
    update: { data: JSON.stringify(report) },
  });
  return report;
}
