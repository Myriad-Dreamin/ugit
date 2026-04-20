import {
  editPullRequest,
  listPullRequests,
  listRepositoryPullRequests,
} from "@/lib/pr-runner/service";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const repositoryName = url.searchParams.get("repositoryName");
    const response = repositoryName
      ? listRepositoryPullRequests({
          repositoryName,
          state: url.searchParams.get("state"),
          baseBranch: url.searchParams.get("baseBranch"),
          headBranch: url.searchParams.get("headBranch"),
        })
      : listPullRequests({
          repositoryPath: url.searchParams.get("repositoryPath"),
          state: url.searchParams.get("state"),
          baseBranch: url.searchParams.get("baseBranch"),
          headBranch: url.searchParams.get("headBranch"),
        });

    return Response.json(response, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PullRequestRequestError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected pull-request query failure.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  try {
    const response = editPullRequest(payload);

    return Response.json(response);
  } catch (error) {
    if (error instanceof PullRequestRequestError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected pull-request edit failure.",
      },
      { status: 500 },
    );
  }
}
