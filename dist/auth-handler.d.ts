import { type MakeVerifyTokenConfig } from "./verify.js";
export declare const DEFAULT_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/mcp";
/**
 * Wrap an MCP handler with the shared auth shell. Equivalent to the
 * hand-written `withMcpAuth(handler, verifyToken, { required: true,
 * resourceMetadataPath })` block in each server. Returns the auth handler you
 * export as GET/POST (and DELETE where the server supports it).
 */
export declare function makeAuthHandler<H>(handler: H, config?: MakeVerifyTokenConfig): H;
//# sourceMappingURL=auth-handler.d.ts.map