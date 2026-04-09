UPDATE public.nres_buyback_rate_settings
SET roles_config = (
  SELECT jsonb_agg(
    CASE
      WHEN role->>'key' = 'gp' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"gp-001","type":"must_have","text":"Must hold valid CCT (Certificate of Completion of Training) or be on the GMC GP Register","requires_acknowledgement":true},
        {"id":"gp-002","type":"must_have","text":"Must be on the NHS England GP Performers List","requires_acknowledgement":true},
        {"id":"gp-003","type":"must_have","text":"Must have current GMC registration with licence to practise","requires_acknowledgement":true},
        {"id":"gp-004","type":"must_have","text":"Must have appropriate medical indemnity cover in place","requires_acknowledgement":true},
        {"id":"gp-005","type":"must_not","text":"Must not exceed the maximum reclaimable session rate as set in programme settings","requires_acknowledgement":false},
        {"id":"gp-006","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"gp-007","type":"condition","text":"Buy-back GPs must have matching Part B (LTC) delivery evidenced before payment is released","requires_acknowledgement":true},
        {"id":"gp-008","type":"condition","text":"Pro-rata applies if the GP started mid-month — only working days from start date are claimable","requires_acknowledgement":false},
        {"id":"gp-009","type":"information","text":"Session rate is based on £11,000 per session per annum plus employer on-costs (NI + Pension)","requires_acknowledgement":false},
        {"id":"gp-010","type":"information","text":"Claims must be submitted within 30 calendar days of the end of the claim month","requires_acknowledgement":false}
      ]'::jsonb)

      WHEN role->>'key' = 'anp' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"anp-001","type":"must_have","text":"Must hold current NMC registration","requires_acknowledgement":true},
        {"id":"anp-002","type":"must_have","text":"Must hold V300 Independent Prescriber qualification if undertaking prescribing duties","requires_acknowledgement":true},
        {"id":"anp-003","type":"must_have","text":"Must be working within scope of practice as defined by employer and professional body","requires_acknowledgement":true},
        {"id":"anp-004","type":"must_have","text":"Must have appropriate indemnity cover for the role","requires_acknowledgement":true},
        {"id":"anp-005","type":"must_not","text":"Must not exceed the maximum reclaimable rate (AfC Band 7 equivalent plus on-costs)","requires_acknowledgement":false},
        {"id":"anp-006","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"anp-007","type":"condition","text":"Buy-back ANPs must have matching Part B (LTC) delivery evidenced before payment is released","requires_acknowledgement":true},
        {"id":"anp-008","type":"information","text":"Rate is based on AfC Band 7 maximum plus employer on-costs","requires_acknowledgement":false}
      ]'::jsonb)

      WHEN role->>'key' = 'acp' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"acp-001","type":"must_have","text":"Must hold the HEE Advanced Clinical Practice digital badge","requires_acknowledgement":true},
        {"id":"acp-002","type":"must_have","text":"Must have current professional registration (GMC, NMC, or HCPC as applicable)","requires_acknowledgement":true},
        {"id":"acp-003","type":"must_have","text":"Must be working at AfC Band 8a or equivalent level","requires_acknowledgement":true},
        {"id":"acp-004","type":"must_have","text":"Must have appropriate indemnity cover for advanced practice role","requires_acknowledgement":true},
        {"id":"acp-005","type":"must_not","text":"Must not exceed the maximum reclaimable rate (AfC Band 8a equivalent plus on-costs)","requires_acknowledgement":false},
        {"id":"acp-006","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"acp-007","type":"condition","text":"Buy-back ACPs must have matching Part B (LTC) delivery evidenced before payment is released","requires_acknowledgement":true},
        {"id":"acp-008","type":"information","text":"Rate is based on AfC Band 8a maximum plus employer on-costs","requires_acknowledgement":false}
      ]'::jsonb)

      WHEN role->>'key' = 'practice_nurse' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"pn-001","type":"must_have","text":"Must hold current NMC registration","requires_acknowledgement":true},
        {"id":"pn-002","type":"must_have","text":"Must be working within agreed scope for the SDA programme","requires_acknowledgement":true},
        {"id":"pn-003","type":"must_have","text":"Must have appropriate indemnity cover","requires_acknowledgement":true},
        {"id":"pn-004","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"pn-005","type":"condition","text":"Buy-back staff must have matching Part B delivery evidenced","requires_acknowledgement":true},
        {"id":"pn-006","type":"information","text":"Rate is based on agreed band plus employer on-costs","requires_acknowledgement":false}
      ]'::jsonb)

      WHEN role->>'key' = 'hca' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"hca-001","type":"must_have","text":"Must have completed relevant training for duties being undertaken","requires_acknowledgement":true},
        {"id":"hca-002","type":"must_have","text":"Must be working under appropriate clinical supervision","requires_acknowledgement":true},
        {"id":"hca-003","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"hca-004","type":"condition","text":"Buy-back staff must have matching Part B delivery evidenced","requires_acknowledgement":true},
        {"id":"hca-005","type":"information","text":"Rate is based on agreed band plus employer on-costs","requires_acknowledgement":false}
      ]'::jsonb)

      WHEN role->>'key' = 'pharmacist' THEN role || jsonb_build_object('ground_rules', '[
        {"id":"ph-001","type":"must_have","text":"Must hold current GPhC registration","requires_acknowledgement":true},
        {"id":"ph-002","type":"must_have","text":"Must hold Independent Prescriber qualification if undertaking prescribing duties","requires_acknowledgement":true},
        {"id":"ph-003","type":"must_have","text":"Must have appropriate indemnity cover","requires_acknowledgement":true},
        {"id":"ph-004","type":"must_not","text":"Must not undertake LTC (Part B) activity during funded SDA (Part A) hours","requires_acknowledgement":true},
        {"id":"ph-005","type":"condition","text":"Buy-back staff must have matching Part B delivery evidenced","requires_acknowledgement":true},
        {"id":"ph-006","type":"information","text":"Rate is based on agreed band plus employer on-costs","requires_acknowledgement":false}
      ]'::jsonb)

      ELSE CASE
        WHEN role ? 'ground_rules' THEN role
        ELSE role || '{"ground_rules":[]}'::jsonb
      END
    END
  )
  FROM jsonb_array_elements(roles_config) AS role
)
WHERE id = 'default';