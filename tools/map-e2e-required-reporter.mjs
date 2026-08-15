/**
 * Fail-closed release reporter for the deployed map evidence matrix.
 *
 * Only aggregate counts are emitted: fixture labels, URLs, test titles, and
 * annotation descriptions are deliberately excluded from the release ledger.
 */
export default class RequiredMapE2EReporter {
  constructor() {
    this.requiredFixtureBlocks = 0;
    this.externalBlocks = 0;
    this.failures = 0;
  }

  onTestEnd(test, result) {
    const annotations = [...(test?.annotations ?? []), ...(result?.annotations ?? [])];
    const hasExternalBlock = annotations.some((annotation) => annotation?.type === "external-blocked");
    const hasRequiredBlock = annotations.some((annotation) => annotation?.type === "blocked");
    if (hasExternalBlock) this.externalBlocks += 1;
    if (hasRequiredBlock || (result?.status === "skipped" && !hasExternalBlock)) this.requiredFixtureBlocks += 1;
    if (result?.status === "failed" || result?.status === "timedOut") this.failures += 1;
  }

  onEnd(result) {
    const blocked = this.requiredFixtureBlocks > 0 || this.externalBlocks > 0 || this.failures > 0;
    const status = blocked ? "BLOCKED" : "PASSED";
    const ledger = `MAP_E2E_REQUIRED_STATUS=${status} fixtureBlocks=${this.requiredFixtureBlocks} externalBlocks=${this.externalBlocks} failures=${this.failures}`;
    (blocked ? console.error : console.log)(ledger);
    return blocked ? { status: "failed" } : { status: result?.status ?? "passed" };
  }
}
