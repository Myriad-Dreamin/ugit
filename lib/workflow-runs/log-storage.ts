import "server-only";

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const WORKFLOW_RUN_LOGS_ROOT = path.join(".data", "workflow-run-logs");

export function getWorkflowRunLogPath(
  workflowId: string,
  repositoryName: string,
  cwd: string = process.cwd(),
): string {
  return path.resolve(cwd, WORKFLOW_RUN_LOGS_ROOT, repositoryName, `${workflowId}.log`);
}

export function ensureWorkflowRunLogFile(logPath: string): void {
  mkdirSync(path.dirname(logPath), { recursive: true });

  if (!existsSync(logPath)) {
    writeFileSync(logPath, "", "utf8");
  }
}

export function appendWorkflowRunLog(logPath: string, content: string): void {
  ensureWorkflowRunLogFile(logPath);
  appendFileSync(logPath, content, "utf8");
}

export function readWorkflowRunLogChunk(
  logPath: string,
  offset: number,
): Readonly<{
  nextOffset: number;
  text: string;
}> {
  if (!existsSync(logPath)) {
    return {
      nextOffset: offset,
      text: "",
    };
  }

  const fileSize = statSync(logPath).size;

  if (fileSize <= offset) {
    return {
      nextOffset: offset,
      text: "",
    };
  }

  const fileHandle = openSync(logPath, "r");
  const bytesToRead = fileSize - offset;
  const buffer = Buffer.alloc(bytesToRead);

  try {
    readSync(fileHandle, buffer, 0, bytesToRead, offset);
  } finally {
    closeSync(fileHandle);
  }

  return {
    nextOffset: fileSize,
    text: buffer.toString("utf8"),
  };
}
