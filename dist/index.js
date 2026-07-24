// @mili/mcp-auth — shared MCP auth shell for John's health/fitness MCP servers.
//
// Main entry: the dual-path verifyToken, the withMcpAuth wrapper, and the
// ToolResult run/runText helpers. Framework-coupled pieces are separate
// subpath exports so importing this module never pulls in Clerk's Next.js
// middleware or the well-known route handlers unless you ask for them:
//   - "@mili/mcp-auth/middleware"  → clerkMiddleware + matcher config
//   - "@mili/mcp-auth/well-known"  → OAuth metadata route handlers
export { makeVerifyToken, readAllowlist, DEFAULT_ALLOWLIST_ENV_VARS, } from "./verify.js";
export { makeAuthHandler, DEFAULT_RESOURCE_METADATA_PATH, } from "./auth-handler.js";
export { run, runText } from "./result.js";
//# sourceMappingURL=index.js.map