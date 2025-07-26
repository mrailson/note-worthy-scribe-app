-- Fix the \n literals that were incorrectly replaced and convert them to actual newlines
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          outcome_letter,
          '\n',
          E'\n'
        ),
        E'\n\n\n',
        E'\n\n'
      ),
      E'\\n',
      E'\n'
    ),
    'Yours sincerely,' || E'\n' || E'\n',
    'Yours sincerely,' || E'\n' || E'\n'
  )
WHERE outcome_letter LIKE '%\n%' OR outcome_letter LIKE '%\\n%';

-- Also clean up any remaining signature placeholders that might have been missed
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        outcome_letter,
        '\*[Ss]ignature\*',
        '',
        'g'
      ),
      '\[[Ss]ignature\]',
      '',
      'g'
    ),
    '[Ss]ignature:',
    '',
    'g'
  )
WHERE outcome_letter ~ '\*[Ss]ignature\*|\[[Ss]ignature\]|[Ss]ignature:';