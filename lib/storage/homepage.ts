import "@/lib/storage/server-only";

import {
  applyMigrations,
  checkTableExists,
  queueStorageMutation,
  runStorageTransaction,
  withStorage,
  type DatabaseSync,
  type StorageMigration,
  type StorageOptions,
} from "@/lib/storage/sqlite";

export type HomepageContent = Readonly<{
  eyebrow: string;
  endpointLabel: string;
  endpointPath: string;
  repositoriesPath: string;
  subtitle: string;
  title: string;
  updatedAt: string;
}>;

export type HomepageContentInput = Omit<HomepageContent, "updatedAt">;

type HomepageContentRow = {
  eyebrow: string;
  endpoint_label: string;
  endpoint_path: string;
  repositories_path: string;
  subtitle: string;
  title: string;
  updated_at: string;
};

const HOMEPAGE_CONTENT_ID = 1;
const DEFAULT_HOMEPAGE_CONTENT: HomepageContentInput = {
  eyebrow: "ugit repositories",
  endpointLabel: "JSON endpoint",
  endpointPath: "/api/repositories",
  repositoriesPath: ".data/repos",
  subtitle:
    "The server seeds a real example Git repository on demand and exposes the current repository listing over HTTP, plus direct repository pages for the configured owner.",
  title: "Local repositories, served from",
};
const HOMEPAGE_MIGRATIONS: readonly StorageMigration[] = [
  {
    version: 1,
    name: "create_homepage_content",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS homepage_content (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          eyebrow TEXT NOT NULL,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL,
          repositories_path TEXT NOT NULL,
          endpoint_label TEXT NOT NULL,
          endpoint_path TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      writeHomepageContent(database, withTimestamp(DEFAULT_HOMEPAGE_CONTENT));
    },
  },
];

export function ensureHomepageStorage(options: StorageOptions | string | undefined = {}): void {
  applyMigrations(options, HOMEPAGE_MIGRATIONS);
}

export function hasHomepageContentTable(
  options: StorageOptions | string | undefined = {},
): boolean {
  ensureHomepageStorage(options);

  return withStorage(options, (database) => checkTableExists(database, "homepage_content"));
}

export async function getHomepageContent(
  options: StorageOptions | string | undefined = {},
): Promise<HomepageContent> {
  ensureHomepageStorage(options);

  const existingContent = withStorage(options, (database) => readHomepageContent(database));

  if (existingContent) {
    return existingContent;
  }

  return queueStorageMutation(options, (database) =>
    runStorageTransaction(
      database,
      (transactionDatabase) => {
        const currentContent = readHomepageContent(transactionDatabase);

        if (currentContent) {
          return currentContent;
        }

        writeHomepageContent(transactionDatabase, withTimestamp(DEFAULT_HOMEPAGE_CONTENT));

        const persistedContent = readHomepageContent(transactionDatabase);

        if (!persistedContent) {
          throw new Error("Failed to seed homepage content.");
        }

        return persistedContent;
      },
      "immediate",
    ),
  );
}

export async function setHomepageContent(
  content: HomepageContentInput,
  options: StorageOptions | string | undefined = {},
): Promise<HomepageContent> {
  ensureHomepageStorage(options);

  return queueStorageMutation(options, (database) =>
    runStorageTransaction(
      database,
      (transactionDatabase) => {
        writeHomepageContent(transactionDatabase, withTimestamp(content));

        const persistedContent = readHomepageContent(transactionDatabase);

        if (!persistedContent) {
          throw new Error("Failed to persist homepage content.");
        }

        return persistedContent;
      },
      "immediate",
    ),
  );
}

function readHomepageContent(database: DatabaseSync): HomepageContent | null {
  const row = database
    .prepare<[number], HomepageContentRow>(
      `
        SELECT eyebrow, title, subtitle, repositories_path, endpoint_label, endpoint_path, updated_at
        FROM homepage_content
        WHERE id = ?
      `,
    )
    .get(HOMEPAGE_CONTENT_ID);

  return row
    ? {
        eyebrow: row.eyebrow,
        endpointLabel: row.endpoint_label,
        endpointPath: row.endpoint_path,
        repositoriesPath: row.repositories_path,
        subtitle: row.subtitle,
        title: row.title,
        updatedAt: row.updated_at,
      }
    : null;
}

function writeHomepageContent(database: DatabaseSync, content: HomepageContent): void {
  database
    .prepare<[number, string, string, string, string, string, string, string]>(
      `
        INSERT INTO homepage_content (
          id,
          eyebrow,
          title,
          subtitle,
          repositories_path,
          endpoint_label,
          endpoint_path,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          eyebrow = excluded.eyebrow,
          title = excluded.title,
          subtitle = excluded.subtitle,
          repositories_path = excluded.repositories_path,
          endpoint_label = excluded.endpoint_label,
          endpoint_path = excluded.endpoint_path,
          updated_at = excluded.updated_at
      `,
    )
    .run(
      HOMEPAGE_CONTENT_ID,
      content.eyebrow,
      content.title,
      content.subtitle,
      content.repositoriesPath,
      content.endpointLabel,
      content.endpointPath,
      content.updatedAt,
    );
}

function withTimestamp(content: HomepageContentInput): HomepageContent {
  return {
    ...content,
    updatedAt: new Date().toISOString(),
  };
}
