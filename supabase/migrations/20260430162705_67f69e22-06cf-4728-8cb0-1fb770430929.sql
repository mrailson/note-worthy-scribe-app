UPDATE public.nres_claimants
SET is_active = false, updated_at = now()
WHERE id IN (
  '24bf5a17-65af-4801-abad-3a85ece8ccf3',
  'd1df9811-e500-4eb7-b8cc-9ee5ad7335f0',
  '62ee2c0e-d9ee-4469-a203-fd2f59ebba1d'
);