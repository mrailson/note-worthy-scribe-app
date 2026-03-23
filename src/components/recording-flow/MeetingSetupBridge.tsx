import React, { useEffect, useRef } from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import {
  persistRecordingSession,
  type PersistedRecordingSession,
} from '@/utils/recordingSessionPersistence';

interface MeetingSetupBridgeProps {
  isRecording: boolean;
  duration: number;
  onOpenImportModal: (tab?: string, editGroupId?: string) => void;
  /** Mutable ref that MeetingRecorder reads for persistence */
  contextRef?: React.MutableRefObject<{
    attendees: any[];
    agendaItems: any[];
    activeGroup: any;
    meetingType: string | null;
    meetingTitle: string | null;
  } | null>;
}

/**
 * Bridge component that syncs MeetingRecorder state with MeetingSetupContext.
 * Must be rendered inside both MeetingSetupProvider and MeetingRecorder.
 */
export const MeetingSetupBridge: React.FC<MeetingSetupBridgeProps> = ({
  isRecording,
  duration,
  onOpenImportModal,
  contextRef,
}) => {
  const { stage, setStage, setRecordingDuration, attendees, agendaItems, activeGroup, meetingType, meetingTitle } = useMeetingSetup();
  const wasRecordingRef = useRef(false);

  // Keep the external ref in sync so MeetingRecorder can read context
  useEffect(() => {
    if (contextRef) {
      contextRef.current = {
        attendees,
        agendaItems,
        activeGroup,
        meetingType,
        meetingTitle,
      };
    }
  }, [attendees, agendaItems, activeGroup, meetingType, meetingTitle, contextRef]);

  // Persist to localStorage whenever context changes during recording
  useEffect(() => {
    if (!isRecording) return;
    const currentMeetingId = sessionStorage.getItem('currentMeetingId');
    if (!currentMeetingId) return;

    const session: PersistedRecordingSession = {
      sessionId: currentMeetingId,
      startedAt: sessionStorage.getItem('recordingStartedAt') || new Date().toISOString(),
      attendees: attendees.map((a: any) => ({
        id: a.id,
        name: a.name,
        initials: a.initials || '',
        role: a.role || '',
        org: a.org || '',
        status: a.status || 'present',
        contact_id: a.contact_id,
      })),
      agendaItems: agendaItems.map((a: any) => ({ id: a.id, text: a.text })),
      groupId: activeGroup?.id || null,
      groupName: activeGroup?.name || null,
      meetingFormat: meetingType || null,
      meetingTitle: meetingTitle || null,
      status: 'recording',
      lastHeartbeat: new Date().toISOString(),
    };
    persistRecordingSession(session);
  }, [isRecording, attendees, agendaItems, activeGroup, meetingType, meetingTitle]);

  // Sync recording state → stage
  useEffect(() => {
    if (isRecording && stage === 'setup') {
      setStage('recording');
    }
    
    // Detect recording stop: was recording, now not
    if (wasRecordingRef.current && !isRecording) {
      // Only show done screen if there was context set up
      const hasContext = attendees.length > 0 || agendaItems.length > 0;
      if (hasContext) {
        setStage('done');
      } else {
        setStage('setup');
      }
    }
    
    wasRecordingRef.current = isRecording;
  }, [isRecording, stage, setStage, attendees.length, agendaItems.length]);

  // Sync duration
  useEffect(() => {
    setRecordingDuration(duration);
  }, [duration, setRecordingDuration]);

  return null;
};
