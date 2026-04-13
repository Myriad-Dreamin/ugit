import "server-only";

import { spawn } from "node:child_process";

export type CommandExecutionOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}>;

export type CommandExecutionResult = Readonly<{
  exitCode: number;
  stderr: string;
  stdout: string;
}>;

export type AsyncCommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandExecutionOptions,
) => Promise<CommandExecutionResult>;

export async function runAsyncCommand(
  command: string,
  args: readonly string[],
  options: CommandExecutionOptions = {},
): Promise<CommandExecutionResult> {
  return await new Promise<CommandExecutionResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    child.once("error", (error) => {
      reject(new Error(`Failed to start ${formatCommand(command, args)}.`, { cause: error }));
    });
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: Buffer.concat(stderrChunks).toString("utf8").trim(),
        stdout: Buffer.concat(stdoutChunks).toString("utf8").trim(),
      });
    });
  });
}

export function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

export function combineCommandOutput(
  result: Pick<CommandExecutionResult, "stdout" | "stderr">,
): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}
