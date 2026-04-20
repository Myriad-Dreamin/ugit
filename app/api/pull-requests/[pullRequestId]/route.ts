import { getRepositoryPullRequest } from "@/lib/pr-runner/service";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

export const dynamic = "force-dynamic";

type PullRequestRouteContext = Readonly<{
  params:
    | Promise<{
        pullRequestId: string;
      }>
    | {
        pullRequestId: string;
      };
}>;

export async function GET(request: Request, context: PullRequestRouteContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { pullRequestId } = await Promise.resolve(context.params);
    const response = getRepositoryPullRequest({
      repositoryName: url.searchParams.get("repositoryName"),
      pullRequestId,
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
        error: error instanceof Error ? error.message : "Unexpected pull-request read failure.",
      },
      { status: 500 },
    );
  }
}
