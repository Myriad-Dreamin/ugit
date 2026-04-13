import { Builtins, Cli } from "clipanion";
import packageJson from "../package.json";
import { CreateCommand } from "./commands/create";
import { ServeCommand } from "./commands/serve";

export function createCli(): Cli {
  const cli = new Cli({
    binaryLabel: "ugit",
    binaryName: "ugit",
    binaryVersion: packageJson.version,
  });

  cli.register(CreateCommand);
  cli.register(ServeCommand);
  cli.register(Builtins.HelpCommand);
  cli.register(Builtins.VersionCommand);

  return cli;
}
