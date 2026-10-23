-- Cuándo se miró por última vez cada lote (se revisa uno cada vez, el que lleva más tiempo sin mirarse). Idempotente.
alter table public.lotes_ia add column if not exists revisado_at timestamptz;
