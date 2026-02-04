
-- Fix Chris Grahame's gp_scribe module access
-- The user_modules.user_id should match auth.users.id (which is profiles.user_id)
-- Currently granted to wrong ID: 572c8b08-0938-45a6-a115-ef67274e5a3e (profiles.id)
-- Should be granted to: bcf005ff-d538-437b-b7a0-90f7e2b0e612 (auth.users.id / profiles.user_id)

INSERT INTO public.user_modules (user_id, module, enabled)
VALUES ('bcf005ff-d538-437b-b7a0-90f7e2b0e612', 'gp_scribe', true)
ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;
