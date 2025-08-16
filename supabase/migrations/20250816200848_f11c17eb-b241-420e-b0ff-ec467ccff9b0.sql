-- Simply update the GP Scribe access flag for your user
UPDATE user_roles 
SET gp_scribe_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';