import { Command, Option } from "clipanion";
import { synchronizePullRequest } from "../pr";
import { resolveConfiguredMachine } from "../machine";

export class PullRequestSyncCommand extends Command {
  static paths = [["pr", "sync"]];

  static usage = Command.Usage({
    category: "Pull Request",
    description: "Publish the current branch and synchronize its ugit pull-request record.",
    details:
      "Pushes the current branch to the ugit origin, opens an HTTP-over-SSH connection to the remote ugit server, and queues CI for the synchronized pull request.",
    examples: [
      [
        "Publish the current branch and queue CI against main",
        'ugit pr sync --base main --title "Add the runner" --body "Implements the first PR runner slice."',
      ],
      [
        "Override the inferred target machine",
        'ugit pr sync -m machine-x --base release --title "Cherry-pick fix" --body ""',
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name. Falls back to the repository's ugit.machine value.",
    required: false,
  });

  baseBranch = Option.String("--base", {
    description: "Base branch to validate and fast-forward merge into.",
    required: true,
  });

  title = Option.String("--title", {
    description: "Pull-request title recorded by the ugit server.",
    required: true,
  });

  body = Option.String("--body", "", {
    description: "Pull-request body recorded by the ugit server.",
  });

  draft = Option.Boolean("--draft", false, {
    description: "Mark the synchronized pull request as a draft.",
  });

  port = Option.String("-p,--port", {
    description:
      "Optional local port used for the temporary SSH tunnel. Defaults to an ephemeral port for remote machines.",
    required: false,
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    const resolved = resolveConfiguredMachine({
      machineName: this.machine ?? undefined,
      directory: this.directory ?? undefined,
      requireRepository: true,
    });
    const localPort = this.port ? Number.parseInt(this.port, 10) : undefined;

    if (this.port && (!Number.isInteger(localPort) || Number(localPort) <= 0)) {
      throw new Error(`Invalid local port "${this.port}". Expected a positive integer.`);
    }

    const result = await synchronizePullRequest({
      machine: resolved.machine,
      repositoryPath: resolved.repositoryPath!,
      baseBranch: this.baseBranch,
      title: this.title,
      body: this.body,
      draft: this.draft,
      localPort,
    });

    this.context.stdout.write(
      `Synchronized ${result.response.repositoryName}:${result.response.branchName} -> ${result.response.baseBranch}.\n`,
    );
    this.context.stdout.write(
      `CI job ${result.response.jobId} is ${result.response.status} (queue position ${result.response.queuePosition}).\n`,
    );

    return 0;
  }
}
