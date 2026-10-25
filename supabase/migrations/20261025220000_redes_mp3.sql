-- El bucket de redes también guarda música (MP3).
update storage.buckets set allowed_mime_types = array['video/mp4', 'image/jpeg', 'image/png', 'audio/wav', 'audio/mpeg'] where id = 'redes';
