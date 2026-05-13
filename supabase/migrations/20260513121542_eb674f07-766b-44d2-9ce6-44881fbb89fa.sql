ALTER TABLE public.narp_patient_snapshots
  DROP COLUMN IF EXISTS nhs_number_enc,
  DROP COLUMN IF EXISTS nhs_number_hash,
  DROP COLUMN IF EXISTS forenames_enc,
  DROP COLUMN IF EXISTS surname_enc;