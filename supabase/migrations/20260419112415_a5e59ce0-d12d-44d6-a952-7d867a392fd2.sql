-- FX rate cache rows (so totals are reproducible)
INSERT INTO public.fx_rates (base_currency, target_currency, rate_date, rate, source) VALUES
  ('USD','GBP','2026-03-05',0.74841,'frankfurter.dev'),
  ('USD','GBP','2026-03-09',0.74885,'frankfurter.dev'),
  ('USD','GBP','2026-03-17',0.74954,'frankfurter.dev'),
  ('USD','GBP','2026-04-17',0.73890,'frankfurter.dev'),
  ('GBP','GBP','2026-04-01',1.00000,'identity'),
  ('GBP','GBP','2026-04-09',1.00000,'identity')
ON CONFLICT (base_currency, target_currency, rate_date) DO UPDATE
  SET rate = EXCLUDED.rate, source = EXCLUDED.source, cached_at = now();

-- 6 cost entries
INSERT INTO public.development_costs
  (user_id, cost_date, cost_type, category, description, amount, vendor, invoice_reference,
   currency, vat_amount, vat_included, payment_method, gbp_amount, fx_rate, fx_rate_date, notes)
VALUES
  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-03-05','subscription','AI API Costs',
   'Auto-recharge API credits',60.58,'Anthropic, PBC','2971-0779-9088',
   'USD',10.10,true,'Card (Link)',ROUND(60.58*0.74841,2),0.74841,'2026-03-05',
   'Claude API usage for Notewell platform. UK VAT 20% included in total.'),

  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-03-09','subscription','Cloud Services',
   'Account funding (SMS/voice)',20.00,'Twilio, Inc.','CXcd8deeb5024241da3cead9f05d9241db',
   'USD',0.00,true,'Card ending 1746',ROUND(20.00*0.74885,2),0.74885,'2026-03-09',
   'Twilio account top-up. US-domiciled, no UK VAT on this charge.'),

  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-03-17','subscription','Lovable Platform',
   'Lovable Pro 6 subscription (Mar 17 – Apr 17 2026)',480.00,'Lovable Labs Incorporated','2489-5829 / HDLFVRKP-0036',
   'USD',80.00,true,'Link',ROUND(480.00*0.74954,2),0.74954,'2026-03-17',
   'Monthly development platform subscription. UK VAT 20% included in total.'),

  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-04-01','subscription','AI API Costs',
   'ChatOn 12-month subscription (Apr 1 2026 – Apr 1 2027)',55.73,'ChatOn (via Paddle.com Market Ltd)','txn_01kn4vx7tevave8x6dpb8cbcnw',
   'GBP',9.29,true,'Mastercard ending 1746',55.73,1.00000,'2026-04-01',
   'Annual subscription; prepay covers to 1 Apr 2027. UK VAT 20% included in total.'),

  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-04-09','subscription','Development Tools',
   'Gamma Pro subscription (Apr 9 – May 9 2026)',20.00,'Gamma','2334-2678 / 82EH49BB-0009',
   'GBP',NULL,true,'Mastercard ending 1746',20.00,1.00000,'2026-04-09',
   'Monthly subscription for slide generation. VAT not itemised on receipt.'),

  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','2026-04-17','subscription','Lovable Platform',
   'Lovable Pro 6 subscription (Apr 17 – May 17 2026)',480.00,'Lovable Labs Incorporated','2075-4599 / HDLFVRKP-0038',
   'USD',80.00,true,'Link',ROUND(480.00*0.73890,2),0.73890,'2026-04-17',
   'Monthly development platform subscription. UK VAT 20% included in total.');

-- 1 in-kind time entry
INSERT INTO public.development_time_entries
  (user_id, person_name, role, period_start, period_end, hours, charged_rate_gbp, shadow_rate_gbp, category, notes)
VALUES
  ('e3aea82f-451b-40fb-8681-2b579a92dc3a','Malcolm Railson',
   'CEO / Platform Developer, PCN Services Ltd','2026-03-01','2026-04-30',45,0.00,125.00,
   'In-kind contribution',
   'Development, governance, DDaT engagement, platform operation. Charged at zero; shadow rate recorded for transparent reporting only.');