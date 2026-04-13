import { synchronizePullRequest } from "@/lib/pr-runner/service";
import { PullRequestSyncError } from "@/lib/pr-runner/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
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
    const response = synchronizePullRequest(payload);

    return Response.json(response, {
      status: 202,
    });
  } catch (error) {
    if (error instanceof PullRequestSyncError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected pull-request synchronization failure.",
      },
      { status: 500 },
    );
  }
}
