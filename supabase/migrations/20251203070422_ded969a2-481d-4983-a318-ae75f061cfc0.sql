-- Insert LG Capture service activations for specified users
INSERT INTO user_service_activations (user_id, service, notes)
VALUES 
  ('fcfad128-2a65-4fd0-8b15-5d990262172f', 'lg_capture', 'Enabled for j.railson@nhs.net'),
  ('dbefd7c1-47f5-41de-a58e-ab739558af16', 'lg_capture', 'Enabled for amanda.taylor75@nhs.net'),
  ('e3aea82f-451b-40fb-8681-2b579a92dc3a', 'lg_capture', 'Enabled for malcolm.railson@nhs.net')
ON CONFLICT (user_id, service) DO NOTHING;