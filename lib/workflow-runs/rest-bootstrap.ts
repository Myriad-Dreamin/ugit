import "server-only";

import { headers } from "next/headers";

const DEFAULT_WORKFLOW_BOOTSTRAP_ORIGIN = "http://localhost";

type HeaderReader = Pick<Headers, "get">;

export async function buildWorkflowRunsBootstrapUrl(repositoryName: string): Promise<string> {
  const requestHeaders = await headers();
  const url = new URL("/api/workflows/runs", resolveRequestOrigin(requestHeaders));

  url.searchParams.set("repositoryName", repositoryName);

  return url.toString();
}

function resolveRequestOrigin(requestHeaders: HeaderReader): string {
  const host =
    readFirstHeaderValue(requestHeaders, "x-forwarded-host") ??
    readFirstHeaderValue(requestHeaders, "host");

  if (!host) {
    return DEFAULT_WORKFLOW_BOOTSTRAP_ORIGIN;
  }

  const protocol = readFirstHeaderValue(requestHeaders, "x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

function readFirstHeaderValue(requestHeaders: HeaderReader, headerName: string): string | null {
  const value = requestHeaders.get(headerName);

  if (!value) {
    return null;
  }

  const [firstValue] = value.split(",");

  return firstValue?.trim() || null;
}
