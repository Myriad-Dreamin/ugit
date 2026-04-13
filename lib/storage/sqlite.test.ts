import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyMigrations,
  checkTableExists,
  getStorageState,
  readStorageMetadata,
  resetStorageCacheForTests,
  resolveStorageLocation,
  withStorage,
  type StorageMigration,
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

describe("applyMigrations", () => {
  it("applies ordered migrations once, in order, and keeps metadata stable", () => {
    const executionOrder: number[] = [];
    const migrations: readonly StorageMigration[] = [
      {
        version: 1,
        name: "create_notes",
        up(database) {
          executionOrder.push(1);
          database.exec(`
            CREATE TABLE notes (
              id INTEGER PRIMARY KEY,
              body TEXT NOT NULL
            );
          `);
        },
      },
      {
        version: 2,
        name: "create_tags",
        up(database) {
          executionOrder.push(2);
          database.exec(`
            CREATE TABLE tags (
              id INTEGER PRIMARY KEY,
              label TEXT NOT NULL
            );
          `);
        },
      },
    ];

    const firstMetadata = applyMigrations(":memory:", migrations);
    const secondMetadata = applyMigrations(":memory:", migrations);

    expect(executionOrder).toEqual([1, 2]);
    expect(secondMetadata).toEqual(firstMetadata);
    expect(readStorageMetadata(":memory:")).toEqual(firstMetadata);
    expect(Number.isNaN(Date.parse(firstMetadata.createdAt))).toBe(false);

    withStorage(":memory:", (database) => {
      expect(checkTableExists(database, "notes")).toBe(true);
      expect(checkTableExists(database, "tags")).toBe(true);
      expect(
        database
          .prepare<[], { name: string; version: number }>(
            `
              SELECT version, name
              FROM schema_migrations
              ORDER BY version ASC
            `,
          )
          .all(),
      ).toEqual([
        {
          version: 1,
          name: "create_notes",
        },
        {
          version: 2,
          name: "create_tags",
        },
      ]);
    });
  });

  it("reuses one cached connection for equivalent normalized file paths", () => {
    const cwd = createWorkspace();
    const relativeLocation = path.join(".data", "storage", "content");
    const absoluteLocation = path.resolve(cwd, ".data", "storage", "content.sqlite");

    const firstDatabase = withStorage({ cwd, location: relativeLocation }, (database) => database);
    const secondDatabase = withStorage(absoluteLocation, (database) => database);

    expect(firstDatabase).toBe(secondDatabase);
    expect(resolveStorageLocation({ cwd, location: relativeLocation }).resolvedPath).toBe(
      absoluteLocation,
    );
  });

  it("supports temp-file storage state and metadata reads", () => {
    const workspace = createWorkspace();
    const location = path.join(workspace, "content", "stateful-storage");

    applyMigrations(location, [
      {
        version: 1,
        name: "create_example",
        up(database) {
          database.exec(`
            CREATE TABLE example (
              id INTEGER PRIMARY KEY
            );
          `);
        },
      },
    ]);

    expect(getStorageState(location)).toEqual({
      exists: true,
      hasSchemaMigrationsTable: true,
      hasStorageMetadataTable: true,
      location: {
        directoryPath: path.join(workspace, "content"),
        exists: true,
        inputPath: location,
        isMemory: false,
        resolvedPath: `${location}.sqlite`,
      },
      metadata: {
        createdAt: expect.any(String),
        schemaVersion: 1,
        storageEngine: "better-sqlite3",
      },
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-storage-"));

  workspaces.push(workspace);

  return workspace;
}
