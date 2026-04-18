import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type WorkflowPackage = Readonly<{
  directoryPath: string;
  name: string;
  packageJsonPath: string;
}>;

export type ResolveWorkflowPackagesResult = Readonly<{
  failureMessage?: string;
  workflows: readonly WorkflowPackage[];
}>;

export type WorkflowExecutionPlan = Readonly<{
  installArgs: readonly string[];
  installCommand: string;
  runArgs: readonly string[];
  runCommand: string;
  workflow: WorkflowPackage;
}>;

type WorkflowPackageJson = {
  scripts?: Record<string, unknown>;
};

export const WORKFLOW_SCRIPT_NAME = "ugit:ci";

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

export function resolveWorkflowPackages(
  repositoryPath: string,
  options: Readonly<{
    workflowName?: string;
  }> = {},
): ResolveWorkflowPackagesResult {
  const workflows = selectWorkflowPackages(
    discoverWorkflowPackages(repositoryPath),
    options.workflowName,
  );

  if (workflows.length > 0) {
    return { workflows };
  }

  return {
    workflows: [],
    failureMessage: createMissingWorkflowMessage(options.workflowName),
  };
}

export function buildWorkflowExecutionPlan(workflow: WorkflowPackage): WorkflowExecutionPlan {
  if (!existsSync(workflow.packageJsonPath)) {
    throw new Error(`Workflow ${workflow.name} is missing package.json.`);
  }

  const packageJson = readWorkflowPackageJson(workflow.packageJsonPath, workflow.name);
  const workflowScript = packageJson.scripts?.[WORKFLOW_SCRIPT_NAME];

  if (typeof workflowScript !== "string" || workflowScript.length === 0) {
    throw new Error(`Workflow ${workflow.name} must define a "${WORKFLOW_SCRIPT_NAME}" script.`);
  }

  const installArgs = [
    "install",
    "--dir",
    workflow.directoryPath,
    "--ignore-workspace",
    "--no-frozen-lockfile",
  ] as const;
  const runArgs = ["--dir", workflow.directoryPath, "run", WORKFLOW_SCRIPT_NAME] as const;

  return {
    workflow,
    installArgs,
    installCommand: formatCommand("pnpm", installArgs),
    runArgs,
    runCommand: formatCommand("pnpm", runArgs),
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
  workflowName?: string,
): readonly WorkflowPackage[] {
  if (!workflowName) {
    return workflows;
  }

  return workflows.filter((workflow) => workflow.name === workflowName);
}

function createMissingWorkflowMessage(workflowName?: string): string {
  return workflowName
    ? `Workflow ${workflowName} was not found under .ugit/workflows.`
    : "No workflow packages were found under .ugit/workflows.";
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}
