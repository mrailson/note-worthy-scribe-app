-- Update all ICB PDF URLs to the new ICN URL
UPDATE public.prior_approval_criteria 
SET icb_pdf_url = 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342'
WHERE icb_pdf_url IS NOT NULL;