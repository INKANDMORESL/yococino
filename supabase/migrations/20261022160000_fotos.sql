-- Fotos de los platos: una por receta compartida, generada una sola vez y guardada en Storage.
-- Idempotente.

-- Carpeta pública de fotos (solo lectura para todos; solo el servidor sube).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Marca de "foto en preparación", para no generar dos veces la misma.
alter table public.recetas add column if not exists foto_pedida_at timestamptz;
alter table public.recetas add column if not exists foto_modelo text;
