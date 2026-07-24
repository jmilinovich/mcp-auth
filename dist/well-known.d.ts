import { authServerMetadataHandlerClerk, metadataCorsOptionsRequestHandler } from "@clerk/mcp-tools/next";
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
export declare function makeProtectedResourceHandlers(options?: ProtectedResourceOptions): {
    GET: (req: Request) => Response;
    OPTIONS: () => Response;
};
/**
 * Build the GET/OPTIONS handlers for the authorization-server metadata
 * passthrough to Clerk. Legacy-client insurance; cheap.
 */
export declare function makeAuthServerHandlers(): {
    GET: ReturnType<typeof authServerMetadataHandlerClerk>;
    OPTIONS: ReturnType<typeof metadataCorsOptionsRequestHandler>;
};
//# sourceMappingURL=well-known.d.ts.map