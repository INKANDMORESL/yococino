-- «Cuéntanos cómo te gusta comer»: lo que escribe la persona y las preferencias que se sacan de ello
-- ({ mas: { desayuno: [...], ..., todas: [...] }, evitar: [...] }). Ver _shared/preferencias.ts.
alter table public.profiles add column if not exists preferencias_texto text;
alter table public.profiles add column if not exists preferencias jsonb;
