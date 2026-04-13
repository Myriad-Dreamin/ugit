import "server-only";

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";

export type DatabaseSync = BetterSqlite3.Database;

export type StorageOptions = Readonly<{
  cwd?: string;
  location?: string;
}>;

export type ResolvedStorageLocation = Readonly<{
  directoryPath: string | null;
  exists: boolean;
  inputPath: string;
  isMemory: boolean;
  resolvedPath: string;
}>;

export type StorageMetadata = Readonly<{
  createdAt: string;
  schemaVersion: number;
  storageEngine: "better-sqlite3";
}>;

export type StorageState = Readonly<{
  exists: boolean;
  hasSchemaMigrationsTable: boolean;
  hasStorageMetadataTable: boolean;
  location: ResolvedStorageLocation;
  metadata: StorageMetadata | null;
}>;

export type StorageMigration = Readonly<{
  name: string;
  up: (database: DatabaseSync) => void;
  version: number;
}>;

export type StorageContext = Readonly<{
  database: DatabaseSync;
  location: ResolvedStorageLocation;
}>;

type StorageCallback<T> = (database: DatabaseSync, context: StorageContext) => T;
type StorageMutation<T> = (database: DatabaseSync, context: StorageContext) => Promise<T> | T;
type StorageTransactionMode = "deferred" | "exclusive" | "immediate";
type MetadataRow = {
  key: string;
  value: string;
};
type SchemaVersionRow = {
  version: number;
};
type StorageGlobals = {
  connections: Map<string, DatabaseSync>;
  mutationQueues: Map<string, Promise<unknown>>;
};

const DEFAULT_STORAGE_LOCATION = path.join(".data", "storage", "ugit");
const MEMORY_STORAGE_LOCATION = ":memory:";
const STORAGE_ENGINE = "better-sqlite3" as const;

declare global {
  var __ugitSqliteStorageGlobals: StorageGlobals | undefined;
}

export function resolveStorageLocation(
  options: StorageOptions | string = {},
): ResolvedStorageLocation {
  const normalizedOptions = normalizeStorageOptions(options);
  const inputPath = normalizedOptions.location ?? DEFAULT_STORAGE_LOCATION;

  if (inputPath === MEMORY_STORAGE_LOCATION) {
    return {
      directoryPath: null,
      exists: false,
      inputPath,
      isMemory: true,
      resolvedPath: MEMORY_STORAGE_LOCATION,
    };
  }

  const locationWithExtension = inputPath.endsWith(".sqlite") ? inputPath : `${inputPath}.sqlite`;
  const resolvedPath = path.isAbsolute(locationWithExtension)
    ? locationWithExtension
    : path.resolve(normalizedOptions.cwd ?? process.cwd(), locationWithExtension);

  return {
    directoryPath: path.dirname(resolvedPath),
    exists: existsSync(resolvedPath),
    inputPath,
    isMemory: false,
    resolvedPath,
  };
}

export function getStorageState(options: StorageOptions | string = {}): StorageState {
  const location = resolveStorageLocation(options);
  const cachedDatabase = getStorageGlobals().connections.get(location.resolvedPath);

  if (!location.isMemory && !location.exists && !cachedDatabase?.open) {
    return {
      exists: false,
      hasSchemaMigrationsTable: false,
      hasStorageMetadataTable: false,
      location,
      metadata: null,
    };
  }

  return withStorage(options, (database) => ({
    exists: location.isMemory ? true : existsSync(location.resolvedPath),
    hasSchemaMigrationsTable: checkTableExists(database, "schema_migrations"),
    hasStorageMetadataTable: checkTableExists(database, "storage_metadata"),
    location,
    metadata: readStorageMetadataFromDatabase(database),
  }));
}

export function withStorage<T>(
  options: StorageOptions | string | undefined,
  callback: StorageCallback<T>,
): T {
  const context = getStorageContext(options);

  return callback(context.database, context);
}

export function applyMigrations(
  options: StorageOptions | string | undefined,
  migrations: readonly StorageMigration[],
): StorageMetadata {
  assertOrderedMigrations(migrations);

  return withStorage(options, (database) => {
    const appliedVersions = readAppliedVersions(database);

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      try {
        database.exec("BEGIN IMMEDIATE");
        migration.up(database);
        database
          .prepare<[number, string, string]>(
            `
              INSERT INTO schema_migrations (version, name, applied_at)
              VALUES (?, ?, ?)
            `,
          )
          .run(migration.version, migration.name, new Date().toISOString());
        syncStorageMetadata(database, getCurrentSchemaVersion(database));
        database.exec("COMMIT");
      } catch (error) {
        if (database.inTransaction) {
          database.exec("ROLLBACK");
        }

        throw new Error(
          `Failed to apply storage migration ${migration.version} (${migration.name}).`,
          {
            cause: error,
          },
        );
      }

      appliedVersions.add(migration.version);
    }

    return syncStorageMetadata(database, getCurrentSchemaVersion(database));
  });
}

export function readStorageMetadata(options: StorageOptions | string = {}): StorageMetadata | null {
  const location = resolveStorageLocation(options);
  const cachedDatabase = getStorageGlobals().connections.get(location.resolvedPath);

  if (!location.isMemory && !location.exists && !cachedDatabase?.open) {
    return null;
  }

  return withStorage(options, (database) => readStorageMetadataFromDatabase(database));
}

export function queueStorageMutation<T>(
  options: StorageOptions | string | undefined,
  mutation: StorageMutation<T>,
): Promise<T> {
  const context = getStorageContext(options);
  const storageGlobals = getStorageGlobals();
  const queueKey = context.location.resolvedPath;
  const previousMutation = storageGlobals.mutationQueues.get(queueKey) ?? Promise.resolve();
  const currentMutation = previousMutation
    .catch(() => undefined)
    .then(() => mutation(context.database, context));

  storageGlobals.mutationQueues.set(queueKey, currentMutation);

  return currentMutation.finally(() => {
    if (storageGlobals.mutationQueues.get(queueKey) === currentMutation) {
      storageGlobals.mutationQueues.delete(queueKey);
    }
  });
}

export function runStorageTransaction<T>(
  database: DatabaseSync,
  callback: (database: DatabaseSync) => T,
  mode: StorageTransactionMode = "deferred",
): T {
  const transaction = database.transaction(() => callback(database));

  switch (mode) {
    case "exclusive":
      return transaction.exclusive();
    case "immediate":
      return transaction.immediate();
    default:
      return transaction();
  }
}

export function checkTableExists(database: DatabaseSync, tableName: string): boolean {
  const row = database
    .prepare<[string], { name: string }>(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `,
    )
    .get(tableName);

  return row !== undefined;
}

export function resetStorageCacheForTests(): void {
  const storageGlobals = getStorageGlobals();

  for (const database of storageGlobals.connections.values()) {
    if (database.open) {
      database.close();
    }
  }

  storageGlobals.connections.clear();
  storageGlobals.mutationQueues.clear();
}

function normalizeStorageOptions(options: StorageOptions | string | undefined): StorageOptions {
  return typeof options === "string" ? { location: options } : (options ?? {});
}

function getStorageGlobals(): StorageGlobals {
  globalThis.__ugitSqliteStorageGlobals ??= {
    connections: new Map(),
    mutationQueues: new Map(),
  };

  return globalThis.__ugitSqliteStorageGlobals;
}

function getStorageContext(options: StorageOptions | string | undefined): StorageContext {
  const location = resolveStorageLocation(options);
  const storageGlobals = getStorageGlobals();
  const cachedDatabase = storageGlobals.connections.get(location.resolvedPath);

  if (cachedDatabase?.open) {
    return {
      database: cachedDatabase,
      location,
    };
  }

  const database = createDatabase(location);

  storageGlobals.connections.set(location.resolvedPath, database);

  return {
    database,
    location,
  };
}

function createDatabase(location: ResolvedStorageLocation): DatabaseSync {
  if (!location.isMemory && location.directoryPath) {
    mkdirSync(location.directoryPath, { recursive: true });
  }

  const database = new BetterSqlite3(location.resolvedPath);

  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");

  if (!location.isMemory) {
    database.pragma("journal_mode = WAL");
  }

  bootstrapStorageTables(database);

  return database;
}

function bootstrapStorageTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storage_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  syncStorageMetadata(database, getCurrentSchemaVersion(database));
}

function readAppliedVersions(database: DatabaseSync): Set<number> {
  const rows = database
    .prepare<[], SchemaVersionRow>(
      `
        SELECT version
        FROM schema_migrations
        ORDER BY version ASC
      `,
    )
    .all();

  return new Set(rows.map((row) => row.version));
}

function getCurrentSchemaVersion(database: DatabaseSync): number {
  const row = database
    .prepare<[], SchemaVersionRow>(
      `
        SELECT COALESCE(MAX(version), 0) AS version
        FROM schema_migrations
      `,
    )
    .get();

  return row?.version ?? 0;
}

function syncStorageMetadata(database: DatabaseSync, schemaVersion: number): StorageMetadata {
  const createdAt = readMetadataValue(database, "created_at") ?? new Date().toISOString();

  upsertMetadataValue(database, "storage_engine", STORAGE_ENGINE);
  upsertMetadataValue(database, "created_at", createdAt);
  upsertMetadataValue(database, "schema_version", String(schemaVersion));

  return {
    createdAt,
    schemaVersion,
    storageEngine: STORAGE_ENGINE,
  };
}

function readStorageMetadataFromDatabase(database: DatabaseSync): StorageMetadata | null {
  if (!checkTableExists(database, "storage_metadata")) {
    return null;
  }

  const rows = database
    .prepare<[], MetadataRow>(
      `
        SELECT key, value
        FROM storage_metadata
        WHERE key IN ('storage_engine', 'created_at', 'schema_version')
      `,
    )
    .all();
  const metadataByKey = new Map(rows.map((row) => [row.key, row.value]));
  const storageEngine = metadataByKey.get("storage_engine");
  const createdAt = metadataByKey.get("created_at");
  const schemaVersion = metadataByKey.get("schema_version");

  if (!storageEngine || !createdAt || schemaVersion === undefined) {
    return null;
  }

  return {
    createdAt,
    schemaVersion: Number(schemaVersion),
    storageEngine: storageEngine as StorageMetadata["storageEngine"],
  };
}

function readMetadataValue(database: DatabaseSync, key: string): string | null {
  const row = database
    .prepare<[string], { value: string }>(
      `
        SELECT value
        FROM storage_metadata
        WHERE key = ?
      `,
    )
    .get(key);

  return row?.value ?? null;
}

function upsertMetadataValue(database: DatabaseSync, key: string, value: string): void {
  database
    .prepare<[string, string]>(
      `
        INSERT INTO storage_metadata (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    )
    .run(key, value);
}

function assertOrderedMigrations(migrations: readonly StorageMigration[]): void {
  let previousVersion = -1;

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 0) {
      throw new Error(
        `Storage migration "${migration.name}" must use a non-negative integer version.`,
      );
    }

    if (migration.version <= previousVersion) {
      throw new Error("Storage migrations must be ordered by strictly increasing version.");
    }

    previousVersion = migration.version;
  }
}
