// Byte-identical replacement for each server's root `middleware.ts`.
//
// Plain clerkMiddleware — required so `auth()` works inside the MCP route's
// token verification. Serves no OAuth endpoints itself (Clerk hosts those).
//
// Drop-in usage in a server's `middleware.ts`:
//
//     export { default, config } from "@mili/mcp-auth/middleware";
//
// Or, to keep an explicit local file:
//
//     import { clerkMiddleware } from "@clerk/nextjs/server";
//     import { clerkMcpMatcher } from "@mili/mcp-auth/middleware";
//     export default clerkMiddleware();
//     export const config = { matcher: clerkMcpMatcher };
import { clerkMiddleware } from "@clerk/nextjs/server";
/** The exact matcher array shared by every server's middleware config. */
export const clerkMcpMatcher = [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
];
export const config = { matcher: clerkMcpMatcher };
export { clerkMiddleware };
export default clerkMiddleware();
//# sourceMappingURL=middleware.js.map