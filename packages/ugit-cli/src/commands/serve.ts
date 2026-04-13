import { Command, Option } from "clipanion";
import { parsePort, serveMachine } from "../serve";

export class ServeCommand extends Command {
  static paths = [["serve"]];

  static usage = Command.Usage({
    category: "Server",
    description: "Start an SSH local port forward to a configured ugit machine.",
    details:
      "Resolves the selected machine from the ugit config, forwards the remote ugit server port to 127.0.0.1 on the current machine, and keeps the SSH tunnel attached until interrupted.",
    examples: [
      ["Forward the machine serverPort to the same local port", "ugit serve -m machine-x"],
      [
        "Forward the machine serverPort to a different local port",
        "ugit serve -m machine-x -p 4301",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name.",
    required: true,
  });

  port = Option.String("-p,--port", {
    description: "Local port to bind. Defaults to the configured serverPort.",
    required: false,
  });

  async execute(): Promise<number> {
    try {
      await serveMachine({
        machineName: this.machine,
        localPort: this.port === undefined ? undefined : parsePort(this.port, "Local port"),
        stdout: this.context.stdout,
      });

      return 0;
    } catch (error) {
      this.context.stderr.write(`Error: ${formatErrorMessage(error)}\n`);

      return 1;
    }
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
