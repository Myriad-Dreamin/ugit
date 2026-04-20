export function buildRepositoryPullRequestsPath(repositoryName: string): string {
  const searchParams = new URLSearchParams({
    repositoryName,
  });

  return `/api/pull-requests?${searchParams.toString()}`;
}

export function buildRepositoryPullRequestPath(
  repositoryName: string,
  pullRequestId: number | string,
): string {
  const searchParams = new URLSearchParams({
    repositoryName,
  });

  return `/api/pull-requests/${encodeURIComponent(String(pullRequestId))}?${searchParams.toString()}`;
}

export function buildRepositoryPullRequestMergePath(
  repositoryName: string,
  pullRequestId: number | string,
): string {
  const searchParams = new URLSearchParams({
    repositoryName,
  });

  return `/api/pull-requests/${encodeURIComponent(String(pullRequestId))}/merge?${searchParams.toString()}`;
}
