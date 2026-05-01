INSERT INTO public.nres_buyback_access (user_id, practice_key, access_role, granted_by)
SELECT 'a00bf2e7-4006-4037-97b8-68169b4ef158'::uuid, pk, 'approver', 'system:granted_for_andrew_moore'
FROM (VALUES ('bt_pcn'),('brackley'),('brook'),('towcester'),('springfield'),('bugbrooke'),('denton'),('parks')) AS t(pk);