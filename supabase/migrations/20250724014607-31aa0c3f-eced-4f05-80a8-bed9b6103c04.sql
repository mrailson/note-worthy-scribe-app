-- Manually delete Julia Railson and all related data
-- This will handle all the foreign key constraints properly

-- Delete all records that reference this user
DELETE FROM complaint_templates WHERE created_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM complaint_audit_log WHERE performed_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM complaint_notes WHERE created_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM complaint_responses WHERE sent_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM complaint_documents WHERE uploaded_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
UPDATE complaints SET assigned_to = NULL WHERE assigned_to = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM complaints WHERE created_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM meeting_overviews WHERE created_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM meetings WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM nhs_terms WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM pcn_manager_practices WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
UPDATE user_roles SET assigned_by = NULL WHERE assigned_by = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM user_roles WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM system_audit_log WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';
DELETE FROM profiles WHERE user_id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';

-- Finally delete from auth.users
DELETE FROM auth.users WHERE id = 'cf99203a-fece-4c66-ae1e-9cd881bd753a';