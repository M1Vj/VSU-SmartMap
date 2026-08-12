import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

test("package metadata, lockfile, citation, and latest changelog release stay aligned", async () => {
  const [packageText, lockText, citation, changelog] = await Promise.all([
    readFile(new URL("package.json", rootUrl), "utf8"),
    readFile(new URL("package-lock.json", rootUrl), "utf8"),
    readFile(new URL("CITATION.cff", rootUrl), "utf8"),
    readFile(new URL("CHANGELOG.md", rootUrl), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);
  const lockfile = JSON.parse(lockText);
  const latestChangelogVersion = changelog.match(/^## v([^\s]+)$/m)?.[1];

  assert.equal(lockfile.version, packageJson.version);
  assert.equal(lockfile.packages[""].version, packageJson.version);
  assert.equal(citation.match(/^version:\s*([^\s]+)$/m)?.[1], packageJson.version);
  assert.equal(latestChangelogVersion, packageJson.version);
});

test("a release tag matches the package version", async () => {
  if (process.env.GITHUB_REF_TYPE !== "tag") return;

  const packageJson = JSON.parse(
    await readFile(new URL("package.json", rootUrl), "utf8"),
  );
  assert.equal(process.env.GITHUB_REF_NAME, `v${packageJson.version}`);
});
