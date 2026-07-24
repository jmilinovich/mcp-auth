# @mili/mcp-auth

The shared **MCP auth shell** for John's health/fitness MCP servers — the
Clerk-OAuth-plus-static-bearer verification block, the RFC 9728 well-known route
handlers, the `clerkMiddleware` wiring, and the `run`/`runText` ToolResult
helpers that were copy-pasted (and slowly drifting) across six servers:
`health-mcp`, `whoop-data-platform`, `hevy-coach`, `nutrition-app`,
`withings-integration`, and `bodyspec-data`.

Defaults reproduce the behavior of five of the six servers **exactly**; a few
config knobs cover `whoop-data-platform`'s historical divergences so every
server can adopt it with **zero behavior change**.

## Install

```bash
npm install @mili/mcp-auth
```

Peer dependencies (already present in every server — not bundled):
`@clerk/nextjs`, `@clerk/mcp-tools`, `mcp-handler`,
`@modelcontextprotocol/sdk`.

## The dual-path verify + auth handler

`app/[transport]/route.ts`:

```ts
import { createMcpHandler } from "mcp-handler";
import { makeAuthHandler, run, runText } from "@mili/mcp-auth";

const handler = createMcpHandler((server) => {
  /* server.registerTool(...) */
});

const authHandler = makeAuthHandler(handler); // defaults = health-mcp behavior

export { authHandler as GET, authHandler as POST };
```

`makeAuthHandler` wraps your handler with `withMcpAuth`, wiring the shared
`verifyToken` and `resourceMetadataPath`
(`/.well-known/oauth-protected-resource/mcp`). Need the raw verify function
instead (e.g. to keep your own `withMcpAuth` call, or add a `DELETE` export)?
Use `makeVerifyToken(config)`.

Verification order (unchanged from the originals):

1. **Static bearer** — compares `Authorization: Bearer` against
   `MCP_BEARER_SECRET` as SHA-256 digests via `crypto.timingSafeEqual`
   (constant-time). Disabled when the env var is unset.
2. **Clerk OAuth** — `verifyClerkToken(auth({ acceptsToken: "oauth_token" }))`,
   then a **fail-closed** allowlist check on the token subject.

### Config

```ts
makeVerifyToken({
  allowlistEnvVars,   // default ['ALLOWED_CLERK_USER_IDS','CLERK_ALLOWED_USER_IDS']
  bearerSecretEnvVar, // default 'MCP_BEARER_SECRET'
  bearerClientId,     // default 'bearer-fallback'
  bearerScopes,       // default ['profile']
  bearerAuthInfo,     // default (token) => ({ userId: 'john' })
  catchClerkErrors,   // default false (health-mcp); true = whoop-data-platform
  resourceMetadataPath, // used by makeAuthHandler
});
```

The allowlist reads **every** listed env var that is set and unions the ids, so
`whoop-data-platform` (which uses `CLERK_ALLOWED_USER_IDS`) and the other five
(which use `ALLOWED_CLERK_USER_IDS`) both work with the default — no per-server
override needed. An unset/empty allowlist **denies every Clerk-authenticated
request** (the static bearer still works).

**whoop-data-platform parity** — it returns a different bearer AuthInfo and
catches Clerk errors:

```ts
makeVerifyToken({
  bearerClientId: "mcp-bearer-secret",
  bearerScopes: [],
  bearerAuthInfo: () => ({ method: "bearer_secret" }),
  catchClerkErrors: true,
});
```

## Middleware

`middleware.ts` — byte-identical to the hand-written files:

```ts
export { default, config } from "@mili/mcp-auth/middleware";
```

Or keep an explicit file and reuse just the matcher:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import { clerkMcpMatcher } from "@mili/mcp-auth/middleware";

export default clerkMiddleware();
export const config = { matcher: clerkMcpMatcher };
```

## Well-known OAuth metadata

`app/.well-known/oauth-protected-resource/mcp/route.ts`:

```ts
import { makeProtectedResourceHandlers } from "@mili/mcp-auth/well-known";

export const { GET, OPTIONS } = makeProtectedResourceHandlers();
// resourcePath defaults to '/mcp'; scopes to ['profile','email'];
// publishable key from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
```

`app/.well-known/oauth-authorization-server/route.ts`:

```ts
import { makeAuthServerHandlers } from "@mili/mcp-auth/well-known";

export const { GET, OPTIONS } = makeAuthServerHandlers();
```

## Tool result helpers

```ts
import { run, runText, type ToolResult } from "@mili/mcp-auth";

// run: JSON-stringify the tool result; thrown errors → { error } + isError.
async (args) => run(() => querySql(args.sql));

// runText: deliver already-formatted text (markdown docs) as-is.
async (args) => runText(() => describeSchema(args.area));
```

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc → dist/
npm run typecheck
```

## License

MIT
