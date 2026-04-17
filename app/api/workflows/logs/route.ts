import { streamWorkflowRunLogs } from "@/lib/workflow-runs/service";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const stream = streamWorkflowRunLogs({
      workflowId: url.searchParams.get("workflowId"),
      repositoryName: url.searchParams.get("repositoryName"),
      offset: url.searchParams.get("offset"),
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
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
        error: error instanceof Error ? error.message : "Unexpected workflow-log failure.",
      },
      { status: 500 },
    );
  }
}
