
-- Grant gp_scribe module access to Chris Grahame
INSERT INTO user_modules (user_id, module, enabled, granted_at, granted_by)
VALUES ('572c8b08-0938-45a6-a115-ef67274e5a3e', 'gp_scribe', true, now(), null)
ON CONFLICT (user_id, module) DO UPDATE SET enabled = true, updated_at = now();
