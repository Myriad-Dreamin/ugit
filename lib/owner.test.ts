import { describe, expect, it } from "vitest";
import { configuredOwner, getRepositoryHref, isConfiguredOwner } from "@/lib/owner";

describe("configuredOwner", () => {
  it("keeps the checked-in single-user configuration", () => {
    expect(configuredOwner).toEqual({
      username: "Myriad-Dreamin",
    });
  });
});

describe("isConfiguredOwner", () => {
  it("matches the configured username exactly", () => {
    expect(isConfiguredOwner("Myriad-Dreamin")).toBe(true);
    expect(isConfiguredOwner("myriad-dreamin")).toBe(false);
    expect(isConfiguredOwner("someone-else")).toBe(false);
  });
});

describe("getRepositoryHref", () => {
  it("builds the canonical per-repository route for the configured owner", () => {
    expect(getRepositoryHref("repo-x")).toBe("/Myriad-Dreamin/repo-x");
    expect(getRepositoryHref("repo with spaces")).toBe("/Myriad-Dreamin/repo%20with%20spaces");
  });
});
