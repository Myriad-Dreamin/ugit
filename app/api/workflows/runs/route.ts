import { listWorkflowRuns, queueWorkflowRun } from "@/lib/workflow-runs/service";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const response = listWorkflowRuns({
      repositoryName: url.searchParams.get("repositoryName"),
    });

    return Response.json(response, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof WorkflowRunRequestError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected workflow-run query failure.",
      },
      { status: 500 },
    );
  }
}

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
    const response = queueWorkflowRun(payload);

    return Response.json(response, {
      status: 202,
    });
  } catch (error) {
    if (error instanceof WorkflowRunRequestError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected workflow-run failure.",
      },
      { status: 500 },
    );
  }
}
