import { Command, Option } from "clipanion";
import { resolveConfiguredMachine } from "../machine";
import { streamWorkflowLogs } from "../workflow";

export class WorkflowLogsCommand extends Command {
  static paths = [["workflow", "logs"]];

  static usage = Command.Usage({
    category: "Workflow",
    description: "Stream one queued workflow run's live logs over HTTP-over-SSH.",
    details:
      "Connects to the ugit server through the same temporary SSH tunnel transport as other ugit commands and streams log output until the workflow run finishes.",
    examples: [
      ["Stream the logs for a workflow run", "ugit workflow logs workflow-123"],
      [
        "Read logs outside a repository by selecting the machine explicitly",
        "ugit workflow logs -m machine-x workflow-123",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description:
      "Configured ugit machine name. Falls back to the repository's ugit.machine value when available.",
    required: false,
  });

  port = Option.String("-p,--port", {
    description:
      "Optional local port used for the temporary SSH tunnel. Defaults to an ephemeral port for remote machines.",
    required: false,
  });

  workflowId = Option.String({
    name: "workflowId",
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    const resolved = resolveConfiguredMachine({
      machineName: this.machine ?? undefined,
      directory: this.directory ?? undefined,
    });
    const localPort = this.port ? Number.parseInt(this.port, 10) : undefined;

    if (this.port && (!Number.isInteger(localPort) || Number(localPort) <= 0)) {
      throw new Error(`Invalid local port "${this.port}". Expected a positive integer.`);
    }

    await streamWorkflowLogs({
      machine: resolved.machine,
      workflowId: this.workflowId,
      localPort,
      writer: this.context.stdout,
    });

    return 0;
  }
}
