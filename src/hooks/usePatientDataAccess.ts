/**
 * Hook for managing NHS-compliant patient data access
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logPatientDataAccess } from '@/utils/patientDataMasking';

interface PatientDataAccessSession {
  complaintId: string;
  startTime: Date;
  expiresAt: Date;
  accessReason: string;
  justification: string;
}

interface UsePatientDataAccessOptions {
  sessionDurationMinutes?: number;
  userRole?: string | null;
}

export function usePatientDataAccess(options: UsePatientDataAccessOptions = {}) {
  const { sessionDurationMinutes = 30, userRole } = options;
  
  const [activeSessions, setActiveSessions] = useState<Map<string, PatientDataAccessSession>>(new Map());
  const [showDisclosureDialog, setShowDisclosureDialog] = useState(false);
  const [pendingAccess, setPendingAccess] = useState<{
    complaintId: string;
    patientName: string;
    complaintReference: string;
    onApprove: () => void;
  } | null>(null);

  // Check for expired sessions every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      activeSessions.forEach((session, complaintId) => {
        if (now > session.expiresAt) {
          expiredSessions.push(complaintId);
        }
      });

      if (expiredSessions.length > 0) {
        setActiveSessions(prev => {
          const updated = new Map(prev);
          expiredSessions.forEach(id => updated.delete(id));
          return updated;
        });

        toast.info(`Patient data access expired for ${expiredSessions.length} complaint(s)`);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeSessions]);

  // Log session activity to Supabase
  const logAccessToDatabase = useCallback(async (
    complaintId: string, 
    accessType: 'granted' | 'expired' | 'revoked',
    details: any
  ) => {
    try {
      await supabase.functions.invoke('log-security-event', {
        body: {
          eventType: 'patient_data_access',
          severity: 'medium',
          eventDetails: {
            complaintId,
            accessType,
            sessionDurationMinutes,
            userRole,
            ...details
          }
        }
      });
    } catch (error) {
      console.error('Failed to log patient data access:', error);
    }
  }, [sessionDurationMinutes, userRole]);

  // Request access to patient data
  const requestPatientDataAccess = useCallback((
    complaintId: string,
    patientName: string,
    complaintReference: string,
    onAccessGranted: () => void
  ) => {
    // Check if session already active
    if (activeSessions.has(complaintId)) {
      const session = activeSessions.get(complaintId)!;
      if (new Date() < session.expiresAt) {
        onAccessGranted();
        return;
      }
    }

    // Show disclosure dialog
    setPendingAccess({
      complaintId,
      patientName,
      complaintReference,
      onApprove: onAccessGranted
    });
    setShowDisclosureDialog(true);
  }, [activeSessions]);

  // Approve access after disclosure
  const approveAccess = useCallback((justification: string, accessReason: string) => {
    if (!pendingAccess) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionDurationMinutes * 60 * 1000);

    const session: PatientDataAccessSession = {
      complaintId: pendingAccess.complaintId,
      startTime: now,
      expiresAt,
      accessReason,
      justification
    };

    setActiveSessions(prev => new Map(prev).set(pendingAccess.complaintId, session));

    // Log the access grant
    logPatientDataAccess(
      pendingAccess.complaintId,
      'full_view',
      pendingAccess.patientName,
      'current-user-id' // This should be the actual user ID
    );

    logAccessToDatabase(pendingAccess.complaintId, 'granted', {
      justification,
      accessReason,
      sessionDuration: sessionDurationMinutes,
      expiresAt: expiresAt.toISOString()
    });

    toast.success(`Patient data access granted for ${sessionDurationMinutes} minutes`);

    // Execute the callback
    pendingAccess.onApprove();

    // Clean up
    setShowDisclosureDialog(false);
    setPendingAccess(null);
  }, [pendingAccess, sessionDurationMinutes, logAccessToDatabase]);

  // Revoke access for a specific complaint
  const revokeAccess = useCallback((complaintId: string) => {
    const session = activeSessions.get(complaintId);
    if (session) {
      setActiveSessions(prev => {
        const updated = new Map(prev);
        updated.delete(complaintId);
        return updated;
      });

      logAccessToDatabase(complaintId, 'revoked', {
        sessionDuration: Math.round((new Date().getTime() - session.startTime.getTime()) / 60000)
      });

      toast.info('Patient data access revoked');
    }
  }, [activeSessions, logAccessToDatabase]);

  // Check if access is active for a complaint
  const hasActiveAccess = useCallback((complaintId: string): boolean => {
    const session = activeSessions.get(complaintId);
    if (!session) return false;
    return new Date() < session.expiresAt;
  }, [activeSessions]);

  // Get remaining time for a session
  const getTimeRemaining = useCallback((complaintId: string): number | null => {
    const session = activeSessions.get(complaintId);
    if (!session) return null;
    
    const remaining = session.expiresAt.getTime() - new Date().getTime();
    return remaining > 0 ? remaining : 0;
  }, [activeSessions]);

  // Get active session count
  const getActiveSessionCount = useCallback((): number => {
    const now = new Date();
    let count = 0;
    activeSessions.forEach(session => {
      if (now < session.expiresAt) count++;
    });
    return count;
  }, [activeSessions]);

  return {
    // State
    showDisclosureDialog,
    pendingAccess,
    
    // Actions
    requestPatientDataAccess,
    approveAccess,
    revokeAccess,
    setShowDisclosureDialog,
    
    // Queries
    hasActiveAccess,
    getTimeRemaining,
    getActiveSessionCount,
    
    // Session management
    activeSessions: Array.from(activeSessions.values())
  };
}