import { createInterface } from "node:readline/promises";
import { Command, Option } from "clipanion";
import {
  createRepository,
  inspectCreateRepositoryOriginConflict,
  type CreateRepositoryOriginConflict,
  type CreateRepositoryOriginConflictResolution,
} from "../create";

const OVERRIDE_ORIGIN_FLAG = "--override-origin";

export class CreateCommand extends Command {
  static paths = [["create"]];

  static usage = Command.Usage({
    category: "Repository",
    description: "Create a ugit-backed repository on a configured machine.",
    details:
      "Initializes a working-tree Git repository on the selected ugit machine using the required --name value for the remote repository, copies the local upstream remote there, records the machine in local Git config, and prompts before replacing a conflicting local origin. Use --override-origin to approve that replacement without prompting in scripts or other non-interactive runs.",
    examples: [
      [
        "Create a ugit repository in the current directory",
        "ugit create -m machine-x --name canonical-repo",
      ],
      [
        "Create a ugit repository for another local checkout",
        "ugit create -m local --name canonical-repo ../example-repo",
      ],
      [
        "Create non-interactively when a conflicting local origin should be replaced",
        "ugit create -m machine-x --name canonical-repo --override-origin",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name.",
    required: true,
  });

  repositoryName = Option.String("--name", {
    description:
      'Remote repository name to create on the selected machine. Must be one safe path segment (not empty, "." or "..", and without path separators).',
    required: true,
  });

  overrideOrigin = Option.Boolean(OVERRIDE_ORIGIN_FLAG, false, {
    description:
      "Replace a conflicting local origin without prompting. Required in non-interactive runs.",
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    const originConflict = inspectCreateRepositoryOriginConflict({
      machineName: this.machine,
      repositoryName: this.repositoryName,
      directory: this.directory,
    });
    let originConflictResolution: CreateRepositoryOriginConflictResolution = this.overrideOrigin
      ? "replace"
      : "reject";

    if (originConflict && !this.overrideOrigin) {
      if (!isInteractiveTerminal(this.context)) {
        this.context.stderr.write(`${formatNonInteractiveConflictMessage(originConflict)}\n`);

        return 1;
      }

      const approved = await promptToReplaceOrigin(
        this.context.stdin,
        this.context.stdout,
        originConflict,
      );

      if (!approved) {
        this.context.stderr.write(`${formatConflictAbortMessage(originConflict)}\n`);

        return 1;
      }

      originConflictResolution = "replace";
    }

    const result = createRepository({
      machineName: this.machine,
      repositoryName: this.repositoryName,
      directory: this.directory,
      originConflictResolution,
    });

    this.context.stdout.write(
      `Created ugit repository ${result.repositoryName} on machine ${result.machineName}.\n`,
    );
    this.context.stdout.write(`origin -> ${result.originUrl}\n`);

    return 0;
  }
}

function isInteractiveTerminal(context: {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
}): boolean {
  return hasInteractiveTty(context.stdin) && hasInteractiveTty(context.stdout);
}

function hasInteractiveTty(stream: unknown): boolean {
  if (!stream || typeof stream !== "object" || !("isTTY" in stream)) {
    return false;
  }

  return (stream as { isTTY?: boolean }).isTTY === true;
}

async function promptToReplaceOrigin(
  stdin: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
  originConflict: CreateRepositoryOriginConflict,
): Promise<boolean> {
  const readline = createInterface({
    input: stdin,
    output: stdout,
    terminal: false,
  });

  try {
    const answer = await readline.question(
      `Local "origin" points to ${originConflict.existingOriginUrl}. Replace it with ${originConflict.originUrl}? [y/N] `,
    );

    return isAffirmativeAnswer(answer);
  } finally {
    readline.close();
  }
}

function isAffirmativeAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();

  return normalized === "y" || normalized === "yes";
}

function formatNonInteractiveConflictMessage(
  originConflict: CreateRepositoryOriginConflict,
): string {
  return `Repository ${originConflict.repositoryPath} already has an "origin" remote (${originConflict.existingOriginUrl}). Re-run ugit create with ${OVERRIDE_ORIGIN_FLAG} to replace it with ${originConflict.originUrl}.`;
}

function formatConflictAbortMessage(originConflict: CreateRepositoryOriginConflict): string {
  return `Aborted ugit create. Kept local "origin" at ${originConflict.existingOriginUrl}.`;
}
