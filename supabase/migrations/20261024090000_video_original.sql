-- Vídeo original de las recetas guardadas de redes (reproductor oficial de TikTok, YouTube o Instagram) y su autor. Idempotente.
alter table public.recetas add column if not exists video_embed text;
alter table public.recetas add column if not exists origen_autor text;
