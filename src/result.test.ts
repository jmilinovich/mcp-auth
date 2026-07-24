import { describe, expect, it } from "vitest";
import { run, runText } from "./result.js";

describe("run", () => {
  it("JSON-stringifies a resolved value", async () => {
    const r = await run(async () => ({ ok: true, n: 3 }));
    expect(r.isError).toBeUndefined();
    expect(r.content[0]!.text).toBe('{"ok":true,"n":3}');
  });

  it("serializes a nullish result as JSON null", async () => {
    const r = await run(async () => undefined);
    expect(r.content[0]!.text).toBe("null");
  });

  it("wraps a thrown Error into an isError payload", async () => {
    const r = await run(async () => {
      throw new Error("kaboom");
    });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0]!.text)).toEqual({ error: "kaboom" });
  });

  it("stringifies a non-Error throw", async () => {
    const r = await run(async () => {
      throw "plain string";
    });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0]!.text)).toEqual({ error: "plain string" });
  });
});

describe("runText", () => {
  it("returns text as-is, unescaped", async () => {
    const r = await runText(() => "# Heading\nplain markdown");
    expect(r.isError).toBeUndefined();
    expect(r.content[0]!.text).toBe("# Heading\nplain markdown");
  });

  it("wraps a throw into an isError JSON payload", async () => {
    const r = await runText(() => {
      throw new Error("doc fail");
    });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0]!.text)).toEqual({ error: "doc fail" });
  });
});
