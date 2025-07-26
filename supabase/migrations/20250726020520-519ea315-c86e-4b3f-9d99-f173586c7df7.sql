-- Update existing outcome letters to remove "---NHS Practice" header and blank lines at the top
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  -- Remove "---NHS Practice" at the beginning
  REGEXP_REPLACE(
    -- Remove multiple blank lines at the start
    REGEXP_REPLACE(
      -- Remove the ---NHS Practice line
      REGEXP_REPLACE(
        outcome_letter,
        '^---\n\*\*NHS Practice\*\*\s*\n',
        '',
        'g'
      ),
      '^\n+',
      '',
      'g'
    ),
    '^```\n+',
    '',
    'g'
  )
WHERE outcome_letter LIKE '%---NHS Practice%' 
   OR outcome_letter LIKE '%**NHS Practice**%'
   OR outcome_letter ~ '^\n+';

-- Also remove any remaining "**NHS Practice**" headers without the dashes
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  REGEXP_REPLACE(
    outcome_letter,
    '^\*\*NHS Practice\*\*\s*\n+',
    '',
    'g'
  )
WHERE outcome_letter LIKE '%**NHS Practice**%';