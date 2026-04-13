import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories", () => ({
  listRepositories: vi.fn(),
}));

import { GET } from "@/app/api/repositories/route";
import { listRepositories } from "@/lib/repositories";

const mockedListRepositories = vi.mocked(listRepositories);

describe("GET /api/repositories", () => {
  beforeEach(() => {
    mockedListRepositories.mockReset();
  });

  it("returns the repository listing as JSON", async () => {
    mockedListRepositories.mockReturnValue([
      {
        name: "example-repo",
        path: "/tmp/example-repo",
        relativePath: ".data/repos/example-repo",
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      repositories: [
        {
          name: "example-repo",
          path: "/tmp/example-repo",
          relativePath: ".data/repos/example-repo",
        },
      ],
    });
    expect(mockedListRepositories).toHaveBeenCalledTimes(1);
  });
});
