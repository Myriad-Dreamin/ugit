import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repo-local Codex skills", () => {
  it("includes the ugit CI setup skill at the .codex discovery path", () => {
    expect(
      existsSync(".codex/skills/ugit-ci-setup/SKILL.md"),
      "copy skills/ugit-ci-setup into .codex/skills/ugit-ci-setup from a writable checkout",
    ).toBe(true);
  });
});
