import { listRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    repositories: listRepositories(),
  });
}
