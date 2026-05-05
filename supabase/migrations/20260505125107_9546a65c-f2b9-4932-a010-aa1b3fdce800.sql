ALTER TABLE public.nres_time_entries DROP CONSTRAINT IF EXISTS nres_time_entries_minutes_check;
ALTER TABLE public.nres_time_entries ADD CONSTRAINT nres_time_entries_minutes_check CHECK (minutes >= 5 AND minutes <= 6000);
UPDATE public.nres_time_entries SET minutes = 2160 WHERE id = 'bad413f8-7557-4e40-b55e-942bb4da2704';
UPDATE public.nres_time_entries SET minutes = 1320 WHERE id = 'b6383e89-e079-4d32-9220-1cd3753c73e2';