-- RLS for catalog tables (staff read-only; guests use service role which bypasses RLS)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_services" ON public.services
  FOR SELECT TO authenticated USING (active = true);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_packages" ON public.packages
  FOR SELECT TO authenticated USING (active = true);

ALTER TABLE public.package_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_package_services" ON public.package_services
  FOR SELECT TO authenticated USING (true);

-- RLS for room_qr_codes (staff read-only)
ALTER TABLE public.room_qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_room_qr_codes" ON public.room_qr_codes
  FOR SELECT TO authenticated USING (true);

-- RLS for guest_tokens (staff full access: generate tokens, view guest list)
ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_guest_tokens" ON public.guest_tokens
  TO authenticated USING (true) WITH CHECK (true);

-- RLS for orders (staff read all + update to fulfil/cancel)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff_update_orders" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
