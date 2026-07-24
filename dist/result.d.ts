export interface ToolResult {
    [key: string]: unknown;
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}
/** Run an async tool body and JSON-stringify its result (null when nullish).
 * Thrown errors become an `{ error }` payload with isError: true. */
export declare function run(fn: () => Promise<unknown>): Promise<ToolResult>;
/** Like `run`, but the body returns already-formatted text (e.g. markdown
 * docs) delivered as-is rather than JSON-escaped. Errors still become
 * `{ error }` JSON with isError: true. */
export declare function runText(fn: () => string): Promise<ToolResult>;
//# sourceMappingURL=result.d.ts.map