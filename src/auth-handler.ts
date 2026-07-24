// Convenience wrapper: wire a createMcpHandler handler to withMcpAuth using the
// shared dual-path verifyToken and the canonical resource-metadata path.

import { withMcpAuth } from "mcp-handler";
import { makeVerifyToken, type MakeVerifyTokenConfig } from "./verify.js";

export const DEFAULT_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource/mcp";

/**
 * Wrap an MCP handler with the shared auth shell. Equivalent to the
 * hand-written `withMcpAuth(handler, verifyToken, { required: true,
 * resourceMetadataPath })` block in each server. Returns the auth handler you
 * export as GET/POST (and DELETE where the server supports it).
 */
export function makeAuthHandler<H>(handler: H, config: MakeVerifyTokenConfig = {}): H {
  const resourceMetadataPath =
    config.resourceMetadataPath ?? DEFAULT_RESOURCE_METADATA_PATH;
  return withMcpAuth(handler as never, makeVerifyToken(config) as never, {
    required: true,
    resourceMetadataPath,
  }) as H;
}
