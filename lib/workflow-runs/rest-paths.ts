export function buildRepositoryWorkflowRunsPath(repositoryName: string): string {
  const searchParams = new URLSearchParams({
    repositoryName,
  });

  return `/api/workflows/runs?${searchParams.toString()}`;
}
