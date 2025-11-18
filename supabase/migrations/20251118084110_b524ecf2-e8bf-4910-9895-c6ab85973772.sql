-- Phase 1: Meeting Manager Tables - HIGHEST PRIORITY
-- Fix meetings table - ALL operations currently allow public role
DROP POLICY IF EXISTS "Users can view meetings they own or that are shared with them" ON meetings;
DROP POLICY IF EXISTS "Users can create their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;

CREATE POLICY "meetings_select_authenticated" ON meetings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR id IN (
      SELECT meeting_id FROM meeting_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "meetings_insert_authenticated" ON meetings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meetings_update_authenticated" ON meetings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meetings_delete_authenticated" ON meetings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Fix meeting_transcripts table - DELETE operation allows public
DROP POLICY IF EXISTS "Meeting owners can delete transcripts" ON meeting_transcripts;

CREATE POLICY "meeting_transcripts_delete_authenticated" ON meeting_transcripts
  FOR DELETE TO authenticated
  USING (
    meeting_id IN (SELECT id FROM meetings WHERE user_id = auth.uid())
  );

-- Phase 2: User Data & Sessions Tables
-- Fix profiles table - Most operations allow public role
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Practice managers can view users in their practice" ON profiles;
DROP POLICY IF EXISTS "Practice and PCN managers can view users in their practice" ON profiles;
DROP POLICY IF EXISTS "Practice and PCN managers can update users in their practice" ON profiles;
DROP POLICY IF EXISTS "Practice managers can update users in their practice" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "profiles_select_practice" ON profiles
  FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT ur.user_id FROM user_roles ur
      WHERE ur.practice_id = ANY(get_user_practice_ids(auth.uid()))
    )
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_practice_managers" ON profiles
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT ur.user_id FROM user_roles ur
      WHERE ur.practice_id = ANY(get_user_practice_ids(auth.uid()))
    )
    AND (has_role(auth.uid(), 'practice_manager'::app_role) OR is_system_admin(auth.uid()))
  );

-- Fix user_sessions table - ALL operations allow public role
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Practice managers can view sessions for their practice" ON user_sessions;
DROP POLICY IF EXISTS "Practice managers can view practice user sessions" ON user_sessions;
DROP POLICY IF EXISTS "System admins can view all sessions" ON user_sessions;
DROP POLICY IF EXISTS "System admins can manage all sessions" ON user_sessions;

CREATE POLICY "user_sessions_select_own" ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_sessions_insert_own" ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_sessions_update_own" ON user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_sessions_delete_own" ON user_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_sessions_admins_all" ON user_sessions
  FOR ALL TO authenticated
  USING (is_system_admin(auth.uid()));

-- Phase 3: Clinical Data Tables
-- Fix consultation_notes table - INSERT, SELECT, UPDATE allow public
DROP POLICY IF EXISTS "Users can create consultation notes" ON consultation_notes;
DROP POLICY IF EXISTS "Users can view their own consultation notes" ON consultation_notes;
DROP POLICY IF EXISTS "Users can update their own consultation notes" ON consultation_notes;

CREATE POLICY "consultation_notes_all_authenticated" ON consultation_notes
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Fix genie_sessions table - ALL operations allow public
DROP POLICY IF EXISTS "Users can view their own genie sessions" ON genie_sessions;
DROP POLICY IF EXISTS "Users can insert their own genie sessions" ON genie_sessions;
DROP POLICY IF EXISTS "Users can update their own genie sessions" ON genie_sessions;
DROP POLICY IF EXISTS "Users can delete their own genie sessions" ON genie_sessions;

CREATE POLICY "genie_sessions_all_authenticated" ON genie_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Phase 4: Complaints System Tables
-- Fix complaints table - DELETE operation allows public
DROP POLICY IF EXISTS "System admins can delete complaints" ON complaints;

CREATE POLICY "complaints_delete_admins" ON complaints
  FOR DELETE TO authenticated
  USING (is_system_admin(auth.uid()));

-- Fix complaint_involved_parties table - SELECT allows public
DROP POLICY IF EXISTS "Users can view involved parties for their practice complaints" ON complaint_involved_parties;

CREATE POLICY "complaint_involved_parties_select_authenticated" ON complaint_involved_parties
  FOR SELECT TO authenticated
  USING (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid()))) 
         OR (c.created_by = auth.uid())
    )
  );

-- Fix complaint_signatures table - INSERT, UPDATE, DELETE allow public
DROP POLICY IF EXISTS "Users can create their own signatures" ON complaint_signatures;
DROP POLICY IF EXISTS "Users can update their own signatures" ON complaint_signatures;
DROP POLICY IF EXISTS "Users can delete their own signatures" ON complaint_signatures;

CREATE POLICY "complaint_signatures_insert_authenticated" ON complaint_signatures
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "complaint_signatures_update_authenticated" ON complaint_signatures
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "complaint_signatures_delete_authenticated" ON complaint_signatures
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Fix complaint_team_members table - ALL operations allow public
DROP POLICY IF EXISTS "Users can view their own team members" ON complaint_team_members;
DROP POLICY IF EXISTS "Users can insert their own team members" ON complaint_team_members;
DROP POLICY IF EXISTS "Users can update their own team members" ON complaint_team_members;
DROP POLICY IF EXISTS "Users can delete their own team members" ON complaint_team_members;

CREATE POLICY "complaint_team_members_all_authenticated" ON complaint_team_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());