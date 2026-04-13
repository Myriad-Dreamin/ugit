import { Command, Option } from "clipanion";
import { createPullRequest } from "../pr";
import { resolveConfiguredMachine } from "../machine";

export class PullRequestCreateCommand extends Command {
  static paths = [["pr", "create"]];

  static usage = Command.Usage({
    category: "Pull Request",
    description: "Create a new ugit pull request from the current branch.",
    details:
      "Rejects duplicate pull requests for the current branch, then pushes to the ugit origin, records pull-request metadata, and queues CI on the remote server.",
    examples: [
      [
        "Create a pull request against main",
        'ugit pr create --base main --title "Add the runner" --body "Implements the first PR runner slice."',
      ],
      [
        "Create a draft pull request on another machine",
        'ugit pr create -m machine-x --base release --title "Cherry-pick fix" --draft',
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
    description: "Mark the new pull request as a draft.",
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
    const result = await createPullRequest({
      machine: resolved.machine,
      repositoryPath: resolved.repositoryPath!,
      baseBranch: this.baseBranch,
      title: this.title,
      body: this.body,
      draft: this.draft,
    });

    this.context.stdout.write(
      `Created pull request #${result.response.pullRequestId} for ${result.response.repositoryName}:${result.response.branchName} -> ${result.response.baseBranch}.\n`,
    );
    this.context.stdout.write(
      `CI job ${result.response.jobId} is ${result.response.status} (queue position ${result.response.queuePosition}).\n`,
    );

    return 0;
  }
}
