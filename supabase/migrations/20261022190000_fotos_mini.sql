-- Fotos más ligeras: versión grande en JPEG y miniatura para listas. Idempotente.
alter table public.recetas add column if not exists imagen_mini text;
