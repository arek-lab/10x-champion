import { jwtVerify, SignJWT } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export type QrAuthResult =
  | { type: "success"; sessionJwt: string; sessionExpiry: Date }
  | { type: "error"; reason: "invalid" | "expired" };

export async function processQrAuth(params: {
  qrToken: string;
  pendingCookieValue: string | undefined;
  secret: Uint8Array;
  supabase: SupabaseClient<Database>;
  today: string;
}): Promise<QrAuthResult> {
  const { qrToken, pendingCookieValue, secret, supabase, today } = params;

  if (!pendingCookieValue) {
    return { type: "error", reason: "invalid" };
  }

  let pendingPayload: { tokenId: string; type: string };
  try {
    const { payload } = await jwtVerify(pendingCookieValue, secret, { algorithms: ["HS256"] });
    pendingPayload = payload as typeof pendingPayload;
  } catch {
    return { type: "error", reason: "invalid" };
  }

  if (pendingPayload.type !== "pending_guest") {
    return { type: "error", reason: "invalid" };
  }

  const { data: room, error: roomError } = await supabase
    .from("room_qr_codes")
    .select("room_number")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (roomError || !room) {
    return { type: "error", reason: "invalid" };
  }

  const { data: guestToken, error: tokenError } = await supabase
    .from("guest_tokens")
    .select("id, room_number, package_id, check_out_date")
    .eq("id", pendingPayload.tokenId)
    .maybeSingle();

  if (tokenError || !guestToken) {
    return { type: "error", reason: "invalid" };
  }

  if (guestToken.room_number !== room.room_number) {
    return { type: "error", reason: "invalid" };
  }

  if (guestToken.check_out_date < today) {
    return { type: "error", reason: "expired" };
  }

  const sessionExpiry = new Date(guestToken.check_out_date + "T23:59:59Z");
  const sessionJwt = await new SignJWT({
    tokenId: guestToken.id,
    roomNumber: guestToken.room_number,
    packageId: guestToken.package_id,
    checkOutDate: guestToken.check_out_date,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(sessionExpiry)
    .sign(secret);

  return { type: "success", sessionJwt, sessionExpiry };
}
