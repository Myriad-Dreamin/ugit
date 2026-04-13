import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Repository = {
  name: string;
  path: string;
  relativePath: string;
};

export type RepositoryRootEntry = {
  kind: "directory" | "file";
  name: string;
  path: string;
  relativePath: string;
};

type RepositoryOptions = Readonly<{
  cwd?: string;
  runGit?: typeof execFileSync;
}>;

const REPOSITORIES_ROOT = path.join(".data", "repos");
const EXAMPLE_REPOSITORY_NAME = "example-repo";
const EXAMPLE_REPOSITORY_README = `# example-repo

This repository is created automatically by ugit so the HTTP listing has a real Git repository to display.
`;

export function getRepositoriesRoot(cwd: string = process.cwd()): string {
  return path.resolve(cwd, REPOSITORIES_ROOT);
}

export function ensureExampleRepository(options: RepositoryOptions = {}): Repository {
  const cwd = options.cwd ?? process.cwd();
  const repositoriesRoot = getRepositoriesRoot(cwd);

  mkdirSync(repositoriesRoot, { recursive: true });

  const exampleRepositoryPath = path.join(repositoriesRoot, EXAMPLE_REPOSITORY_NAME);

  mkdirSync(exampleRepositoryPath, { recursive: true });

  const readmePath = path.join(exampleRepositoryPath, "README.md");

  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, EXAMPLE_REPOSITORY_README, "utf8");
  }

  if (!existsSync(path.join(exampleRepositoryPath, ".git"))) {
    initializeGitRepository(exampleRepositoryPath, options.runGit);
  }

  return toRepository(exampleRepositoryPath, cwd);
}

export function listRepositories(options: RepositoryOptions = {}): Repository[] {
  const cwd = options.cwd ?? process.cwd();
  const repositoriesRoot = getRepositoriesRoot(cwd);

  ensureExampleRepository(options);

  return readdirSync(repositoriesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(repositoriesRoot, entry.name))
    .filter(hasGitEntry)
    .map((repositoryPath) => toRepository(repositoryPath, cwd))
    .sort((left, right) => compareByRelativePath(left.relativePath, right.relativePath));
}

export function getRepositoryByName(
  repositoryName: string,
  options: RepositoryOptions = {},
): Repository | null {
  return listRepositories(options).find((repository) => repository.name === repositoryName) ?? null;
}

export function listRepositoryRootEntries(repository: Repository): RepositoryRootEntry[] {
  return readdirSync(repository.path, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git")
    .map((entry) => toRepositoryRootEntry(repository, entry.name, entry.isDirectory()))
    .sort((left, right) => compareByRelativePath(left.relativePath, right.relativePath));
}

function hasGitEntry(repositoryPath: string): boolean {
  return existsSync(path.join(repositoryPath, ".git"));
}

function initializeGitRepository(
  repositoryPath: string,
  runGit: typeof execFileSync = execFileSync,
): void {
  try {
    runGit("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
      stdio: "ignore",
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize a Git repository at ${repositoryPath}. Ensure git is installed and available on PATH.`,
      { cause: error },
    );
  }
}

function toRepository(repositoryPath: string, cwd: string): Repository {
  return {
    name: path.basename(repositoryPath),
    path: repositoryPath,
    relativePath: path.relative(cwd, repositoryPath),
  };
}

function toRepositoryRootEntry(
  repository: Repository,
  entryName: string,
  isDirectory: boolean,
): RepositoryRootEntry {
  return {
    kind: isDirectory ? "directory" : "file",
    name: entryName,
    path: path.join(repository.path, entryName),
    relativePath: path.join(repository.relativePath, entryName),
  };
}

function compareByRelativePath(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
