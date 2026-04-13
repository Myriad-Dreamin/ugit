import { Command, Option } from "clipanion";
import { editPullRequest } from "../pr";
import { resolveConfiguredMachine } from "../machine";

export class PullRequestEditCommand extends Command {
  static paths = [["pr", "edit"]];

  static usage = Command.Usage({
    category: "Pull Request",
    description: "Edit the current branch's ugit pull request.",
    details:
      "Updates stored pull-request metadata without pushing. Changing the base branch also queues a fresh CI run against the new target branch.",
    examples: [
      ["Retitle the current branch pull request", 'ugit pr edit --title "Refine runner logs"'],
      ["Move the pull request out of draft", "ugit pr edit --ready"],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name. Falls back to the repository's ugit.machine value.",
    required: false,
  });

  baseBranch = Option.String("--base", {
    description: "Update the pull-request base branch and rerun CI against it.",
    required: false,
  });

  title = Option.String("--title", {
    description: "Update the pull-request title.",
    required: false,
  });

  body = Option.String("--body", {
    description: "Update the pull-request body. Pass an empty string to clear it.",
    required: false,
  });

  draft = Option.Boolean("--draft", false, {
    description: "Mark the pull request as a draft.",
  });

  ready = Option.Boolean("--ready", false, {
    description: "Mark the pull request as ready for review.",
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    if (this.draft && this.ready) {
      throw new Error("ugit pr edit accepts either --draft or --ready, but not both.");
    }

    const resolved = resolveConfiguredMachine({
      machineName: this.machine ?? undefined,
      directory: this.directory ?? undefined,
      requireRepository: true,
    });
    const draft = this.draft ? true : this.ready ? false : undefined;
    const result = await editPullRequest({
      machine: resolved.machine,
      repositoryPath: resolved.repositoryPath!,
      title: this.title ?? undefined,
      body: this.body,
      baseBranch: this.baseBranch ?? undefined,
      draft,
    });

    this.context.stdout.write(
      `Updated pull request #${result.pullRequest.id} for ${result.pullRequest.repositoryName}:${result.pullRequest.branchName} -> ${result.pullRequest.baseBranch}.\n`,
    );

    if (result.rerunQueued) {
      this.context.stdout.write(
        `Queued CI job ${result.jobId} (queue position ${result.queuePosition}).\n`,
      );
    } else {
      this.context.stdout.write("Metadata updated without queuing a new CI job.\n");
    }

    return 0;
  }
}
