import { UAParser } from 'ua-parser-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Audit metadata structure
 */
export interface AuditMetadata {
  ip_address: string;
  user_agent: string;
  browser_name: string;
  browser_version: string;
  os_name: string;
  os_version: string;
  device_type: string;
  screen_resolution: string;
  timezone: string;
  language: string;
  session_id: string;
  geographic_location: string | null;
  device_fingerprint: string;
  referrer: string | null;
}

/**
 * Parse user agent string to extract browser, OS, and device information
 */
export const getBrowserInfo = () => {
  const parser = new UAParser();
  const result = parser.getResult();
  
  return {
    browser_name: result.browser.name || 'Unknown',
    browser_version: result.browser.version || 'Unknown',
    os_name: result.os.name || 'Unknown',
    os_version: result.os.version || 'Unknown',
    device_type: result.device.type || 'desktop', // defaults to desktop if not mobile/tablet
    user_agent: navigator.userAgent
  };
};

/**
 * Generate a semi-unique device fingerprint based on browser capabilities
 * Note: This is not cryptographically secure, just for tracking purposes
 */
export const getDeviceFingerprint = (): string => {
  const screen = window.screen;
  const nav = navigator;
  
  const fingerprint = [
    screen.width,
    screen.height,
    screen.colorDepth,
    nav.language,
    nav.hardwareConcurrency || 'unknown',
    new Date().getTimezoneOffset(),
    nav.platform
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
};

/**
 * Get or create a session ID
 */
export const getSessionInfo = () => {
  const SESSION_KEY = 'audit_session_id';
  let session_id = sessionStorage.getItem(SESSION_KEY);
  
  if (!session_id) {
    session_id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, session_id);
  }
  
  return {
    session_id,
    referrer: document.referrer || null
  };
};

/**
 * Get client IP address and geographic location from edge function
 */
const getClientInfo = async (): Promise<{ 
  ip_address: string; 
  geographic_location: string | null;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-client-info', {
      method: 'GET'
    });
    
    if (error) {
      console.warn('Failed to get client info:', error);
      return { ip_address: 'unknown', geographic_location: null };
    }
    
    return {
      ip_address: data?.ip_address || 'unknown',
      geographic_location: data?.country || data?.geographic_location || null
    };
  } catch (error) {
    console.warn('Error calling get-client-info:', error);
    return { ip_address: 'unknown', geographic_location: null };
  }
};

/**
 * Collect all audit metadata
 * This is the main function to call when logging audit events
 */
export const getAuditMetadata = async (): Promise<AuditMetadata> => {
  const browserInfo = getBrowserInfo();
  const sessionInfo = getSessionInfo();
  const deviceFingerprint = getDeviceFingerprint();
  const clientInfo = await getClientInfo();
  
  const screen = window.screen;
  const nav = navigator;
  
  return {
    // Network info
    ip_address: clientInfo.ip_address,
    geographic_location: clientInfo.geographic_location,
    
    // Browser info
    user_agent: browserInfo.user_agent,
    browser_name: browserInfo.browser_name,
    browser_version: browserInfo.browser_version,
    os_name: browserInfo.os_name,
    os_version: browserInfo.os_version,
    device_type: browserInfo.device_type,
    
    // Device info
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: nav.language || 'unknown',
    device_fingerprint: deviceFingerprint,
    
    // Session info
    session_id: sessionInfo.session_id,
    referrer: sessionInfo.referrer
  };
};

/**
 * Enhanced logging function for complaint views with full metadata
 */
export const logComplaintViewWithMetadata = async (
  complaintId: string,
  viewContext: string = 'general'
) => {
  try {
    const metadata = await getAuditMetadata();
    
    await supabase.rpc('log_complaint_view', {
      p_complaint_id: complaintId,
      p_view_context: viewContext,
      p_ip_address: metadata.ip_address,
      p_user_agent: metadata.user_agent
    });
    
    // Store full metadata in a separate action log for detailed tracking
    await supabase.rpc('log_complaint_action', {
      p_complaint_id: complaintId,
      p_action_type: 'view_detailed',
      p_action_description: `Complaint viewed - ${viewContext}`,
      p_new_values: metadata as any,
      p_ip_address: metadata.ip_address,
      p_user_agent: metadata.user_agent
    });
  } catch (error) {
    console.error('Error logging complaint view:', error);
  }
};

/**
 * Enhanced logging function for complaint actions with full metadata
 */
export const logComplaintActionWithMetadata = async (
  complaintId: string,
  actionType: string,
  actionDescription: string,
  oldValues?: any,
  newValues?: any
) => {
  try {
    const metadata = await getAuditMetadata();
    
    // Merge metadata with any existing new_values
    const enrichedNewValues = {
      ...newValues,
      _audit_metadata: metadata
    };
    
    await supabase.rpc('log_complaint_action', {
      p_complaint_id: complaintId,
      p_action_type: actionType,
      p_action_description: actionDescription,
      p_old_values: oldValues || null,
      p_new_values: enrichedNewValues,
      p_ip_address: metadata.ip_address,
      p_user_agent: metadata.user_agent
    });
  } catch (error) {
    console.error('Error logging complaint action:', error);
  }
};

/**
 * Enhanced logging function for document actions with full metadata
 */
export const logDocumentActionWithMetadata = async (
  complaintId: string,
  actionType: string,
  documentName: string,
  documentId?: string
) => {
  try {
    const metadata = await getAuditMetadata();
    
    await supabase.rpc('log_complaint_document_action', {
      p_complaint_id: complaintId,
      p_action_type: actionType,
      p_document_name: documentName,
      p_document_id: documentId || null,
      p_ip_address: metadata.ip_address,
      p_user_agent: metadata.user_agent
    });
  } catch (error) {
    console.error('Error logging document action:', error);
  }
};
