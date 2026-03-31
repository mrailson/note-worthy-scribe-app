UPDATE meetings 
SET notes_style_3 = regexp_replace(notes_style_3, 'KnowWell', 'Notewell', 'g')
WHERE id = 'eb6ebfe1-75db-4e78-89c5-47967e9a21bd'
  AND notes_style_3 LIKE '%KnowWell%';