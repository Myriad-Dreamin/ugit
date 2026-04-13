export const configuredOwner = {
  username: "Myriad-Dreamin",
} as const;

export function isConfiguredOwner(username: string): boolean {
  return username === configuredOwner.username;
}

export function getRepositoryHref(repositoryName: string): string {
  return `/${configuredOwner.username}/${encodeURIComponent(repositoryName)}`;
}
