import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
/** Clerk's `auth()` from @clerk/nextjs/server, narrowed to how we call it. */
export type ClerkAuthFn = (opts: {
    acceptsToken: "oauth_token";
}) => unknown | Promise<unknown>;
/** Clerk's `verifyClerkToken()` from @clerk/mcp-tools/next. */
export type VerifyClerkTokenFn = (authObject: unknown, bearerToken: string) => AuthInfo | undefined | Promise<AuthInfo | undefined>;
export interface MakeVerifyTokenConfig {
    /**
     * Env var names to read the Clerk user-id allowlist from. Every listed var
     * that is set is read and its ids unioned, so a server that historically
     * used either name keeps working unchanged. Comma-separated ids.
     * DEFAULT: ['ALLOWED_CLERK_USER_IDS', 'CLERK_ALLOWED_USER_IDS'].
     */
    allowlistEnvVars?: string[];
    /** Env var holding the static bearer secret. DEFAULT: 'MCP_BEARER_SECRET'. */
    bearerSecretEnvVar?: string;
    /** `clientId` returned in the bearer AuthInfo. DEFAULT: 'bearer-fallback'. */
    bearerClientId?: string;
    /** `scopes` returned in the bearer AuthInfo. DEFAULT: ['profile']. */
    bearerScopes?: string[];
    /**
     * Builds the `extra` field of the bearer AuthInfo. Lets a server preserve
     * its exact historical shape. DEFAULT: () => ({ userId: 'john' }).
     * (whoop-data-platform uses () => ({ method: 'bearer_secret' }).)
     */
    bearerAuthInfo?: (token: string) => AuthInfo["extra"];
    /**
     * When true, exceptions thrown by the Clerk `auth()` / `verifyClerkToken()`
     * path are swallowed and treated as an invalid token (→ 401), matching
     * whoop-data-platform. When false (DEFAULT), they propagate, matching
     * health-mcp and the other four servers.
     */
    catchClerkErrors?: boolean;
    /**
     * Dependency-injection seam for the Clerk primitives. Omit in production —
     * they are lazily imported from the peer deps @clerk/nextjs/server and
     * @clerk/mcp-tools/next on first use. Provide mocks in tests.
     */
    clerk?: {
        auth: ClerkAuthFn;
        verifyClerkToken: VerifyClerkTokenFn;
    };
    /**
     * Not used by the verify function itself; accepted here so a single config
     * object can be shared with `makeAuthHandler`. See withMcpAuth.
     */
    resourceMetadataPath?: string;
}
export declare const DEFAULT_ALLOWLIST_ENV_VARS: readonly ["ALLOWED_CLERK_USER_IDS"];
/** A withMcpAuth-compatible `verifyToken(request, bearerToken)`. */
export type VerifyToken = (request: Request, bearerToken?: string) => Promise<AuthInfo | undefined>;
/**
 * Read the Clerk user-id allowlist from the configured env vars, unioning the
 * ids of every var that is set. An empty set (all unset/blank) means
 * deny-everyone — authorization fails closed.
 */
export declare function readAllowlist(envVars: readonly string[]): Set<string>;
/**
 * Build the dual-path verifyToken for `withMcpAuth`. Defaults reproduce the
 * behavior of health-mcp / hevy-coach / nutrition-app / withings-integration /
 * bodyspec-data exactly; the config knobs cover whoop-data-platform's
 * divergences (CLERK_ALLOWED_USER_IDS, clientId, empty scopes, and
 * { method: 'bearer_secret' } extra).
 */
export declare function makeVerifyToken(config?: MakeVerifyTokenConfig): VerifyToken;
//# sourceMappingURL=verify.d.ts.map