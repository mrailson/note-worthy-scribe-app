ALTER TABLE nres_hours_entries
  ADD COLUMN invoice_status text DEFAULT NULL,
  ADD COLUMN invoiced_date date DEFAULT NULL,
  ADD COLUMN invoiced_by uuid DEFAULT NULL;