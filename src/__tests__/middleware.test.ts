/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { SignJWT } from "jose";

vi.mock("astro:middleware", () => ({
  defineMiddleware: vi.fn((fn: unknown) => fn),
}));

vi.mock("astro:env/server", () => ({
  GUEST_SESSION_SECRET: "a".repeat(64),
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_KEY: "test-anon-key",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

import { onRequest } from "@/middleware";

const TEST_SECRET = new TextEncoder().encode("a".repeat(64));

async function signJwt(payload: Record<string, unknown>, expiry: string | number): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime(expiry).sign(TEST_SECRET);
}

const makeContext = (cookieValue?: string) => ({
  cookies: {
    get: vi.fn((name: string) => (name === "guest_session" && cookieValue ? { value: cookieValue } : undefined)),
  },
  locals: {} as App.Locals,
  url: { pathname: "/guest/panel" },
  redirect: vi.fn(),
  request: { headers: new Headers() },
});

describe("middleware — guest JWT", () => {
  it("valid JWT → guestToken populated with all fields", async () => {
    const jwt = await signJwt(
      { tokenId: "t1", roomNumber: "101", packageId: "p1", checkOutDate: "2026-12-31" },
      Math.floor(Date.now() / 1000) + 3600,
    );
    const ctx = makeContext(jwt);
    const next = vi.fn().mockResolvedValue(new Response());

    await (onRequest as any)(ctx, next);

    expect(ctx.locals.guestToken).toEqual({
      tokenId: "t1",
      roomNumber: "101",
      packageId: "p1",
      checkOutDate: "2026-12-31",
      exp: expect.any(Number),
    });
  });

  it("expired JWT → guestToken null, no throw (R3: exp enforcement)", async () => {
    const jwt = await signJwt(
      { tokenId: "t1", roomNumber: "101", packageId: "p1", checkOutDate: "2026-12-31" },
      Math.floor(Date.now() / 1000) - 1,
    );
    const ctx = makeContext(jwt);
    const next = vi.fn().mockResolvedValue(new Response());

    await (onRequest as any)(ctx, next);

    expect(ctx.locals.guestToken).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it("tampered JWT → guestToken null (R2: signature verification)", async () => {
    const jwt = await signJwt(
      { tokenId: "t1", roomNumber: "101", packageId: "p1", checkOutDate: "2026-12-31" },
      Math.floor(Date.now() / 1000) + 3600,
    );
    const parts = jwt.split(".");
    parts[2] = (parts[2].startsWith("a") ? "b" : "a") + parts[2].slice(1);
    const tampered = parts.join(".");
    const ctx = makeContext(tampered);
    const next = vi.fn().mockResolvedValue(new Response());

    await (onRequest as any)(ctx, next);

    expect(ctx.locals.guestToken).toBeNull();
  });

  it("missing cookie → guestToken null (R2: no session)", async () => {
    const ctx = makeContext();
    const next = vi.fn().mockResolvedValue(new Response());

    await (onRequest as any)(ctx, next);

    expect(ctx.locals.guestToken).toBeNull();
  });

  it("missing GUEST_SESSION_SECRET → guestToken null", async () => {
    vi.resetModules();
    vi.doMock("astro:middleware", () => ({
      defineMiddleware: (fn: unknown) => fn,
    }));
    vi.doMock("astro:env/server", () => ({
      GUEST_SESSION_SECRET: undefined,
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_KEY: "test-anon-key",
    }));
    vi.doMock("@/lib/supabase", () => ({
      createClient: vi.fn().mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      }),
    }));
    const { onRequest: onReq } = await import("@/middleware");

    const jwt = await signJwt(
      { tokenId: "t1", roomNumber: "101", packageId: "p1", checkOutDate: "2026-12-31" },
      Math.floor(Date.now() / 1000) + 3600,
    );
    const ctx = makeContext(jwt);
    const next = vi.fn().mockResolvedValue(new Response());

    await (onReq as any)(ctx, next);

    expect(ctx.locals.guestToken).toBeNull();
  });
});
