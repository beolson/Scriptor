import { expect, test } from "bun:test";

test("trivial passing test", () => {
	expect(1 + 1).toBe(2);
});
