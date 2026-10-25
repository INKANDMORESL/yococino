-- El bucket de redes también guarda la voz en off (WAV).
update storage.buckets set allowed_mime_types = array['video/mp4', 'image/jpeg', 'image/png', 'audio/wav'] where id = 'redes';
