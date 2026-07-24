// ToolResult plumbing — every tool returns JSON text; errors become isError
// JSON. Duplicated verbatim across all six servers; centralized here.

export interface ToolResult {
  // CallToolResult carries a passthrough index signature; mirror it so this
  // shape is assignable to what registerTool callbacks must return.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Run an async tool body and JSON-stringify its result (null when nullish).
 * Thrown errors become an `{ error }` payload with isError: true. */
export async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result ?? null) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}

/** Like `run`, but the body returns already-formatted text (e.g. markdown
 * docs) delivered as-is rather than JSON-escaped. Errors still become
 * `{ error }` JSON with isError: true. */
export async function runText(fn: () => string): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: fn() }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}
