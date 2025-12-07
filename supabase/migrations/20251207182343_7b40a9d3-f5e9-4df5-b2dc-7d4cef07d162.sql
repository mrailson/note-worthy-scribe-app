-- Fix Gail Evans NHS number (validated using Mod 11: 4466563365 passes checksum)
UPDATE lg_patients 
SET 
  nhs_number = '4466563365',
  ai_extracted_nhs = '4466563365',
  nhs_number_validated = true,
  identity_verification_status = 'verified'
WHERE id = '01KBX0AXAH7GF9KZS2M55CR1QS';