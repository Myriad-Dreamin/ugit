import "server-only";

import {
  buildWorkflowExecutionPlan,
  resolveWorkflowPackages,
  WORKFLOW_SCRIPT_NAME,
} from "@/packages/ugit-cli/src/workflow-package";
import { combineCommandOutput, runAsyncCommand, type AsyncCommandRunner } from "./process";

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

export async function executeWorkflowPackages(
  repositoryPath: string,
  runCommand: AsyncCommandRunner = runAsyncCommand,
  options: WorkflowExecutionOptions = {},
): Promise<WorkflowExecutionSummary> {
  const workflowSelection = resolveWorkflowPackages(repositoryPath, {
    workflowName: options.workflowName,
  });

  if (workflowSelection.workflows.length === 0) {
    const failureMessage =
      workflowSelection.failureMessage ?? "No workflow packages were found under .ugit/workflows.";

    emitWorkflowOutput(options, `${failureMessage}\n`, "stderr");

    return {
      success: false,
      failureMessage,
      workflows: [],
    };
  }

  const results: WorkflowExecutionResult[] = [];

  for (const workflow of workflowSelection.workflows) {
    let executionPlan;

    try {
      executionPlan = buildWorkflowExecutionPlan(workflow);
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : `Failed to prepare workflow ${workflow.name}.`;

      emitWorkflowOutput(options, `${failureMessage}\n`, "stderr");

      return {
        success: false,
        failureMessage,
        workflows: results,
      };
    }

    emitWorkflowOutput(
      options,
      `==> ${workflow.name}: install\n$ ${executionPlan.installCommand}\n`,
    );

    const installResult = await runCommand("pnpm", executionPlan.installArgs, {
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
        installCommand: executionPlan.installCommand,
        output: combineCommandOutput(installResult),
      });

      return {
        success: false,
        failureMessage: `Workflow ${workflow.name} failed while installing dependencies.`,
        workflows: results,
      };
    }

    emitWorkflowOutput(options, `==> ${workflow.name}: run\n$ ${executionPlan.runCommand}\n`);

    const runResult = await runCommand("pnpm", executionPlan.runArgs, {
      cwd: repositoryPath,
      onOutput: (chunk, stream) => emitWorkflowOutput(options, chunk, stream),
    });

    results.push({
      name: workflow.name,
      status: runResult.exitCode === 0 ? "passed" : "failed",
      installCommand: executionPlan.installCommand,
      runCommand: executionPlan.runCommand,
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

function emitWorkflowOutput(
  options: WorkflowExecutionOptions,
  chunk: string,
  stream: "stdout" | "stderr" = "stdout",
): void {
  options.onOutput?.(chunk, stream);
}
