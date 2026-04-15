import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const REQUIRED_SKILL_FILES = [
  "SKILL.md",
  "references/workflow-contract.md",
  "references/remote-validation.md",
  "templates/package.json.template.json",
  "templates/run-ugit-ci.sh.template",
] as const;

const AUTHORED_PREFIX = "skills/ugit-ci-setup";
const DISCOVERY_PREFIX = process.env.CODEX_SKILLS_DISCOVERY_PREFIX ?? ".codex/skills/ugit-ci-setup";

function toAuthoredPath(relativePath: (typeof REQUIRED_SKILL_FILES)[number]) {
  return join(AUTHORED_PREFIX, relativePath);
}

function toDiscoveryPath(relativePath: (typeof REQUIRED_SKILL_FILES)[number]) {
  return join(DISCOVERY_PREFIX, relativePath);
}

function readCommittedDiscoveryFile(relativePath: (typeof REQUIRED_SKILL_FILES)[number]) {
  if (DISCOVERY_PREFIX.startsWith("/")) {
    return null;
  }

  try {
    return execFileSync("git", ["show", `HEAD:${toDiscoveryPath(relativePath)}`], {
      encoding: "utf8",
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 0 &&
      "stdout" in error &&
      typeof error.stdout === "string"
    ) {
      // Some lane sandboxes report EPERM while still returning successful stdout.
      return error.stdout;
    }

    return null;
  }
}

function readTrackedDiscoveryFile(relativePath: (typeof REQUIRED_SKILL_FILES)[number]) {
  const discoveryPath = toDiscoveryPath(relativePath);

  if (existsSync(discoveryPath)) {
    return readFileSync(discoveryPath, "utf8");
  }

  return readCommittedDiscoveryFile(relativePath);
}

describe("repo-local Codex skills", () => {
  it("keeps the authored ugit CI skill payload ready to materialize", () => {
    for (const relativePath of REQUIRED_SKILL_FILES) {
      const authoredPath = toAuthoredPath(relativePath);
      expect(
        existsSync(authoredPath),
        `${authoredPath} should exist in the authored skill payload`,
      ).toBe(true);
    }
  });

  it("tracks the full ugit CI setup skill payload at the .codex discovery path", () => {
    for (const relativePath of REQUIRED_SKILL_FILES) {
      const discoveryPath = toDiscoveryPath(relativePath);
      const authoredPath = toAuthoredPath(relativePath);
      const trackedContents = readTrackedDiscoveryFile(relativePath);

      expect(
        trackedContents,
        `${discoveryPath} is missing from both the worktree and the committed Git tree; sync and commit the repo-local discovery payload from a writable checkout with ./scripts/sync-ugit-ci-skill.sh --repo-root /path/to/writable-checkout, or export and apply the patch from ./scripts/export-ugit-ci-skill-patch.sh before rerunning this proof`,
      ).not.toBeNull();
      expect(trackedContents).toBe(readFileSync(authoredPath, "utf8"));
    }
  });
});
