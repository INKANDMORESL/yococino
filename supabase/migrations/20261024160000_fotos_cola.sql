-- Las fotos ya no van por lotes de Google (recogerlos se pasaba de memoria): se cancelan los lotes de fotos abiertos
-- y sus recetas vuelven a la cola normal, que hace las fotos de una en una. Idempotente.
update public.lotes_ia set estado = 'cancelado', terminado_at = now() where tipo = 'fotos' and estado = 'enviado';
update public.recetas set foto_en_lote = false where foto_en_lote;
