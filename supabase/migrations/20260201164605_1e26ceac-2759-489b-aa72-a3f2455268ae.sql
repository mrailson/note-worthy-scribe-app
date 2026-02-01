-- Insert OpenAI token costs (USD converted to GBP at ~0.79 rate)
INSERT INTO public.development_costs (user_id, cost_date, cost_type, category, description, amount, vendor, invoice_reference)
VALUES
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-05-31', 'subscription', 'AI API Costs', 'API Tokens', 14.22, 'OpenAI', '3FUINTO4-0003'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-06-16', 'subscription', 'AI API Costs', 'API Tokens', 28.44, 'OpenAI', '3FUINTO4-0004'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-07-07', 'subscription', 'AI API Costs', 'API Tokens', 33.57, 'OpenAI', '3FUINTO4-0005'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-08-07', 'subscription', 'AI API Costs', 'API Tokens', 33.20, 'OpenAI', '3FUINTO4-0006'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-08-21', 'subscription', 'AI API Costs', 'API Tokens', 33.19, 'OpenAI', '3FUINTO4-0007'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-08-22', 'subscription', 'AI API Costs', 'API Tokens', 28.44, 'OpenAI', '3FUINTO4-0008'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2025-11-13', 'subscription', 'AI API Costs', 'API Tokens', 33.20, 'OpenAI', '3FUINTO4-0009'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2026-01-06', 'subscription', 'AI API Costs', 'API Tokens', 33.21, 'OpenAI', '3FUINTO4-0010'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2026-01-13', 'subscription', 'AI API Costs', 'API Tokens', 33.38, 'OpenAI', '3FUINTO4-0011'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2026-01-15', 'subscription', 'AI API Costs', 'API Tokens', 33.31, 'OpenAI', '3FUINTO4-0012'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2026-01-20', 'subscription', 'AI API Costs', 'API Tokens', 33.24, 'OpenAI', '3FUINTO4-0013'),
  ('3eecbf7f-4956-4f29-94d6-21910819b0b5', '2026-01-22', 'subscription', 'AI API Costs', 'API Tokens', 33.24, 'OpenAI', '3FUINTO4-0014');