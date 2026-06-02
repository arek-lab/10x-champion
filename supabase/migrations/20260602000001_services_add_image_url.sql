-- Add image_url column to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url text;

-- Seed image URLs for the 8 fixed seed rows (deterministic picsum.photos URLs)
UPDATE public.services SET image_url = 'https://picsum.photos/seed/wifi/200'         WHERE id = '00000000-0000-0000-0001-000000000001';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/breakfast/200'    WHERE id = '00000000-0000-0000-0001-000000000002';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/pool/200'         WHERE id = '00000000-0000-0000-0001-000000000003';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/parking/200'      WHERE id = '00000000-0000-0000-0001-000000000004';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/spa/200'          WHERE id = '00000000-0000-0000-0001-000000000005';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/checkout/200'     WHERE id = '00000000-0000-0000-0001-000000000006';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/roomservice/200'  WHERE id = '00000000-0000-0000-0001-000000000007';
UPDATE public.services SET image_url = 'https://picsum.photos/seed/towels/200'       WHERE id = '00000000-0000-0000-0001-000000000008';
