import { getWorkflowRun } from "@/lib/workflow-runs/service";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

export const dynamic = "force-dynamic";

type WorkflowRunRouteContext = Readonly<{
  params:
    | Promise<{
        workflowId: string;
      }>
    | {
        workflowId: string;
      };
}>;

export async function GET(request: Request, context: WorkflowRunRouteContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { workflowId } = await Promise.resolve(context.params);
    const response = getWorkflowRun({
      repositoryName: url.searchParams.get("repositoryName"),
      workflowId,
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
        error: error instanceof Error ? error.message : "Unexpected workflow-run read failure.",
      },
      { status: 500 },
    );
  }
}
