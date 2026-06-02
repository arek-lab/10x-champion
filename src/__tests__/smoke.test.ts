import type { Database } from "@/types";

describe("smoke", () => {
  it("runner works and @/ alias resolves", () => {
    const _typeCheck: Database | null = null;
    expect(1 + 1).toBe(2);
  });
});
