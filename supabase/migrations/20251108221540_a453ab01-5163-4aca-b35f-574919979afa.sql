-- Update existing complaints with null practice_id to use the creator's practice
UPDATE public.complaints c
SET practice_id = (
  SELECT ur.practice_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = c.created_by 
  AND ur.practice_id IS NOT NULL
  LIMIT 1
)
WHERE c.practice_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM public.user_roles ur 
  WHERE ur.user_id = c.created_by 
  AND ur.practice_id IS NOT NULL
);