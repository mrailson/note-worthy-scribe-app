-- Add extra line between "Yours sincerely," and the name in existing outcome letters
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  REPLACE(
    outcome_letter,
    'Yours sincerely,' || E'\n' || E'\n',
    'Yours sincerely,' || E'\n' || E'\n' || E'\n'
  )
WHERE outcome_letter LIKE '%Yours sincerely,%' 
AND outcome_letter NOT LIKE '%Yours sincerely,' || E'\n' || E'\n' || E'\n' || '%';