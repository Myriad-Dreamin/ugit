import { describe, expect, it } from "vitest";
import { selectRunnableJobs } from "@/lib/pr-runner/storage";

describe("selectRunnableJobs", () => {
  it("limits active jobs to one per repository and four globally", () => {
    const selected = selectRunnableJobs(
      [
        { id: "job-1", repository_path: "/repos/a" },
        { id: "job-2", repository_path: "/repos/a" },
        { id: "job-3", repository_path: "/repos/b" },
        { id: "job-4", repository_path: "/repos/c" },
        { id: "job-5", repository_path: "/repos/d" },
        { id: "job-6", repository_path: "/repos/e" },
      ],
      new Set<string>(["/repos/running"]),
      4,
    );

    expect(selected).toEqual([
      { id: "job-1", repository_path: "/repos/a" },
      { id: "job-3", repository_path: "/repos/b" },
      { id: "job-4", repository_path: "/repos/c" },
      { id: "job-5", repository_path: "/repos/d" },
    ]);
  });

  it("skips repositories that already have a running job", () => {
    const selected = selectRunnableJobs(
      [
        { id: "job-1", repository_path: "/repos/a" },
        { id: "job-2", repository_path: "/repos/b" },
      ],
      new Set<string>(["/repos/a"]),
      4,
    );

    expect(selected).toEqual([{ id: "job-2", repository_path: "/repos/b" }]);
  });
});
