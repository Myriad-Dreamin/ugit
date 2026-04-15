import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repo-local Codex skills", () => {
  it("includes the ugit CI setup skill at the .codex discovery path", () => {
    expect(existsSync(".codex/skills/ugit-ci-setup/SKILL.md")).toBe(true);
  });
});
