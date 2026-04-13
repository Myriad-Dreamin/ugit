import { Command, Option } from "clipanion";
import { createRepository } from "../create";

export class CreateCommand extends Command {
  static paths = [["create"]];

  static usage = Command.Usage({
    category: "Repository",
    description: "Create a ugit-backed repository on a configured machine.",
    details:
      "Initializes a working-tree Git repository on the selected ugit machine, copies the local upstream remote there, and records the machine in local Git config.",
    examples: [
      ["Create a ugit repository in the current directory", "ugit create -m machine-x"],
      [
        "Create a ugit repository for another local checkout",
        "ugit create -m local ../example-repo",
      ],
    ],
  });

  machine = Option.String("-m,--machine", {
    description: "Configured ugit machine name.",
    required: true,
  });

  directory = Option.String({
    name: "directory",
    required: false,
  });

  async execute(): Promise<number> {
    const result = createRepository({
      machineName: this.machine,
      directory: this.directory,
    });

    this.context.stdout.write(
      `Created ugit repository ${result.repositoryName} on machine ${result.machineName}.\n`,
    );
    this.context.stdout.write(`origin -> ${result.originUrl}\n`);

    return 0;
  }
}
