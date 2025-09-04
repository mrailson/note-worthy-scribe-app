-- Update existing CQC evidence records to have the correct uploaded_by field
-- Set uploaded_by to the user who created the complaint
UPDATE cqc_evidence 
SET uploaded_by = (
  SELECT created_by 
  FROM complaints 
  WHERE reference_number = 'COMP250002'
)
WHERE title LIKE '%COMP250002%' 
AND uploaded_by IS NULL;