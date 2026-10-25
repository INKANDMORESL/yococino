-- Bucket público para los vídeos de Instagram (los hace la función video-redes; no hay datos de clientes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('redes', 'redes', true, 104857600, array['video/mp4', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- lotes_ia: también los vídeos (solo para apuntar el coste).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'lotes_ia_tipo_check') then
    alter table public.lotes_ia drop constraint lotes_ia_tipo_check;
    alter table public.lotes_ia add constraint lotes_ia_tipo_check check (tipo in ('recetas', 'fotos', 'video'));
  end if;
end $$;
