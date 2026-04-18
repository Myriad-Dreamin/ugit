import path from "node:path";
import { Command, Option } from "clipanion";
import { resolveRepositoryRoot, runLocalCommand } from "../git";
import { resolveConfiguredMachine } from "../machine";
import { queueWorkflowRun, runLocalWorkflow } from "../workflow";

export class WorkflowRunCommand extends Command {
  static paths = [["workflow", "run"]];

  static usage = Command.Usage({
    category: "Workflow",
    description: "Queue one remote workflow run, or debug one locally with --local.",
    details:
      "Without --local, pushes the current branch to the ugit origin, then queues one named workflow on the remote server over HTTP-over-SSH. Pass --local to run the named .ugit/workflows/<workflow> package directly against the current repository working tree in the foreground. Local runs stream directly to the terminal, may mutate workflow package dependency state, and do not produce a workflowId for ugit workflow logs.",
    examples: [
      [
        "Debug the lint workflow locally against the current working tree",
        "ugit workflow run --local lint .",
      ],
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

  local = Option.Boolean("--local", false, {
    description:
      "Run the named workflow package locally in the foreground against the current working tree. Incompatible with --machine and --port.",
  });

  workflowName = Option.String({
    name: "workflow",
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    if (this.local) {
      if (this.machine || this.port) {
        this.context.stderr.write(
          "The --machine and --port flags are only available for remote queued workflow runs. Remove them when using --local.\n",
        );

        return 1;
      }

      const repositoryPath = resolveRepositoryRoot(
        path.resolve(this.directory ?? "."),
        runLocalCommand,
      );

      return await runLocalWorkflow({
        repositoryPath,
        workflowName: this.workflowName,
        stdout: this.context.stdout,
      });
    }

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
