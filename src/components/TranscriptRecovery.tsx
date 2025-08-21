import React, { useEffect } from 'react';
import { recoverMeetingTranscript } from '@/utils/recoverTranscript';
import { toast } from 'sonner';

interface TranscriptRecoveryProps {
  meetingId: string;
  onRecoveryComplete?: () => void;
}

export const TranscriptRecovery: React.FC<TranscriptRecoveryProps> = ({ 
  meetingId, 
  onRecoveryComplete 
}) => {
  useEffect(() => {
    const performRecovery = async () => {
      try {
        console.log('🔄 Starting transcript recovery for:', meetingId);
        const result = await recoverMeetingTranscript(meetingId);
        
        if (result?.success) {
          console.log('✅ Recovery successful:', result);
          toast.success(`Recovery complete! Created ${result.chunksCreated} transcript chunks`);
          onRecoveryComplete?.();
        }
      } catch (error) {
        console.error('❌ Recovery failed:', error);
        toast.error('Recovery failed: ' + (error as Error).message);
      }
    };

    if (meetingId) {
      performRecovery();
    }
  }, [meetingId, onRecoveryComplete]);

  return null; // This is a utility component, no UI needed
};

// Auto-recovery for the specific meeting
if (typeof window !== 'undefined') {
  const autoRecover = async () => {
    try {
      const meetingId = 'f0d0d35b-85a1-4e59-9186-8c33e79d8b24';
      const result = await recoverMeetingTranscript(meetingId);
      console.log('🎯 Auto-recovery result:', result);
    } catch (error) {
      console.error('Auto-recovery failed:', error);
    }
  };
  
  // Run after a short delay to ensure modules are loaded
  setTimeout(autoRecover, 2000);
}