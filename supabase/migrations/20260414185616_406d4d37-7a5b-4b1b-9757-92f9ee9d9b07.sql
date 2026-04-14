UPDATE storage.buckets 
SET allowed_mime_types = array_append(allowed_mime_types, 'video/webm')
WHERE id = 'audio-imports' 
AND NOT ('video/webm' = ANY(allowed_mime_types));