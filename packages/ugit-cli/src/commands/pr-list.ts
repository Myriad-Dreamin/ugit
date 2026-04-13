import { Command, Option } from "clipanion";
import { formatPullRequestTable, listPullRequests } from "../pr";
import { resolveConfiguredMachine } from "../machine";
import type { PullRequestListState } from "../pull-request-contract";

const VALID_STATES = new Set<PullRequestListState>(["open", "merged", "all"]);

export class PullRequestListCommand extends Command {
  static paths = [["pr", "list"]];

  static usage = Command.Usage({
    category: "Pull Request",
    description: "List ugit pull requests for the current repository.",
    details:
      "Queries the ugit server over HTTP-over-SSH and prints a repository-scoped pull-request table with the latest CI job state.",
    examples: [
      ["List open pull requests for the current repository", "ugit pr list"],
      [
        "Show merged pull requests that targeted release",
        "ugit pr list --state merged --base release",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name. Falls back to the repository's ugit.machine value.",
    required: false,
  });

  state = Option.String("--state", "open", {
    description: "Pull-request state filter: open, merged, or all.",
  });

  baseBranch = Option.String("--base", {
    description: "Only show pull requests targeting this base branch.",
    required: false,
  });

  headBranch = Option.String("--head", {
    description: "Only show pull requests from this head branch.",
    required: false,
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    if (!VALID_STATES.has(this.state as PullRequestListState)) {
      throw new Error(`Invalid --state value "${this.state}". Expected one of: open, merged, all.`);
    }

    const resolved = resolveConfiguredMachine({
      machineName: this.machine ?? undefined,
      directory: this.directory ?? undefined,
      requireRepository: true,
    });
    const result = await listPullRequests({
      machine: resolved.machine,
      repositoryPath: resolved.repositoryPath!,
      state: this.state as PullRequestListState,
      baseBranch: this.baseBranch ?? undefined,
      headBranch: this.headBranch ?? undefined,
    });

    if (result.pullRequests.length === 0) {
      this.context.stdout.write(`No pull requests found in ${result.repositoryName}.\n`);
      return 0;
    }

    this.context.stdout.write(`Pull requests for ${result.repositoryName}:\n`);
    this.context.stdout.write(`${formatPullRequestTable(result.pullRequests)}\n`);

    return 0;
  }
}
