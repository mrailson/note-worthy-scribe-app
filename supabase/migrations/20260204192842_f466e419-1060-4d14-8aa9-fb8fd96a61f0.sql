-- Sync existing session elements with updated templates for Well-Led domain
UPDATE public.mock_inspection_elements 
SET evidence_guidance = t.evidence_guidance
FROM public.mock_inspection_element_templates t
WHERE mock_inspection_elements.domain = t.domain 
  AND mock_inspection_elements.element_key = t.element_key
  AND mock_inspection_elements.domain = 'well_led';