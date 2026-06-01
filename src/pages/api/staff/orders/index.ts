import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, created_at, guest_tokens!inner(guest_name, room_number), services!inner(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }

  const orders = rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    guest_name: row.guest_tokens.guest_name,
    room_number: row.guest_tokens.room_number,
    service_name: row.services.name,
  }));

  return Response.json(orders);
};
