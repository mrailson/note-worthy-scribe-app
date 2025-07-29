-- Remove Good Friday 2025 (next financial year)
DELETE FROM public.bank_holidays_closed_days 
WHERE date = '2025-04-18' AND name = 'Good Friday';