-- Update all prior approval links to the new ICN URL
UPDATE public.prior_approval_criteria 
SET link = 'https://www.icnorthamptonshire.org.uk/download.cfm?doc=docm93jijm4n22499&ver=66342'
WHERE link IS NOT NULL;