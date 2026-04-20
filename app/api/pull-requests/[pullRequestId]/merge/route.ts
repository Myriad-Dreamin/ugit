import { mergeRepositoryPullRequest } from "@/lib/pr-runner/service";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

export const dynamic = "force-dynamic";

type PullRequestMergeRouteContext = Readonly<{
  params:
    | Promise<{
        pullRequestId: string;
      }>
    | {
        pullRequestId: string;
      };
}>;

export async function POST(
  request: Request,
  context: PullRequestMergeRouteContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { pullRequestId } = await Promise.resolve(context.params);
    const response = await mergeRepositoryPullRequest({
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
        error: error instanceof Error ? error.message : "Unexpected pull-request merge failure.",
      },
      { status: 500 },
    );
  }
}
