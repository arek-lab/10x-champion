import { SignJWT, jwtVerify } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import { processQrAuth } from "@/lib/qr-auth";

vi.mock("astro:env/server", () => ({
  GUEST_SESSION_SECRET: "a".repeat(64),
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
}));

const TEST_SECRET = new TextEncoder().encode("a".repeat(64));

async function signPendingJwt(payload: Record<string, unknown>, expiry: string | number): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime(expiry).sign(TEST_SECRET);
}

function makeMockSupabase(
  roomRow: { room_number: string } | null,
  guestTokenRow: { id: string; room_number: string; package_id: string; check_out_date: string } | null,
): SupabaseClient<Database> {
  const makeChain = (data: unknown) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "room_qr_codes") return makeChain(roomRow);
      if (table === "guest_tokens") return makeChain(guestTokenRow);
      return makeChain(null);
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("processQrAuth", () => {
  it("happy path: issues guest_session JWT with correct claims (R1)", async () => {
    const pendingJwt = await signPendingJwt(
      { tokenId: "gt-1", type: "pending_guest" },
      Math.floor(Date.now() / 1000) + 600,
    );

    const supabase = makeMockSupabase(
      { room_number: "101" },
      { id: "gt-1", room_number: "101", package_id: "pkg-1", check_out_date: "2026-12-31" },
    );

    const result = await processQrAuth({
      qrToken: "qr-abc",
      pendingCookieValue: pendingJwt,
      secret: TEST_SECRET,
      supabase,
      today: "2026-06-02",
    });

    expect(result.type).toBe("success");
    if (result.type !== "success") return;

    const { payload } = await jwtVerify(result.sessionJwt, TEST_SECRET, { algorithms: ["HS256"] });
    expect(payload).toMatchObject({
      tokenId: "gt-1",
      roomNumber: "101",
      packageId: "pkg-1",
      checkOutDate: "2026-12-31",
    });
    const expectedExp = new Date("2026-12-31T23:59:59Z").getTime() / 1000;
    expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 1);
    expect(payload.exp).toBeLessThanOrEqual(expectedExp + 1);
  });

  it("expired pending_guest → error: invalid (R1: stale QR scan)", async () => {
    const pendingJwt = await signPendingJwt(
      { tokenId: "gt-1", type: "pending_guest" },
      Math.floor(Date.now() / 1000) - 1,
    );

    const supabase = makeMockSupabase({ room_number: "101" }, null);

    const result = await processQrAuth({
      qrToken: "qr-abc",
      pendingCookieValue: pendingJwt,
      secret: TEST_SECRET,
      supabase,
      today: "2026-06-02",
    });

    expect(result.type).toBe("error");
    if (result.type !== "error") return;
    expect(result.reason).toBe("invalid");
  });
});
