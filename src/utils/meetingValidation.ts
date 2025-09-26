// Meeting validation utilities to prevent data crossover
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MeetingValidationResult {
  isValid: boolean;
  error?: string;
  meetingId?: string;
}

/**
 * Validates a meeting ID format and user access
 */
export const validateMeetingAccess = async (
  meetingId: string | undefined,
  userId: string | undefined
): Promise<MeetingValidationResult> => {
  // Check basic parameters
  if (!meetingId || !userId) {
    return {
      isValid: false,
      error: 'Missing meeting ID or user ID'
    };
  }

  // Validate meeting ID format (UUID)
  if (typeof meetingId !== 'string' || meetingId.length !== 36) {
    return {
      isValid: false,
      error: 'Invalid meeting ID format',
      meetingId
    };
  }

  try {
    // Use the database function to validate access
    const { data: accessValid, error } = await supabase.rpc('validate_meeting_access', {
      p_meeting_id: meetingId,
      p_user_id: userId
    });

    if (error) {
      console.error('❌ Error validating meeting access:', error);
      return {
        isValid: false,
        error: 'Database validation failed',
        meetingId
      };
    }

    if (!accessValid) {
      return {
        isValid: false,
        error: 'Access denied to meeting',
        meetingId
      };
    }

    return {
      isValid: true,
      meetingId
    };
  } catch (error) {
    console.error('❌ Exception during meeting validation:', error);
    return {
      isValid: false,
      error: 'Validation exception occurred',
      meetingId
    };
  }
};

/**
 * Validates that a meeting belongs to the expected user before data operations
 */
export const validateMeetingOwnership = async (
  meetingId: string,
  expectedUserId: string
): Promise<boolean> => {
  try {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, user_id, title')
      .eq('id', meetingId)
      .eq('user_id', expectedUserId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking meeting ownership:', error);
      return false;
    }

    if (!meeting) {
      console.error('❌ Meeting not found or not owned by user:', meetingId, expectedUserId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Exception during ownership validation:', error);
    return false;
  }
};

/**
 * Detects potential meeting data crossover issues
 */
export const detectDataCrossover = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase.rpc('detect_meeting_data_crossover');
    
    if (error) {
      console.error('❌ Error detecting data crossover:', error);
      return [];
    }

    const crossoverIssues = data?.filter((item: any) => item.potential_crossover) || [];
    
    if (crossoverIssues.length > 0) {
      console.warn('⚠️ Potential data crossover detected:', crossoverIssues);
      toast.error(`Detected ${crossoverIssues.length} potential data crossover issues`);
    }

    return crossoverIssues;
  } catch (error) {
    console.error('❌ Exception during crossover detection:', error);
    return [];
  }
};

/**
 * Clears any potentially stale meeting data from local state
 */
export const clearMeetingCache = () => {
  // Clear any meeting-related data from localStorage
  const keysToRemove = Object.keys(localStorage).filter(key => 
    key.includes('meeting') || key.includes('transcript') || key.includes('notes')
  );
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('🧹 Cleared meeting cache:', keysToRemove.length, 'items removed');
};

/**
 * Generates a cache-busting timestamp for queries
 */
export const getCacheBustingParam = (): string => {
  return `_cb=${Date.now()}`;
};