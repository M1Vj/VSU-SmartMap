import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJsonUrl = new URL("../../package.json", import.meta.url);
const qualityWorkflowUrl = new URL(
  "../../.github/workflows/quality.yml",
  import.meta.url,
);

test("quality app job runs the deterministic chat eval after tests and before build", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  const workflow = await readFile(qualityWorkflowUrl, "utf8");

  assert.equal(
    packageJson.scripts["eval:chat"],
    "node tools/evals/run-chat-evals.mjs",
  );

  const testStep = workflow.indexOf("- run: npm test");
  const evalStep = workflow.indexOf("- run: npm run eval:chat");
  const buildStep = workflow.indexOf("- run: npm run build");

  assert.ok(testStep >= 0, "quality workflow must run tests");
  assert.ok(evalStep > testStep, "chat eval must run after tests");
  assert.ok(buildStep > evalStep, "chat eval must run before build");
});
