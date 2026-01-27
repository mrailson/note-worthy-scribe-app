-- Delete the two empty "General Meeting" entries for Julia Railson
DELETE FROM public.meetings 
WHERE id IN (
  '0c41e0ac-eba9-4085-b3f2-acd3c0a4bf43',
  'ecf27ac9-a640-4c9c-9c7f-b6d64e51ac5b'
)
AND user_id = 'fcfad128-3035-4048-92d6-3b6d45d7fbe8';