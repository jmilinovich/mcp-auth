import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeVerifyToken,
  readAllowlist,
  DEFAULT_ALLOWLIST_ENV_VARS,
} from "./verify.js";

// A minimal AuthInfo-shaped object; the real type is stripped at runtime.
type Info = {
  token: string;
  clientId: string;
  scopes: string[];
  extra?: Record<string, unknown>;
};

const req = () => new Request("https://example.com/mcp");

const ALLOWLIST_VARS = [
  "ALLOWED_CLERK_USER_IDS",
  "CLERK_ALLOWED_USER_IDS",
  "MCP_BEARER_SECRET",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
];

function clearEnv() {
  for (const k of ALLOWLIST_VARS) delete process.env[k];
}

beforeEach(clearEnv);
afterEach(clearEnv);

/** A Clerk stub that always authenticates the token to a fixed subject. */
function clerkFor(userId: string | undefined) {
  const info: Info | undefined =
    userId === undefined
      ? undefined
      : { token: "clerk-tok", clientId: "clerk", scopes: [], extra: { userId } };
  return {
    auth: vi.fn(async () => ({ subject: userId })),
    verifyClerkToken: vi.fn(async () => info),
  };
}

describe("bearer fallback — sha256 + timingSafeEqual", () => {
  it("accepts the exact secret and returns the default AuthInfo shape", async () => {
    process.env.MCP_BEARER_SECRET = "s3cret-value";
    const verify = makeVerifyToken();
    const info = (await verify(req(), "s3cret-value")) as Info | undefined;
    expect(info).toBeDefined();
    expect(info!.clientId).toBe("bearer-fallback");
    expect(info!.scopes).toEqual(["profile"]);
    expect(info!.extra).toEqual({ userId: "john" });
    expect(info!.token).toBe("s3cret-value");
  });

  it("rejects a wrong secret (no Clerk configured → undefined)", async () => {
    process.env.MCP_BEARER_SECRET = "s3cret-value";
    const verify = makeVerifyToken({
      clerk: clerkFor(undefined), // Clerk denies too
    });
    expect(await verify(req(), "wrong")).toBeUndefined();
  });

  it("rejects a secret that is a prefix of the real one", async () => {
    process.env.MCP_BEARER_SECRET = "s3cret-value";
    const verify = makeVerifyToken({ clerk: clerkFor(undefined) });
    expect(await verify(req(), "s3cret")).toBeUndefined();
  });

  it("is disabled when MCP_BEARER_SECRET is unset", async () => {
    const verify = makeVerifyToken({ clerk: clerkFor(undefined) });
    expect(await verify(req(), "anything")).toBeUndefined();
  });

  it("returns undefined for empty/missing bearer token without touching Clerk", async () => {
    const clerk = clerkFor("u_1");
    const verify = makeVerifyToken({ clerk });
    expect(await verify(req(), "")).toBeUndefined();
    expect(await verify(req(), undefined)).toBeUndefined();
    expect(clerk.auth).not.toHaveBeenCalled();
  });
});

describe("configurable bearer AuthInfo shape (whoop parity)", () => {
  it("preserves the { method: 'bearer_secret' } extra, clientId and empty scopes", async () => {
    process.env.MCP_BEARER_SECRET = "abc";
    const verify = makeVerifyToken({
      bearerClientId: "mcp-bearer-secret",
      bearerScopes: [],
      bearerAuthInfo: () => ({ method: "bearer_secret" }),
    });
    const info = (await verify(req(), "abc")) as Info;
    expect(info.clientId).toBe("mcp-bearer-secret");
    expect(info.scopes).toEqual([]);
    expect(info.extra).toEqual({ method: "bearer_secret" });
  });
});

describe("Clerk path — allowlist authorization", () => {
  it("accepts a Clerk token whose subject is in ALLOWED_CLERK_USER_IDS", async () => {
    process.env.ALLOWED_CLERK_USER_IDS = "user_abc, user_def";
    const verify = makeVerifyToken({ clerk: clerkFor("user_def") });
    const info = (await verify(req(), "oauth-token")) as Info | undefined;
    expect(info).toBeDefined();
    expect((info!.extra as { userId: string }).userId).toBe("user_def");
  });

  it("also resolves the allowlist from the whoop var CLERK_ALLOWED_USER_IDS", async () => {
    process.env.CLERK_ALLOWED_USER_IDS = "user_whoop";
    const verify = makeVerifyToken({ clerk: clerkFor("user_whoop") });
    expect(await verify(req(), "oauth-token")).toBeDefined();
  });

  it("unions ids across BOTH env var names", async () => {
    process.env.ALLOWED_CLERK_USER_IDS = "a";
    process.env.CLERK_ALLOWED_USER_IDS = "b";
    const verify = makeVerifyToken({ clerk: clerkFor("b") });
    expect(await verify(req(), "oauth-token")).toBeDefined();
    const verify2 = makeVerifyToken({ clerk: clerkFor("a") });
    expect(await verify2(req(), "oauth-token")).toBeDefined();
  });

  it("fails CLOSED — empty allowlist rejects an otherwise-valid Clerk token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verify = makeVerifyToken({ clerk: clerkFor("user_def") });
    expect(await verify(req(), "oauth-token")).toBeUndefined();
    warn.mockRestore();
  });

  it("rejects a valid Clerk token whose subject is NOT allowlisted", async () => {
    process.env.ALLOWED_CLERK_USER_IDS = "someone_else";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verify = makeVerifyToken({ clerk: clerkFor("user_intruder") });
    expect(await verify(req(), "oauth-token")).toBeUndefined();
    warn.mockRestore();
  });

  it("rejects when Clerk returns no info (invalid token)", async () => {
    process.env.ALLOWED_CLERK_USER_IDS = "user_def";
    const verify = makeVerifyToken({ clerk: clerkFor(undefined) });
    expect(await verify(req(), "oauth-token")).toBeUndefined();
  });

  it("honors a custom allowlistEnvVars list", async () => {
    process.env.MY_ALLOWED = "solo_user";
    const verify = makeVerifyToken({
      allowlistEnvVars: ["MY_ALLOWED"],
      clerk: clerkFor("solo_user"),
    });
    expect(await verify(req(), "oauth-token")).toBeDefined();
    delete process.env.MY_ALLOWED;
  });
});

describe("catchClerkErrors", () => {
  it("propagates Clerk exceptions by default (health-mcp behavior)", async () => {
    process.env.ALLOWED_CLERK_USER_IDS = "user_def";
    const clerk = {
      auth: vi.fn(async () => {
        throw new Error("clerk boom");
      }),
      verifyClerkToken: vi.fn(),
    };
    const verify = makeVerifyToken({ clerk });
    await expect(verify(req(), "oauth-token")).rejects.toThrow("clerk boom");
  });

  it("swallows Clerk exceptions → undefined when catchClerkErrors is true (whoop behavior)", async () => {
    process.env.CLERK_ALLOWED_USER_IDS = "user_def";
    const clerk = {
      auth: vi.fn(async () => {
        throw new Error("clerk boom");
      }),
      verifyClerkToken: vi.fn(),
    };
    const verify = makeVerifyToken({ clerk, catchClerkErrors: true });
    expect(await verify(req(), "oauth-token")).toBeUndefined();
  });
});

describe("readAllowlist", () => {
  it("defaults cover both known env var names", () => {
    expect([...DEFAULT_ALLOWLIST_ENV_VARS]).toEqual([
      "ALLOWED_CLERK_USER_IDS",
      "CLERK_ALLOWED_USER_IDS",
    ]);
  });

  it("trims, drops blanks, and returns an empty set when unset", () => {
    expect(readAllowlist([...DEFAULT_ALLOWLIST_ENV_VARS]).size).toBe(0);
    process.env.ALLOWED_CLERK_USER_IDS = " a , , b ,";
    expect([...readAllowlist([...DEFAULT_ALLOWLIST_ENV_VARS])].sort()).toEqual([
      "a",
      "b",
    ]);
  });
});
