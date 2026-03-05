UPDATE policy_completions 
SET effective_date = '2026-03-05', review_date = '2027-03-05'
WHERE effective_date = '2026-05-03' AND review_date = '2027-05-03';