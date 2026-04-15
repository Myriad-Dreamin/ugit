import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

      expect(
        existsSync(discoveryPath),
        `${discoveryPath} is missing; run ./scripts/sync-ugit-ci-skill.sh from a writable checkout so the repo-local skill can be materialized before review`,
      ).toBe(true);
      expect(readFileSync(discoveryPath, "utf8")).toBe(readFileSync(authoredPath, "utf8"));
    }
  });
});
