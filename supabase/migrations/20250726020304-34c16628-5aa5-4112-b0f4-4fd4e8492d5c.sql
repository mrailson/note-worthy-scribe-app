-- Update existing acknowledgement letters to remove NHS letterhead placeholders and add proper dates
UPDATE public.complaint_acknowledgements 
SET acknowledgement_letter = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            acknowledgement_letter,
            '```\n[On NHS Letterhead]\n\nNHS Practice  \n[Practice Address]  \n[Practice Phone]  \n[Practice Email]  \nDate: [Insert Date]',
            TO_CHAR(created_at, 'DD Month YYYY')
          ),
          '[On NHS Letterhead]\n\nNHS Practice  \n[Practice Address]  \n[Practice Phone]  \n[Practice Email]  \nDate: [Insert Date]',
          TO_CHAR(created_at, 'DD Month YYYY')
        ),
        'NHS Practice  \n[Practice Address]  \n[Practice Phone]  \n[Practice Email]  \nDate: [Insert Date]',
        TO_CHAR(created_at, 'DD Month YYYY')
      ),
      '[Practice Address]',
      ''
    ),
    '[Practice Phone]',
    ''
  ),
  '[Practice Email]',
  ''
)
WHERE acknowledgement_letter LIKE '%[On NHS Letterhead]%' 
   OR acknowledgement_letter LIKE '%NHS Practice%' 
   OR acknowledgement_letter LIKE '%[Practice Address]%';

-- Update existing outcome letters to remove NHS practice placeholders and add proper dates
UPDATE public.complaint_outcomes 
SET outcome_letter = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              outcome_letter,
              '**NHS Practice**  \n[Practice Address]  \n[Practice Phone]  \n[Practice Email]  \n\n[Date]',
              TO_CHAR(created_at, 'DD Month YYYY')
            ),
            'NHS Practice**  \n[Address not provided]  \n[Phone not provided]  \n[Email not provided]  \n\n**Date:** [Insert Date]',
            TO_CHAR(created_at, 'DD Month YYYY')
          ),
          '---\n**NHS Practice**  \n[Address not provided]  \n[Phone not provided]  \n[Email not provided]  \n\n**Date:** [Insert Date]',
          TO_CHAR(created_at, 'DD Month YYYY')
        ),
        '[Address not provided]',
        ''
      ),
      '[Phone not provided]',
      ''
    ),
    '[Email not provided]',
    ''
  ),
  '[Insert Date]',
  TO_CHAR(created_at, 'DD Month YYYY')
)
WHERE outcome_letter LIKE '%NHS Practice%' 
   OR outcome_letter LIKE '%[Address not provided]%' 
   OR outcome_letter LIKE '%[Phone not provided]%' 
   OR outcome_letter LIKE '%[Email not provided]%'
   OR outcome_letter LIKE '%[Insert Date]%';