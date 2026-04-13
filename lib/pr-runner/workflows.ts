import "server-only";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  combineCommandOutput,
  formatCommand,
  runAsyncCommand,
  type AsyncCommandRunner,
} from "./process";

export type WorkflowPackage = Readonly<{
  directoryPath: string;
  name: string;
  packageJsonPath: string;
}>;

export type WorkflowExecutionResult = Readonly<{
  installCommand: string;
  name: string;
  output: string;
  runCommand?: string;
  status: "passed" | "failed";
}>;

export type WorkflowExecutionSummary = Readonly<{
  failureMessage?: string;
  success: boolean;
  workflows: readonly WorkflowExecutionResult[];
}>;

export type WorkflowExecutionOptions = Readonly<{
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
  workflowName?: string;
}>;

type WorkflowPackageJson = {
  scripts?: Record<string, unknown>;
};

const WORKFLOW_SCRIPT_NAME = "ugit:ci";

export function discoverWorkflowPackages(repositoryPath: string): readonly WorkflowPackage[] {
  const workflowsRoot = path.join(repositoryPath, ".ugit", "workflows");

  if (!existsSync(workflowsRoot)) {
    return [];
  }

  return readdirSync(workflowsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      directoryPath: path.join(workflowsRoot, entry.name),
      name: entry.name,
      packageJsonPath: path.join(workflowsRoot, entry.name, "package.json"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function executeWorkflowPackages(
  repositoryPath: string,
  runCommand: AsyncCommandRunner = runAsyncCommand,
  options: WorkflowExecutionOptions = {},
): Promise<WorkflowExecutionSummary> {
  const workflows = selectWorkflowPackages(discoverWorkflowPackages(repositoryPath), options);

  if (workflows.length === 0) {
    const failureMessage = options.workflowName
      ? `Workflow ${options.workflowName} was not found under .ugit/workflows.`
      : "No workflow packages were found under .ugit/workflows.";

    emitWorkflowOutput(options, `${failureMessage}\n`, "stderr");

    return {
      success: false,
      failureMessage,
      workflows: [],
    };
  }

  const results: WorkflowExecutionResult[] = [];

  for (const workflow of workflows) {
    if (!existsSync(workflow.packageJsonPath)) {
      emitWorkflowOutput(options, `Workflow ${workflow.name} is missing package.json.\n`, "stderr");

      return {
        success: false,
        failureMessage: `Workflow ${workflow.name} is missing package.json.`,
        workflows: results,
      };
    }

    const packageJson = readWorkflowPackageJson(workflow.packageJsonPath, workflow.name);
    const workflowScript = packageJson.scripts?.[WORKFLOW_SCRIPT_NAME];

    if (typeof workflowScript !== "string" || workflowScript.length === 0) {
      emitWorkflowOutput(
        options,
        `Workflow ${workflow.name} must define a "${WORKFLOW_SCRIPT_NAME}" script.\n`,
        "stderr",
      );

      return {
        success: false,
        failureMessage: `Workflow ${workflow.name} must define a "${WORKFLOW_SCRIPT_NAME}" script.`,
        workflows: results,
      };
    }

    const installArgs = [
      "install",
      "--dir",
      workflow.directoryPath,
      "--ignore-workspace",
      "--no-frozen-lockfile",
    ] as const;
    const installCommand = formatCommand("pnpm", installArgs);

    emitWorkflowOutput(options, `==> ${workflow.name}: install\n$ ${installCommand}\n`);

    const installResult = await runCommand("pnpm", installArgs, {
      cwd: repositoryPath,
      onOutput: (chunk, stream) => emitWorkflowOutput(options, chunk, stream),
    });

    if (installResult.exitCode !== 0) {
      emitWorkflowOutput(
        options,
        `Workflow ${workflow.name} failed while installing dependencies.\n`,
        "stderr",
      );

      results.push({
        name: workflow.name,
        status: "failed",
        installCommand,
        output: combineCommandOutput(installResult),
      });

      return {
        success: false,
        failureMessage: `Workflow ${workflow.name} failed while installing dependencies.`,
        workflows: results,
      };
    }

    const runArgs = ["--dir", workflow.directoryPath, "run", WORKFLOW_SCRIPT_NAME] as const;
    const runCommandText = formatCommand("pnpm", runArgs);

    emitWorkflowOutput(options, `==> ${workflow.name}: run\n$ ${runCommandText}\n`);

    const runResult = await runCommand("pnpm", runArgs, {
      cwd: repositoryPath,
      onOutput: (chunk, stream) => emitWorkflowOutput(options, chunk, stream),
    });

    results.push({
      name: workflow.name,
      status: runResult.exitCode === 0 ? "passed" : "failed",
      installCommand,
      runCommand: runCommandText,
      output: [combineCommandOutput(installResult), combineCommandOutput(runResult)]
        .filter(Boolean)
        .join("\n"),
    });

    if (runResult.exitCode !== 0) {
      emitWorkflowOutput(
        options,
        `Workflow ${workflow.name} failed while running ${WORKFLOW_SCRIPT_NAME}.\n`,
        "stderr",
      );

      return {
        success: false,
        failureMessage: `Workflow ${workflow.name} failed while running ${WORKFLOW_SCRIPT_NAME}.`,
        workflows: results,
      };
    }
  }

  return {
    success: true,
    workflows: results,
  };
}

function readWorkflowPackageJson(
  packageJsonPath: string,
  workflowName: string,
): WorkflowPackageJson {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as WorkflowPackageJson;
  } catch (error) {
    throw new Error(`Failed to read workflow package.json for ${workflowName}.`, { cause: error });
  }
}

function selectWorkflowPackages(
  workflows: readonly WorkflowPackage[],
  options: WorkflowExecutionOptions,
): readonly WorkflowPackage[] {
  if (!options.workflowName) {
    return workflows;
  }

  return workflows.filter((workflow) => workflow.name === options.workflowName);
}

function emitWorkflowOutput(
  options: WorkflowExecutionOptions,
  chunk: string,
  stream: "stdout" | "stderr" = "stdout",
): void {
  options.onOutput?.(chunk, stream);
}
