import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  status: z.enum(["fulfilled", "cancelled"]),
});

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !uuidPattern.test(id)) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
  }

  const { status } = result.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Order is not pending" }, { status: 409 });
    }
    return Response.json({ error: "Failed to update order" }, { status: 500 });
  }

  return Response.json({ id: data.id, status: data.status });
};
