-- Populate existing meetings with sample overviews
INSERT INTO public.meeting_overviews (meeting_id, overview, created_by)
SELECT 
  m.id,
  CASE 
    WHEN m.meeting_type = 'patient-consultation' THEN 
      'Patient consultation covering health concerns, treatment options, and follow-up care planning'
    WHEN m.meeting_type = 'team-meeting' THEN 
      'Team meeting discussing workflow improvements, resource allocation, and staff coordination'
    WHEN m.meeting_type = 'clinical-review' THEN 
      'Clinical review session examining patient cases, treatment protocols, and medical best practices'
    WHEN m.meeting_type = 'training' THEN 
      'Training session focused on professional development, new procedures, and skill enhancement'
    WHEN m.meeting_type = 'pcn-meeting' THEN 
      'PCN meeting addressing primary care network initiatives, collaborative care, and local health priorities'
    WHEN m.meeting_type = 'icb-meeting' THEN 
      'ICB meeting discussing integrated care board strategies, funding, and regional health planning'
    WHEN m.meeting_type = 'neighbourhood-meeting' THEN 
      'Neighbourhood meeting covering community health needs, local services, and partnership working'
    WHEN m.meeting_type = 'federation' THEN 
      'Federation meeting focusing on shared services, joint initiatives, and collaborative decision-making'
    WHEN m.meeting_type = 'locality' THEN 
      'Locality meeting discussing area-specific health challenges, resource sharing, and local partnerships'
    WHEN m.meeting_type = 'lmc' THEN 
      'LMC meeting addressing GP representation, contract negotiations, and professional advocacy'
    WHEN m.meeting_type = 'gp-partners' THEN 
      'GP partners meeting covering practice management, business decisions, and strategic planning'
    ELSE 
      CASE 
        WHEN m.description IS NOT NULL AND LENGTH(TRIM(m.description)) > 0 THEN 
          'Meeting discussed: ' || 
          CASE 
            WHEN LENGTH(m.description) > 80 THEN 
              LEFT(m.description, 80) || '...'
            ELSE 
              m.description
          END
        ELSE 
          'General meeting covering operational matters, updates, and collaborative planning for improved service delivery'
      END
  END as overview,
  m.user_id
FROM public.meetings m
WHERE NOT EXISTS (
  SELECT 1 FROM public.meeting_overviews mo 
  WHERE mo.meeting_id = m.id
)
AND m.created_at IS NOT NULL;