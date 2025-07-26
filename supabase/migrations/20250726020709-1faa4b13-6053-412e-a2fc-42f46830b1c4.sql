-- Update existing outcome letters to remove "*Signature*" and signature placeholders
UPDATE public.complaint_outcomes 
SET outcome_letter = 
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          outcome_letter,
          '\*Signature\*\s*\n+',
          '\n',
          'g'
        ),
        '\[Signature\]\s*\n+',
        '\n',
        'g'
      ),
      'Signature:\s*\n+',
      '\n',
      'g'
    ),
    '\*\*Signature\*\*\s*\n+',
    '\n',
    'g'
  )
WHERE outcome_letter ~ '\*(Signature|signature)\*|\[Signature\]|\*\*Signature\*\*|Signature:\s*\n';