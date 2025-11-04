-- Phase 1.1: Update database functions to accept IP address and user agent
-- Phase 2.1: Add new columns for enhanced audit tracking

-- First, add new columns to complaint_audit_detailed table
ALTER TABLE complaint_audit_detailed 
  ADD COLUMN IF NOT EXISTS browser_name TEXT,
  ADD COLUMN IF NOT EXISTS browser_version TEXT,
  ADD COLUMN IF NOT EXISTS os_name TEXT,
  ADD COLUMN IF NOT EXISTS os_version TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS geographic_location TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_ip_address ON complaint_audit_detailed(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_session_id ON complaint_audit_detailed(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_device_type ON complaint_audit_detailed(device_type);
CREATE INDEX IF NOT EXISTS idx_audit_browser_name ON complaint_audit_detailed(browser_name);

-- Update log_complaint_view function to accept and store IP and user agent
CREATE OR REPLACE FUNCTION log_complaint_view(
  p_complaint_id UUID,
  p_view_context TEXT DEFAULT 'general',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    -- Insert audit log entry
    INSERT INTO complaint_audit_detailed (
      complaint_id,
      action_type,
      action_description,
      user_id,
      user_email,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      p_complaint_id,
      'view',
      'Complaint viewed - ' || p_view_context,
      v_user_id,
      v_user_email,
      p_ip_address,
      p_user_agent,
      NOW()
    );
  END IF;
END;
$$;

-- Update log_complaint_action function to accept and store IP and user agent
CREATE OR REPLACE FUNCTION log_complaint_action(
  p_complaint_id UUID,
  p_action_type TEXT,
  p_action_description TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO complaint_audit_detailed (
      complaint_id,
      action_type,
      action_description,
      user_id,
      user_email,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      p_complaint_id,
      p_action_type,
      p_action_description,
      v_user_id,
      v_user_email,
      p_old_values,
      p_new_values,
      p_ip_address,
      p_user_agent,
      NOW()
    );
  END IF;
END;
$$;

-- Update log_complaint_document_action function to accept and store IP and user agent
CREATE OR REPLACE FUNCTION log_complaint_document_action(
  p_complaint_id UUID,
  p_action_type TEXT,
  p_document_name TEXT,
  p_document_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO complaint_audit_detailed (
      complaint_id,
      action_type,
      action_description,
      user_id,
      user_email,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      p_complaint_id,
      p_action_type,
      'Document: ' || p_document_name,
      v_user_id,
      v_user_email,
      p_ip_address,
      p_user_agent,
      NOW()
    );
  END IF;
END;
$$;