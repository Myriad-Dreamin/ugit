import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getHomepageContent,
  hasHomepageContentTable,
  setHomepageContent,
} from "@/lib/storage/homepage";
import {
  readStorageMetadata,
  resetStorageCacheForTests,
  resolveStorageLocation,
  withStorage,
} from "@/lib/storage/sqlite";

const workspaces: string[] = [];

afterEach(() => {
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("homepage storage", () => {
  it("creates the homepage domain table and seeds content in a temp sqlite file", async () => {
    const workspace = createWorkspace();
    const location = path.join(workspace, "content", "homepage");
    const content = await getHomepageContent(location);
    const resolvedLocation = resolveStorageLocation(location);

    expect(existsSync(resolvedLocation.resolvedPath)).toBe(true);
    expect(hasHomepageContentTable(location)).toBe(true);
    expect(content).toMatchObject({
      eyebrow: "ugit repositories",
      endpointLabel: "JSON endpoint",
      endpointPath: "/api/repositories",
      repositoriesPath: ".data/repos",
      subtitle:
        "The server seeds a real example Git repository on demand and exposes the current repository listing over HTTP, plus direct repository pages for the configured owner.",
      title: "Local repositories, served from",
    });
    expect(Number.isNaN(Date.parse(content.updatedAt))).toBe(false);
    expect(readStorageMetadata(location)).toMatchObject({
      createdAt: expect.any(String),
      schemaVersion: 1,
      storageEngine: "better-sqlite3",
    });

    expect(
      withStorage(location, (database) =>
        database
          .prepare<[], { count: number }>(
            `
              SELECT COUNT(*) AS count
              FROM homepage_content
            `,
          )
          .get(),
      ),
    ).toEqual({
      count: 1,
    });
  });

  it("persists homepage updates through queued mutations", async () => {
    const workspace = createWorkspace();
    const location = path.join(workspace, "content", "homepage.sqlite");
    const savedContent = await setHomepageContent(
      {
        eyebrow: "custom eyebrow",
        endpointLabel: "API route",
        endpointPath: "/api/custom",
        repositoriesPath: ".data/custom-repos",
        subtitle: "Custom subtitle",
        title: "Custom title",
      },
      location,
    );

    await expect(getHomepageContent(location)).resolves.toEqual(savedContent);
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-homepage-storage-"));

  workspaces.push(workspace);

  return workspace;
}
