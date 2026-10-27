-- Preparación para otros países e idiomas (de momento todo es España y español).
-- profiles.idioma / profiles.pais: los del móvil de la persona (null = aún sin saber; se trata como es / ES).
-- recetas.cocina: de qué cocina es la receta ('es' = española y mediterránea); recetas.idioma: en qué idioma está escrita.
alter table public.profiles add column if not exists idioma text;
alter table public.profiles add column if not exists pais text;
alter table public.recetas add column if not exists cocina text not null default 'es';
alter table public.recetas add column if not exists idioma text not null default 'es';
create index if not exists recetas_cocina_idx on public.recetas (cocina);
