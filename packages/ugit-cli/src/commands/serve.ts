import { spawn } from "node:child_process";
import { once } from "node:events";
import { Command, Option } from "clipanion";
import { resolveConfiguredMachine } from "../machine";
import { buildMachineServerUrl, buildSshPortForwardArgs } from "../transport";

export class ServeCommand extends Command {
  static paths = [["serve"]];

  static usage = Command.Usage({
    category: "Server",
    description: "Expose a configured ugit server over a local port.",
    details:
      "For remote machines, opens an SSH local port forward to the machine's Next.js server. Local machines short-circuit and print the configured local URL directly.",
    examples: [
      ["Forward a remote ugit server onto the same local port", "ugit serve -m machine-x"],
      ["Infer the ugit machine from the current repository", "ugit serve --port 3301"],
    ],
  });

  machine = Option.String("-m,--machine", {
    description:
      "Configured ugit machine name. Falls back to the current repository's ugit.machine value.",
    required: false,
  });

  port = Option.String("-p,--port", {
    description:
      "Local port used for the forwarded server. Defaults to the configured machine serverPort.",
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
    });
    const requestedPort = this.port ? Number.parseInt(this.port, 10) : resolved.machine.serverPort;

    if (!Number.isInteger(requestedPort) || requestedPort <= 0) {
      throw new Error(`Invalid local port "${this.port}". Expected a positive integer.`);
    }

    if (resolved.machine.isLocal) {
      const directUrl = buildMachineServerUrl(resolved.machine.serverPort);

      this.context.stdout.write(
        `Machine ${resolved.machine.name} is local. Server already available at ${directUrl}.\n`,
      );

      if (requestedPort !== resolved.machine.serverPort) {
        this.context.stdout.write(
          `Ignoring requested local port ${requestedPort}; local machines do not need SSH port forwarding.\n`,
        );
      }

      return 0;
    }

    const localUrl = buildMachineServerUrl(requestedPort);

    this.context.stdout.write(
      `Forwarding ${resolved.machine.name} (${resolved.machine.sshMachine}:${resolved.machine.serverPort}) to ${localUrl}.\n`,
    );

    const child = spawn("ssh", buildSshPortForwardArgs(resolved.machine, requestedPort), {
      stdio: "inherit",
    });
    const [exitCode, signal] = (await once(child, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];

    if (exitCode !== 0) {
      throw new Error(
        `ugit serve failed${signal ? ` with signal ${signal}` : ` with exit code ${exitCode}`}.`,
      );
    }

    return 0;
  }
}
