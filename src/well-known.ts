// RFC 9728 / OAuth metadata route handlers, factored out of each server's
// two app/.well-known/*/route.ts files.
//
// Usage — app/.well-known/oauth-protected-resource/mcp/route.ts:
//     import { makeProtectedResourceHandlers } from "@mili/mcp-auth/well-known";
//     export const { GET, OPTIONS } = makeProtectedResourceHandlers();
//
// Usage — app/.well-known/oauth-authorization-server/route.ts:
//     import { makeAuthServerHandlers } from "@mili/mcp-auth/well-known";
//     export const { GET, OPTIONS } = makeAuthServerHandlers();

import {
  authServerMetadataHandlerClerk,
  metadataCorsOptionsRequestHandler,
} from "@clerk/mcp-tools/next";
import {
  corsHeaders,
  generateClerkProtectedResourceMetadata,
} from "@clerk/mcp-tools/server";

export interface ProtectedResourceOptions {
  /**
   * Path (relative to the request origin) this MCP is served at — becomes the
   * `resource` identifier in the metadata. RFC 9728 and Claude's exact-match
   * check require it to be the /mcp URL itself, not the bare origin.
   * DEFAULT: '/mcp'.
   */
  resourcePath?: string;
  /** OAuth scopes advertised in the metadata. DEFAULT: ['profile', 'email']. */
  scopesSupported?: string[];
  /**
   * Env var holding the Clerk publishable key. DEFAULT:
   * 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'.
   */
  publishableKeyEnvVar?: string;
}

/**
 * Build the GET/OPTIONS handlers for the protected-resource metadata endpoint.
 * Mirrors health-mcp's custom handler: it uses the metadata generator (not the
 * packaged protectedResourceHandlerClerk) so `resource` is the full /mcp URL.
 */
export function makeProtectedResourceHandlers(
  options: ProtectedResourceOptions = {},
): {
  GET: (req: Request) => Response;
  OPTIONS: () => Response;
} {
  const resourcePath = options.resourcePath ?? "/mcp";
  const scopesSupported = options.scopesSupported ?? ["profile", "email"];
  const publishableKeyEnvVar =
    options.publishableKeyEnvVar ?? "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY";

  function GET(req: Request): Response {
    const publishableKey = process.env[publishableKeyEnvVar];
    if (publishableKey === undefined || publishableKey === "") {
      throw new Error(
        `Missing ${publishableKeyEnvVar} environment variable`,
      );
    }
    const metadata = generateClerkProtectedResourceMetadata({
      publishableKey,
      resourceUrl: `${new URL(req.url).origin}${resourcePath}`,
      properties: { scopes_supported: scopesSupported },
    });
    return Response.json(metadata, {
      headers: {
        "Cache-Control": "max-age=3600",
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  const OPTIONS = metadataCorsOptionsRequestHandler();
  return { GET, OPTIONS };
}

/**
 * Build the GET/OPTIONS handlers for the authorization-server metadata
 * passthrough to Clerk. Legacy-client insurance; cheap.
 */
export function makeAuthServerHandlers(): {
  GET: ReturnType<typeof authServerMetadataHandlerClerk>;
  OPTIONS: ReturnType<typeof metadataCorsOptionsRequestHandler>;
} {
  return {
    GET: authServerMetadataHandlerClerk(),
    OPTIONS: metadataCorsOptionsRequestHandler(),
  };
}
