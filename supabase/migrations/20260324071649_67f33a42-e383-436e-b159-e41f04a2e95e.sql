-- Assign member_practice for Hayley and Dal to Springfield Surgery
UPDATE nres_claimants 
SET member_practice = 'Springfield Surgery'
WHERE id IN ('b6713df7-35b1-47e6-b0d8-27f2d4f4aab9', '94c37c78-b6da-4d4c-a0a4-6eaa279de06a');

-- Assign member_practice for William Hunt to Bugbrooke Medical Practice (already set, but ensure practice_id is correct too)
UPDATE nres_claimants 
SET member_practice = 'Bugbrooke Medical Practice',
    practice_id = '85cd140c-2980-40df-8e19-0ffc8a9346d5'
WHERE id = '40d1850d-dc99-47ce-9b7a-5edc0f990832';