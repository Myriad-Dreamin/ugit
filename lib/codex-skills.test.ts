import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repo-local Codex skills", () => {
  it("keeps the authored ugit CI skill payload ready to materialize", () => {
    expect(existsSync("skills/ugit-ci-setup/SKILL.md")).toBe(true);
    expect(existsSync("skills/ugit-ci-setup/references/workflow-contract.md")).toBe(true);
    expect(existsSync("skills/ugit-ci-setup/references/remote-validation.md")).toBe(true);
    expect(existsSync("skills/ugit-ci-setup/templates/package.json.template.json")).toBe(true);
    expect(existsSync("skills/ugit-ci-setup/templates/run-ugit-ci.sh.template")).toBe(true);
  });

  it("includes the ugit CI setup skill at the .codex discovery path", () => {
    expect(
      existsSync(".codex/skills/ugit-ci-setup/SKILL.md"),
      "run ./scripts/materialize-ugit-ci-skill.sh from a writable checkout to copy skills/ugit-ci-setup into .codex/skills/ugit-ci-setup",
    ).toBe(true);
  });
});
