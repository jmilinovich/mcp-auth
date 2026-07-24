// Dual-path MCP token verification, extracted verbatim in behavior from the six
// copy-pasted health/fitness MCP servers (health-mcp, whoop-data-platform,
// hevy-coach, nutrition-app, withings-integration, bodyspec-data).
//
// Two accepted credentials, checked in this order:
//   (b) Static bearer secret (MCP_BEARER_SECRET) — no network. Compared as
//       fixed-length SHA-256 digests via node:crypto timingSafeEqual so the
//       check is constant-time and leaks no match-prefix timing on a
//       long-lived static credential. Disabled whenever the env var is unset.
//   (a) Clerk OAuth access token (claude.ai web/mobile/desktop connector).
//       A valid token only proves *some* account on the Clerk instance —
//       dynamic client registration is open by design — so token validity is
//       AUTHENTICATION, not AUTHORIZATION. The token subject (Clerk user id)
//       must additionally appear in the allowlist env var. Fails CLOSED: an
//       unset/empty allowlist denies every Clerk-authenticated request.
//
// Never log tokens or Authorization headers.

import { createHash, timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

/** Clerk's `auth()` from @clerk/nextjs/server, narrowed to how we call it. */
export type ClerkAuthFn = (opts: {
  acceptsToken: "oauth_token";
}) => unknown | Promise<unknown>;

/** Clerk's `verifyClerkToken()` from @clerk/mcp-tools/next. */
export type VerifyClerkTokenFn = (
  authObject: unknown,
  bearerToken: string,
) => AuthInfo | undefined | Promise<AuthInfo | undefined>;

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
  clerk?: { auth: ClerkAuthFn; verifyClerkToken: VerifyClerkTokenFn };
  /**
   * Not used by the verify function itself; accepted here so a single config
   * object can be shared with `makeAuthHandler`. See withMcpAuth.
   */
  resourceMetadataPath?: string;
}

export const DEFAULT_ALLOWLIST_ENV_VARS = [
  "ALLOWED_CLERK_USER_IDS",
  "CLERK_ALLOWED_USER_IDS",
] as const;

/** A withMcpAuth-compatible `verifyToken(request, bearerToken)`. */
export type VerifyToken = (
  request: Request,
  bearerToken?: string,
) => Promise<AuthInfo | undefined>;

const sha256 = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

/** Constant-time equality over sha256 digests (always 32 bytes each). */
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/**
 * Read the Clerk user-id allowlist from the configured env vars, unioning the
 * ids of every var that is set. An empty set (all unset/blank) means
 * deny-everyone — authorization fails closed.
 */
export function readAllowlist(envVars: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const name of envVars) {
    const raw = process.env[name];
    if (!raw) continue;
    for (const id of raw.split(",").map((s) => s.trim())) {
      if (id !== "") ids.add(id);
    }
  }
  return ids;
}

let cachedClerk: { auth: ClerkAuthFn; verifyClerkToken: VerifyClerkTokenFn } | undefined;

async function loadClerk(): Promise<{
  auth: ClerkAuthFn;
  verifyClerkToken: VerifyClerkTokenFn;
}> {
  if (cachedClerk) return cachedClerk;
  const [{ auth }, { verifyClerkToken }] = await Promise.all([
    import("@clerk/nextjs/server") as Promise<{ auth: ClerkAuthFn }>,
    import("@clerk/mcp-tools/next") as Promise<{
      verifyClerkToken: VerifyClerkTokenFn;
    }>,
  ]);
  cachedClerk = { auth, verifyClerkToken };
  return cachedClerk;
}

/**
 * Build the dual-path verifyToken for `withMcpAuth`. Defaults reproduce the
 * behavior of health-mcp / hevy-coach / nutrition-app / withings-integration /
 * bodyspec-data exactly; the config knobs cover whoop-data-platform's
 * divergences (CLERK_ALLOWED_USER_IDS, clientId, empty scopes, and
 * { method: 'bearer_secret' } extra).
 */
export function makeVerifyToken(config: MakeVerifyTokenConfig = {}): VerifyToken {
  const allowlistEnvVars = config.allowlistEnvVars ?? [
    ...DEFAULT_ALLOWLIST_ENV_VARS,
  ];
  const bearerSecretEnvVar = config.bearerSecretEnvVar ?? "MCP_BEARER_SECRET";
  const bearerClientId = config.bearerClientId ?? "bearer-fallback";
  const bearerScopes = config.bearerScopes ?? ["profile"];
  const bearerAuthInfo =
    config.bearerAuthInfo ?? (() => ({ userId: "john" }));
  const catchClerkErrors = config.catchClerkErrors ?? false;

  return async function verifyToken(
    _request: Request,
    bearerToken?: string,
  ): Promise<AuthInfo | undefined> {
    if (bearerToken === undefined || bearerToken === "") return undefined;

    // (b) Static bearer fallback — constant-time, no network.
    const secret = process.env[bearerSecretEnvVar];
    if (
      secret !== undefined &&
      secret !== "" &&
      secretsMatch(bearerToken, secret)
    ) {
      return {
        token: bearerToken,
        clientId: bearerClientId,
        scopes: bearerScopes,
        extra: bearerAuthInfo(bearerToken),
      };
    }

    // (a) Clerk OAuth token. clerkMiddleware must have run for auth() to work.
    const { auth, verifyClerkToken } = config.clerk ?? (await loadClerk());

    let info: AuthInfo | undefined;
    if (catchClerkErrors) {
      try {
        const clerkAuth = await auth({ acceptsToken: "oauth_token" });
        info = await verifyClerkToken(clerkAuth, bearerToken);
      } catch {
        return undefined;
      }
    } else {
      const clerkAuth = await auth({ acceptsToken: "oauth_token" });
      info = await verifyClerkToken(clerkAuth, bearerToken);
    }
    if (info === undefined) return undefined;

    // Per-user authorization on top of token validity — fail-closed.
    const allow = readAllowlist(allowlistEnvVars);
    const userId = (info.extra as { userId?: unknown } | undefined)?.userId;
    if (typeof userId !== "string" || !allow.has(userId)) {
      console.warn(
        `[mcp-auth] rejected valid Clerk token for user ${JSON.stringify(
          userId,
        )} — not in allowlist (${allowlistEnvVars.join(" | ")}). ` +
          "Add the id to authorize; an unset/empty allowlist denies everyone.",
      );
      return undefined;
    }
    return info;
  };
}
