export const configuredOwner = {
  username: "Myriad-Dreamin",
} as const;

export function isConfiguredOwner(username: string): boolean {
  return username === configuredOwner.username;
}

export function getRepositoryHref(repositoryName: string): string {
  return `/${configuredOwner.username}/${encodeURIComponent(repositoryName)}`;
}

export function getRepositoryWorkflowsHref(repositoryName: string): string {
  return `${getRepositoryHref(repositoryName)}/workflows`;
}

export function getRepositoryPullRequestsHref(repositoryName: string): string {
  return `${getRepositoryHref(repositoryName)}/pull-requests`;
}

export function getWorkflowRunHref(repositoryName: string, workflowId: string): string {
  return `${getRepositoryWorkflowsHref(repositoryName)}/${encodeURIComponent(workflowId)}`;
}

export function getPullRequestHref(repositoryName: string, pullRequestId: number | string): string {
  return `${getRepositoryPullRequestsHref(repositoryName)}/${encodeURIComponent(String(pullRequestId))}`;
}
