#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const { evaluateDataset, parseEvalCase } = await tsImport(
  "../../lib/ai/ops/eval.ts",
  import.meta.url,
);

const defaultDataset = new URL("./chat-golden.v1.jsonl", import.meta.url);
const datasetPath = process.argv[2]
  ? fileURLToPath(new URL(process.argv[2], `file://${process.cwd()}/`))
  : fileURLToPath(defaultDataset);

try {
  const source = await readFile(datasetPath, "utf8");
  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const cases = lines.map((line, index) => {
    try {
      return parseEvalCase(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid eval case on line ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  });
  const report = evaluateDataset(cases);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.summary.p0Failures > 0 ? 1 : 0;
} catch (error) {
  const report = {
    schemaVersion: 1,
    fatal: error instanceof Error ? error.message : "Unable to evaluate dataset",
    summary: { total: 0, passed: 0, failed: 1, p0Failures: 1, recallAtK: 0, mrr: 0 },
    cases: [],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
