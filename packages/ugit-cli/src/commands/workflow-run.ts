import { Command, Option } from "clipanion";
import { resolveConfiguredMachine } from "../machine";
import { queueWorkflowRun } from "../workflow";

export class WorkflowRunCommand extends Command {
  static paths = [["workflow", "run"]];

  static usage = Command.Usage({
    category: "Workflow",
    description: "Queue one ugit workflow run from the current branch.",
    details:
      "Pushes the current branch to the ugit origin, then queues one named workflow on the remote server over HTTP-over-SSH. Manual workflow runs share the same CI capacity limits as pull-request jobs but never auto-merge.",
    examples: [
      ["Queue the lint workflow for the current branch", "ugit workflow run lint"],
      [
        "Run a workflow on another machine using a fixed tunnel port",
        "ugit workflow run -m machine-x -p 4301 release-check .",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name. Falls back to the repository's ugit.machine value.",
    required: false,
  });

  port = Option.String("-p,--port", {
    description:
      "Optional local port used for the temporary SSH tunnel. Defaults to an ephemeral port for remote machines.",
    required: false,
  });

  workflowName = Option.String({
    name: "workflow",
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

    const result = await queueWorkflowRun({
      machine: resolved.machine,
      repositoryPath: resolved.repositoryPath!,
      workflowName: this.workflowName,
      localPort,
    });

    this.context.stdout.write(
      `Queued workflow ${result.response.workflowId} for ${result.response.repositoryName}:${result.response.branchName} (${result.response.workflowName} @ ${result.response.commitHash}).\n`,
    );
    this.context.stdout.write(
      `Workflow ${result.response.workflowId} is ${result.response.status} (queue position ${result.response.queuePosition}).\n`,
    );

    return 0;
  }
}
