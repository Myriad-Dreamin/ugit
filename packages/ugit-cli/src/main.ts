#!/usr/bin/env node

import { Cli } from "clipanion";
import { createCli } from "./cli";

async function main(): Promise<void> {
  await createCli().runExit(process.argv.slice(2), Cli.defaultContext);
}

void main();
