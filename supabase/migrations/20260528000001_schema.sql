-- services: hotel amenities and services catalog
CREATE TABLE public.services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  category    text NOT NULL,
  price_pln   numeric(10,2),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- packages: bundled service offerings
CREATE TABLE public.packages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- package_services: which services belong to which package
CREATE TABLE public.package_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id     uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  service_id     uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  inclusion_type text NOT NULL CHECK (inclusion_type IN ('included', 'addon')),
  UNIQUE (package_id, service_id)
);

-- room_qr_codes: one QR token per room, scanned by guests on check-in
CREATE TABLE public.room_qr_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text NOT NULL UNIQUE,
  qr_token    text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- guest_tokens: a guest session record tied to a room and package
CREATE TABLE public.guest_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  guest_name      text NOT NULL,
  room_number     text NOT NULL REFERENCES public.room_qr_codes(room_number),
  package_id      uuid NOT NULL REFERENCES public.packages(id),
  check_in_date   date NOT NULL,
  check_out_date  date NOT NULL,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out_date > check_in_date)
);

-- orders: guest service requests
CREATE TABLE public.orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token_id uuid NOT NULL REFERENCES public.guest_tokens(id),
  service_id     uuid NOT NULL REFERENCES public.services(id),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- indexes for key query patterns
CREATE INDEX ON public.orders (guest_token_id);
CREATE INDEX ON public.orders (status);
CREATE INDEX ON public.guest_tokens (token_value);
CREATE INDEX ON public.room_qr_codes (qr_token);

-- trigger to auto-update orders.updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
