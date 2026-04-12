import { describe, expect, it } from "vitest";
import { getHelloMessage } from "@/lib/hello";

describe("getHelloMessage", () => {
  it("returns the starter heading and subtitle", () => {
    expect(getHelloMessage()).toEqual({
      heading: "Hello World",
      subtitle: "A clean Next.js App Router starter for ugit.",
    });
  });
});
