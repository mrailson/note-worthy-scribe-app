import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { MeetingAttendee, MeetingGroup } from '@/types/contactTypes';

export interface AgendaItem {
  id: string;
  text: string;
}

export type ContextUpdateType = 'group' | 'attendance' | 'agenda' | null;

interface MeetingSetupContextType {
  // Stage
  stage: 'setup' | 'recording' | 'done';
  setStage: (s: 'setup' | 'recording' | 'done') => void;

  // Attendees
  attendees: MeetingAttendee[];
  setAttendees: React.Dispatch<React.SetStateAction<MeetingAttendee[]>>;

  // Agenda
  agendaItems: AgendaItem[];
  setAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  addAgendaItem: (text: string) => void;
  removeAgendaItem: (id: string) => void;

  // Active group
  activeGroup: MeetingGroup | null;
  setActiveGroup: (g: MeetingGroup | null) => void;

  // Meeting metadata (extracted from AI)
  meetingType: 'remote' | 'face-to-face' | 'hybrid' | null;
  setMeetingType: (t: 'remote' | 'face-to-face' | 'hybrid' | null) => void;
  meetingLocation: string | null;
  setMeetingLocation: (l: string | null) => void;
  meetingTitle: string | null;
  setMeetingTitle: (t: string | null) => void;

  // Computed counts
  presentCount: number;
  apologiesCount: number;
  absentCount: number;

  // Pulse tracking
  lastUpdate: ContextUpdateType;
  triggerUpdate: (type: ContextUpdateType) => void;

  // Confirmation flash
  confirmationMessage: string | null;
  showConfirmation: (msg: string) => void;

  // Toggle attendee status
  toggleAttendeeStatus: (id: number | string) => void;

  // Load group
  loadGroup: (group: MeetingGroup, contacts: any[]) => void;

  // Reset
  resetSetup: () => void;

  // Recording time (managed externally but exposed)
  recordingDuration: number;
  setRecordingDuration: (d: number) => void;
}

const MeetingSetupContext = createContext<MeetingSetupContextType | undefined>(undefined);

export const useMeetingSetup = () => {
  const ctx = useContext(MeetingSetupContext);
  if (!ctx) throw new Error('useMeetingSetup must be used within MeetingSetupProvider');
  return ctx;
};

export const MeetingSetupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stage, setStage] = useState<'setup' | 'recording' | 'done'>('setup');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [activeGroup, setActiveGroup] = useState<MeetingGroup | null>(null);
  const [meetingType, setMeetingType] = useState<'remote' | 'face-to-face' | 'hybrid' | null>(null);
  const [meetingLocation, setMeetingLocation] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<ContextUpdateType>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentCount = attendees.filter(a => a.status === 'present').length;
  const apologiesCount = attendees.filter(a => a.status === 'apologies').length;
  const absentCount = attendees.filter(a => a.status === 'absent').length;

  const triggerUpdate = useCallback((type: ContextUpdateType) => {
    setLastUpdate(type);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setLastUpdate(null), 600);
  }, []);

  const showConfirmation = useCallback((msg: string) => {
    setConfirmationMessage(msg);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmationMessage(null), 2500);
  }, []);

  const addAgendaItem = useCallback((text: string) => {
    setAgendaItems(prev => [...prev, { id: Date.now().toString(), text }]);
    triggerUpdate('agenda');
    if (stage === 'recording') {
      showConfirmation('Agenda item added — AI will use this to segment the transcript');
    }
  }, [triggerUpdate, showConfirmation, stage]);

  const removeAgendaItem = useCallback((id: string) => {
    setAgendaItems(prev => prev.filter(item => item.id !== id));
    triggerUpdate('agenda');
  }, [triggerUpdate]);

  const toggleAttendeeStatus = useCallback((id: number | string) => {
    const statuses: Array<'present' | 'apologies' | 'absent'> = ['present', 'apologies', 'absent'];
    setAttendees(prev => prev.map(a => {
      if (a.id === id) {
        const nextIdx = (statuses.indexOf(a.status) + 1) % statuses.length;
        return { ...a, status: statuses[nextIdx] };
      }
      return a;
    }));
    triggerUpdate('attendance');
    if (stage === 'recording') {
      showConfirmation('Attendance updated — will reflect in session report');
    }
  }, [triggerUpdate, showConfirmation, stage]);

  const loadGroup = useCallback((group: MeetingGroup, contacts: any[]) => {
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    const newAttendees: MeetingAttendee[] = [];

    for (const contactId of group.contact_ids) {
      const contact = contactMap.get(contactId);
      if (contact && !newAttendees.find(a => a.contact_id === contactId)) {
        newAttendees.push({
          id: contactId,
          name: contact.name,
          initials: contact.initials || contact.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
          role: contact.default_role || 'Guest',
          org: contact.org || '',
          status: 'present',
          contact_id: contactId,
        });
      }
    }

    const contactsByName = new Map(contacts.map(c => [c.name?.toLowerCase(), c]));
    for (const member of (group.additional_members || [])) {
      if (!newAttendees.find(a => a.name === member.name)) {
        const matchedContact = contactsByName.get(member.name?.toLowerCase());
        const freshName = matchedContact?.name || member.name;
        const freshInitials = matchedContact?.initials || member.initials || freshName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
        newAttendees.push({
          id: matchedContact?.id || `add-${Date.now()}-${Math.random()}`,
          name: freshName,
          initials: freshInitials,
          role: matchedContact?.default_role || member.role || 'Guest',
          org: matchedContact?.org || member.org || '',
          status: 'present',
          contact_id: matchedContact?.id,
        });
      }
    }

    setAttendees(prev => {
      const existingIds = new Set(prev.map(a => a.name));
      const merged = [...prev];
      for (const a of newAttendees) {
        if (!existingIds.has(a.name)) {
          merged.push(a);
        }
      }
      return merged;
    });

    setActiveGroup(group);
    triggerUpdate('group');
    if (stage === 'recording') {
      showConfirmation('Meeting group loaded — attendees added to session');
    }
  }, [triggerUpdate, showConfirmation, stage]);

  const resetSetup = useCallback(() => {
    setStage('setup');
    setAttendees([]);
    setAgendaItems([]);
    setActiveGroup(null);
    setMeetingType(null);
    setMeetingLocation(null);
    setMeetingTitle(null);
    setLastUpdate(null);
    setConfirmationMessage(null);
    setRecordingDuration(0);
  }, []);

  return (
    <MeetingSetupContext.Provider value={{
      stage, setStage,
      attendees, setAttendees,
      agendaItems, setAgendaItems,
      addAgendaItem, removeAgendaItem,
      activeGroup, setActiveGroup,
      meetingType, setMeetingType,
      meetingLocation, setMeetingLocation,
      meetingTitle, setMeetingTitle,
      presentCount, apologiesCount, absentCount,
      lastUpdate, triggerUpdate,
      confirmationMessage, showConfirmation,
      toggleAttendeeStatus, loadGroup,
      resetSetup,
      recordingDuration, setRecordingDuration,
    }}>
      {children}
    </MeetingSetupContext.Provider>
  );
};
