import "server-only";

import { headers } from "next/headers";
import {
  buildRepositoryPullRequestPath,
  buildRepositoryPullRequestsPath,
} from "@/lib/pull-requests/rest-paths";

const DEFAULT_PULL_REQUEST_BOOTSTRAP_ORIGIN = "http://localhost";

type HeaderReader = Pick<Headers, "get">;

export async function buildPullRequestsBootstrapUrl(repositoryName: string): Promise<string> {
  const requestHeaders = await headers();

  return new URL(
    buildRepositoryPullRequestsPath(repositoryName),
    resolveRequestOrigin(requestHeaders),
  ).toString();
}

export async function buildPullRequestBootstrapUrl(
  repositoryName: string,
  pullRequestId: number | string,
): Promise<string> {
  const requestHeaders = await headers();

  return new URL(
    buildRepositoryPullRequestPath(repositoryName, pullRequestId),
    resolveRequestOrigin(requestHeaders),
  ).toString();
}

function resolveRequestOrigin(requestHeaders: HeaderReader): string {
  const host = resolveHost(requestHeaders);

  if (!host) {
    return DEFAULT_PULL_REQUEST_BOOTSTRAP_ORIGIN;
  }

  const protocol =
    normalizeProtocol(readLastHeaderValue(requestHeaders, "x-forwarded-proto")) ?? "http";

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return DEFAULT_PULL_REQUEST_BOOTSTRAP_ORIGIN;
  }
}

function resolveHost(requestHeaders: HeaderReader): string | null {
  return (
    normalizeHost(readLastHeaderValue(requestHeaders, "x-forwarded-host")) ??
    normalizeHost(readHostHeaderValue(requestHeaders))
  );
}

function readHostHeaderValue(requestHeaders: HeaderReader): string | null {
  const value = requestHeaders.get("host");

  return value?.trim() || null;
}

function normalizeHost(host: string | null): string | null {
  if (!host) {
    return null;
  }

  try {
    const normalizedUrl = new URL(`http://${host}`);

    if (
      normalizedUrl.username ||
      normalizedUrl.password ||
      normalizedUrl.pathname !== "/" ||
      normalizedUrl.search ||
      normalizedUrl.hash
    ) {
      return null;
    }

    return normalizedUrl.host;
  } catch {
    return null;
  }
}

function normalizeProtocol(protocol: string | null): string | null {
  if (!protocol) {
    return null;
  }

  const normalizedProtocol = protocol.toLowerCase();

  if (normalizedProtocol === "http" || normalizedProtocol === "https") {
    return normalizedProtocol;
  }

  return null;
}

function readLastHeaderValue(requestHeaders: HeaderReader, headerName: string): string | null {
  const value = requestHeaders.get(headerName);

  if (!value) {
    return null;
  }

  const forwardedValues = value
    .split(",")
    .map((forwardedValue) => forwardedValue.trim())
    .filter(Boolean);

  return forwardedValues.at(-1) ?? null;
}
