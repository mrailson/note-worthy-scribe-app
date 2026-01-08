// Types for NRES Dashboard user access management

export interface NRESUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  practice_name: string | null;
  activated_at: string;
}

export interface NRESSubmenuAccess {
  id: string;
  user_id: string;
  submenu_key: NRESSubmenuKey;
  granted_at: string;
  granted_by: string | null;
}

// Available sub-menus within NRES Dashboard for future access control
export type NRESSubmenuKey = 
  | 'evidence_library'
  | 'hours_tracker'
  | 'action_log'
  | 'dashboard_overview'
  | 'reports'
  | 'settings';

export const NRES_SUBMENU_LABELS: Record<NRESSubmenuKey, string> = {
  evidence_library: 'Evidence Library',
  hours_tracker: 'Hours Tracker',
  action_log: 'Action Log',
  dashboard_overview: 'Dashboard Overview',
  reports: 'Reports',
  settings: 'Settings',
};
