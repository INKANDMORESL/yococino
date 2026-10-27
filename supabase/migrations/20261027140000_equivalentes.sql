-- Cambios de ingredientes hechos desde la lista de la compra (botón «Equivalente»): { "merluza": "rosada" }.
-- Solo afectan a esa comida del menú de la persona; la receta compartida no cambia (así no cuesta nada).
alter table public.comidas add column if not exists cambios jsonb not null default '{}'::jsonb;
