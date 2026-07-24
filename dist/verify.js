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
// Default = the single var the health-mcp/bodyspec/hevy/nutri/withings family
// historically used. Reading multiple names UNIONS their ids, which would be
// MORE permissive than any origin server (2026-07-24 audit finding), so the
// default is one name and a server that used a different name passes it
// explicitly via allowlistEnvVars (whoop: ["CLERK_ALLOWED_USER_IDS"]).
export const DEFAULT_ALLOWLIST_ENV_VARS = ["ALLOWED_CLERK_USER_IDS"];
const sha256 = (value) => createHash("sha256").update(value).digest();
/** Constant-time equality over sha256 digests (always 32 bytes each). */
function secretsMatch(a, b) {
    return timingSafeEqual(sha256(a), sha256(b));
}
/**
 * Read the Clerk user-id allowlist from the configured env vars, unioning the
 * ids of every var that is set. An empty set (all unset/blank) means
 * deny-everyone — authorization fails closed.
 */
export function readAllowlist(envVars) {
    const ids = new Set();
    for (const name of envVars) {
        const raw = process.env[name];
        if (!raw)
            continue;
        for (const id of raw.split(",").map((s) => s.trim())) {
            if (id !== "")
                ids.add(id);
        }
    }
    return ids;
}
let cachedClerk;
async function loadClerk() {
    if (cachedClerk)
        return cachedClerk;
    const [{ auth }, { verifyClerkToken }] = await Promise.all([
        import("@clerk/nextjs/server"),
        import("@clerk/mcp-tools/next"),
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
export function makeVerifyToken(config = {}) {
    const allowlistEnvVars = config.allowlistEnvVars ?? [
        ...DEFAULT_ALLOWLIST_ENV_VARS,
    ];
    const bearerSecretEnvVar = config.bearerSecretEnvVar ?? "MCP_BEARER_SECRET";
    const bearerClientId = config.bearerClientId ?? "bearer-fallback";
    const bearerScopes = config.bearerScopes ?? ["profile"];
    const bearerAuthInfo = config.bearerAuthInfo ?? (() => ({ userId: "john" }));
    const catchClerkErrors = config.catchClerkErrors ?? false;
    return async function verifyToken(_request, bearerToken) {
        if (bearerToken === undefined || bearerToken === "")
            return undefined;
        // (b) Static bearer fallback — constant-time, no network.
        const secret = process.env[bearerSecretEnvVar];
        if (secret !== undefined &&
            secret !== "" &&
            secretsMatch(bearerToken, secret)) {
            return {
                token: bearerToken,
                clientId: bearerClientId,
                scopes: bearerScopes,
                extra: bearerAuthInfo(bearerToken),
            };
        }
        // (a) Clerk OAuth token. clerkMiddleware must have run for auth() to work.
        const { auth, verifyClerkToken } = config.clerk ?? (await loadClerk());
        let info;
        if (catchClerkErrors) {
            try {
                const clerkAuth = await auth({ acceptsToken: "oauth_token" });
                info = await verifyClerkToken(clerkAuth, bearerToken);
            }
            catch {
                return undefined;
            }
        }
        else {
            const clerkAuth = await auth({ acceptsToken: "oauth_token" });
            info = await verifyClerkToken(clerkAuth, bearerToken);
        }
        if (info === undefined)
            return undefined;
        // Per-user authorization on top of token validity — fail-closed.
        const allow = readAllowlist(allowlistEnvVars);
        const userId = info.extra?.userId;
        if (typeof userId !== "string" || !allow.has(userId)) {
            console.warn(`[mcp-auth] rejected valid Clerk token for user ${JSON.stringify(userId)} — not in allowlist (${allowlistEnvVars.join(" | ")}). ` +
                "Add the id to authorize; an unset/empty allowlist denies everyone.");
            return undefined;
        }
        return info;
    };
}
//# sourceMappingURL=verify.js.map