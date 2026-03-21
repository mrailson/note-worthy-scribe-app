import React, { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronLeft, ChevronRight, Plus, Loader2, Upload, FileText, ClipboardPaste, MapPin, Video, Users2, RotateCcw, Trash2, UsersRound } from 'lucide-react';
import { useMeetingSetup } from './MeetingSetupContext';
import { ContextStatusPill } from './ContextStatusPill';
import { AvatarStack } from './AvatarStack';
import { useContacts } from '@/hooks/useContacts';
import { useMeetingGroups } from '@/hooks/useMeetingGroups';
import { SPEAKER_COLORS } from '@/types/contactTypes';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import type { MeetingGroup } from '@/types/contactTypes';

const GROUPS_PER_PAGE = 5;

const ACCEPTED_FILE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

const MEETING_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; colour: string }> = {
  'remote': { label: 'Remote', icon: <Video className="h-3 w-3" />, colour: '#3B82F6' },
  'face-to-face': { label: 'Face to Face', icon: <Users2 className="h-3 w-3" />, colour: '#10B981' },
  'hybrid': { label: 'Hybrid', icon: <Video className="h-3 w-3" />, colour: '#8B5CF6' },
};

interface PreMeetingSetupProps {
  onStartRecording: () => void;
  onOpenImportModal?: (tab?: string) => void;
}

export const PreMeetingSetup: React.FC<PreMeetingSetupProps> = ({ onStartRecording, onOpenImportModal }) => {
  const {
    attendees, setAttendees, agendaItems, setAgendaItems, activeGroup, setActiveGroup,
    presentCount, apologiesCount,
    lastUpdate, addAgendaItem, removeAgendaItem,
    toggleAttendeeStatus, loadGroup,
    meetingType, setMeetingType,
    meetingLocation, setMeetingLocation,
    meetingTitle, setMeetingTitle,
  } = useMeetingSetup();

  const { contacts } = useContacts();
  const { groups } = useMeetingGroups();
  const [agendaInput, setAgendaInput] = useState('');
  const [groupPage, setGroupPage] = useState(0);
  const [isExtractingAgenda, setIsExtractingAgenda] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agendaDropRef = useRef<HTMLDivElement>(null);

  const handleAddAgenda = () => {
    if (agendaInput.trim()) {
      addAgendaItem(agendaInput.trim());
      setAgendaInput('');
    }
  };

  const handleLoadGroup = (group: MeetingGroup) => {
    loadGroup(group, contacts);
  };

  // Pagination
  const totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
  const pagedGroups = groups.slice(groupPage * GROUPS_PER_PAGE, (groupPage + 1) * GROUPS_PER_PAGE);
  const needsPagination = groups.length > GROUPS_PER_PAGE;

  // Apply extracted meeting metadata
  const applyExtractedData = useCallback((data: any) => {
    const items: string[] = data?.agendaItems || [];
    let feedbackParts: string[] = [];

    if (items.length > 0) {
      items.forEach((item: string) => addAgendaItem(item));
      feedbackParts.push(`${items.length} agenda item${items.length > 1 ? 's' : ''}`);
    }

    if (data?.meetingType && ['remote', 'face-to-face', 'hybrid'].includes(data.meetingType)) {
      setMeetingType(data.meetingType);
      feedbackParts.push(`meeting type: ${data.meetingType}`);
    }

    if (data?.location) {
      setMeetingLocation(data.location);
      feedbackParts.push(`location: ${data.location}`);
    }

    if (data?.meetingTitle) {
      setMeetingTitle(data.meetingTitle);
      feedbackParts.push(`title detected`);
    }

    if (feedbackParts.length === 0) {
      showToast.info('No meeting details found in the provided content', { section: 'meeting_manager' });
    } else {
      showToast.success(`Extracted: ${feedbackParts.join(', ')}`, { section: 'meeting_manager' });
    }
  }, [addAgendaItem, setMeetingType, setMeetingLocation, setMeetingTitle]);

  // Extract from file (image or document)
  const extractFromFile = useCallback(async (file: File) => {
    setIsExtractingAgenda(true);
    try {
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        // Send image as base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('extract-agenda-from-image', {
          body: { imageBase64: base64, mimeType: file.type },
        });
        if (error) throw error;
        applyExtractedData(data);
      } else {
        // For PDFs and Word docs, extract text first via upload-to-text, then send text to AI
        const formData = new FormData();
        formData.append('file', file);

        // Read file as base64 and use upload-to-text to get text
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // First try extracting text via upload-to-text
        const { data: textData, error: textError } = await supabase.functions.invoke('upload-to-text', {
          body: { fileBase64: base64, fileName: file.name, mimeType: file.type },
        });

        if (textError) throw textError;

        const extractedText = textData?.text || textData?.content || '';
        if (!extractedText) {
          showToast.info('Could not extract text from that file', { section: 'meeting_manager' });
          return;
        }

        // Now send extracted text to the agenda extraction AI
        const { data, error } = await supabase.functions.invoke('extract-agenda-from-image', {
          body: { textContent: extractedText },
        });
        if (error) throw error;
        applyExtractedData(data);
      }
    } catch (err) {
      console.error('Agenda extraction error:', err);
      showToast.error('Failed to extract meeting details from file', { section: 'meeting_manager' });
    } finally {
      setIsExtractingAgenda(false);
    }
  }, [applyExtractedData]);

  // Extract from pasted text
  const handleExtractFromText = useCallback(async () => {
    if (!pasteText.trim()) return;
    setIsExtractingAgenda(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-agenda-from-image', {
        body: { textContent: pasteText.trim() },
      });
      if (error) throw error;
      applyExtractedData(data);
      setPasteText('');
      setShowPasteArea(false);
    } catch (err) {
      console.error('Text extraction error:', err);
      showToast.error('Failed to extract meeting details from text', { section: 'meeting_manager' });
    } finally {
      setIsExtractingAgenda(false);
    }
  }, [pasteText, applyExtractedData]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractFromFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [extractFromFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) extractFromFile(file);
        return;
      }
    }
  }, [extractFromFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) extractFromFile(file);
  }, [extractFromFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 140px)', minHeight: '320px' }}>

      {/* Two-column grid — fills available space, scrolls internally */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden">

        {/* Left: Attendees */}
        <Card className="overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-extrabold text-foreground">👥 Attendees</span>
            <div className="flex items-center gap-2">
              {attendees.length > 0 && (
                <button
                  onClick={() => { setAttendees([]); setActiveGroup(null); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-all cursor-pointer"
                  title="Clear attendees and pick a different group"
                >
                  <RotateCcw className="h-3 w-3" />
                  Change
                </button>
              )}
              {attendees.length > 0 && (
                <div className="flex gap-2 text-xs font-bold">
                  <span className="text-emerald-600">● {presentCount}</span>
                  <span className="text-amber-500">● {apologiesCount}</span>
                  <span className="text-red-500">● {attendees.filter(a => a.status === 'absent').length}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto min-h-0">
            {attendees.length === 0 && (
              <>
                <button
                  onClick={() => onOpenImportModal?.('attendees')}
                  className="w-full flex items-center gap-2 p-2 rounded-lg mb-1.5 text-left transition-all duration-150 border border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                      Create New Group or Add Attendees
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">
                      Open the attendees panel to manage groups &amp; contacts
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setAttendees([{
                      id: `multi-${Date.now()}`,
                      name: 'Multiple Participants',
                      initials: '++',
                      role: 'Various',
                      org: '',
                      status: 'present' as const,
                    }]);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg mb-2 text-left transition-all duration-150 border border-muted-foreground/15 hover:border-blue-400/50 hover:bg-blue-500/5 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                    <UsersRound className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-muted-foreground group-hover:text-blue-600 transition-colors">
                      Multiple Participants
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">
                      Quick start — no need to name individual attendees
                    </div>
                  </div>
                </button>

                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                    Load a Meeting Group
                  </div>
                  {needsPagination && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setGroupPage(p => Math.max(0, p - 1))}
                        disabled={groupPage === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                        {groupPage + 1}/{totalPages}
                      </span>
                      <button
                        onClick={() => setGroupPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={groupPage >= totalPages - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
                {groups.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <div className="text-2xl mb-1">👥</div>
                    <p className="text-xs font-semibold">No meeting groups yet</p>
                    <p className="text-xs mt-1 text-muted-foreground/70 short-viewport:hidden">Create groups to quickly load attendees</p>
                  </div>
                )}
                {pagedGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleLoadGroup(g)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg mb-1 text-left transition-all duration-150 hover:translate-x-0.5 cursor-pointer"
                    style={{
                      border: `1.5px solid ${g.color}33`,
                      background: `${g.color}08`,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = g.color;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${g.color}33`;
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{
                        background: `${g.color}18`,
                        border: `1.5px solid ${g.color}`,
                      }}
                    >
                      {g.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-foreground truncate">{g.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {g.description || 'Meeting group'} · {g.contact_ids.length + (g.additional_members?.length || 0)} members
                      </div>
                    </div>
                    <AvatarStack
                      members={(g.additional_members || []).slice(0, 3).map(m => ({ initials: m.initials, name: m.name }))}
                      max={3}
                      size={20}
                    />
                  </button>
                ))}
              </>
            )}

            {attendees.length > 0 && (
              <>
                {activeGroup && (
                  <div
                    className="flex items-center gap-2 p-2 rounded-lg mb-2"
                    style={{
                      background: `${activeGroup.color}08`,
                      border: `1px solid ${activeGroup.color}33`,
                    }}
                  >
                    <span className="text-sm">{activeGroup.icon}</span>
                    <span className="text-xs font-bold" style={{ color: activeGroup.color }}>
                      {activeGroup.name}
                    </span>
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground">{attendees.length} loaded</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {attendees.map((a, i) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all duration-200"
                      style={{
                        background: a.status === 'present' ? 'transparent' : a.status === 'apologies' ? '#F59E0B08' : '#EF444408',
                      }}
                    >
                      <div
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}22, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}44)`,
                          border: `2px solid ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`,
                          color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
                          fontSize: 9,
                        }}
                      >
                        {a.initials}
                      </div>
                      <span
                        className="flex-1 text-xs font-semibold text-foreground truncate"
                        style={{
                          textDecoration: a.status === 'absent' ? 'line-through' : 'none',
                          opacity: a.status === 'absent' ? 0.4 : 1,
                        }}
                      >
                        {a.name}
                      </span>
                      <button
                        onClick={() => toggleAttendeeStatus(a.id)}
                        className="px-2.5 py-0.5 rounded-md text-[10px] font-bold text-white transition-all duration-150 cursor-pointer"
                        style={{
                          background:
                            a.status === 'present' ? '#10B981' :
                            a.status === 'apologies' ? '#F59E0B' : '#EF4444',
                        }}
                      >
                        {a.status === 'present' ? 'Present' : a.status === 'apologies' ? 'Apologies' : 'Absent'}
                      </button>
                      <button
                        onClick={() => setAttendees(prev => prev.filter(att => att.id !== a.id))}
                        className="text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer p-0.5"
                        title={`Remove ${a.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add more attendees */}
                <button
                  onClick={() => onOpenImportModal?.('attendees')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add Attendee
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Right: Agenda */}
        <Card
          className="overflow-hidden flex flex-col min-h-0"
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          ref={agendaDropRef}
        >
          <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-extrabold text-foreground">📋 Agenda</span>
            <div className="flex items-center gap-1.5">
              {agendaItems.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground font-semibold">{agendaItems.length} items</span>
                  <button
                    onClick={() => { setAgendaItems([]); setMeetingType(null); setMeetingLocation(null); setMeetingTitle(null); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
                    title="Clear all agenda items and extracted details"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Clear All</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowPasteArea(prev => !prev)}
                disabled={isExtractingAgenda}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer disabled:opacity-50"
                title="Paste email or text with agenda details"
              >
                <ClipboardPaste className="h-3 w-3" />
                <span className="hidden sm:inline">Paste Text</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtractingAgenda}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer disabled:opacity-50"
                title="Upload a file (image, PDF, or Word document)"
              >
                <Upload className="h-3 w-3" />
                <span className="hidden sm:inline">Upload File</span>
              </button>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto min-h-0">
            {/* Paste text area */}
            {showPasteArea && (
              <div className="mb-3 animate-fade-in">
                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  Paste email body or meeting details
                </div>
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste your email or meeting invitation text here… AI will extract agenda items, location, meeting type and more."
                  className="text-xs min-h-[80px] border-dashed border-muted-foreground/30 bg-muted/20 resize-none"
                  disabled={isExtractingAgenda}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={handleExtractFromText}
                    disabled={!pasteText.trim() || isExtractingAgenda}
                    className="text-xs h-7 px-3"
                  >
                    {isExtractingAgenda ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3 mr-1.5" />
                    )}
                    Extract Meeting Details
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowPasteArea(false); setPasteText(''); }}
                    className="text-xs h-7 px-3"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {isExtractingAgenda && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 bg-primary/5 border border-primary/20 animate-fade-in">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                <span className="text-xs font-semibold text-primary">Extracting meeting details…</span>
              </div>
            )}

            {/* Detected meeting metadata badges */}
            {(meetingType || meetingLocation || meetingTitle) && (
              <div className="flex flex-wrap gap-1.5 mb-2 animate-fade-in">
                {meetingTitle && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border text-[10px] font-semibold text-foreground/80">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    {meetingTitle}
                  </div>
                )}
                {meetingType && MEETING_TYPE_LABELS[meetingType] && (
                  <button
                    onClick={() => setMeetingType(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity group"
                    style={{
                      background: `${MEETING_TYPE_LABELS[meetingType].colour}12`,
                      border: `1px solid ${MEETING_TYPE_LABELS[meetingType].colour}33`,
                      color: MEETING_TYPE_LABELS[meetingType].colour,
                    }}
                    title="Click to change meeting format"
                  >
                    {MEETING_TYPE_LABELS[meetingType].icon}
                    {MEETING_TYPE_LABELS[meetingType].label}
                    <X className="h-2.5 w-2.5 ml-0.5 opacity-50 group-hover:opacity-100" />
                  </button>
                )}
                {meetingLocation && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border text-[10px] font-semibold text-foreground/80">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {meetingLocation}
                  </div>
                )}
              </div>
            )}

            {agendaItems.length === 0 && !isExtractingAgenda && !showPasteArea && (
              <div className="text-center py-3 text-muted-foreground short-viewport:py-1">
                <div className="text-2xl mb-1 short-viewport:hidden">📋</div>
                <div className="text-xs font-semibold text-foreground/70 short-viewport:hidden">No agenda items yet</div>
                <div className="text-[11px] mt-1 short-viewport:mt-0">Add items below — they help the AI segment the transcript</div>
                <div className="text-[10px] mt-1.5 text-muted-foreground/50 flex items-center justify-center gap-1.5 short-viewport:hidden">
                  <Upload className="h-3 w-3" />
                  Upload a file, paste text, or Ctrl+V an image to auto-extract
                </div>
              </div>
            )}
            {agendaItems.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1 bg-muted/30 border border-muted animate-fade-in"
              >
                <span className="text-[11px] font-bold text-muted-foreground/40 font-mono w-[18px]">{i + 1}.</span>
                <span className="flex-1 text-xs text-foreground/80 font-medium">{item.text}</span>
                <button
                  onClick={() => removeAgendaItem(item.id)}
                  className="text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Meeting type selector — only shown when not already detected */}
            {!meetingType && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  Meeting Format
                </div>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setMeetingType('face-to-face')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer bg-muted/20 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"
                  >
                    <Users2 className="h-3.5 w-3.5" />
                    <span className="short-viewport:hidden">Face to Face</span>
                    <span className="hidden short-viewport:inline">F2F</span>
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => setMeetingType('remote')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer bg-muted/20 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Remote
                  </button>
                </div>
              </div>
            )}

            <Input
              value={agendaInput}
              onChange={e => setAgendaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddAgenda(); }}
              placeholder="Type agenda item + Enter..."
              className="mt-2 border-dashed border-muted-foreground/30 bg-muted/20 text-xs"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </Card>
      </div>

      {/* Bottom: Pre-Recording Summary + Start Button — sticky */}
      <div className="flex-shrink-0 sticky bottom-0 z-10 -mx-1 px-1">
        <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 border-t border-border/50 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap gap-1.5 flex-1">
            <ContextStatusPill
              icon="👥" label="Attendees"
              color={attendees.length > 0 ? '#10B981' : '#94A3B8'}
              value={attendees.length > 0 ? `${presentCount} present` : 'None'}
              pulse={lastUpdate === 'group' || lastUpdate === 'attendance'}
            />
            {apologiesCount > 0 && (
              <ContextStatusPill
                icon="📨" label="Apologies" color="#F59E0B"
                value={apologiesCount.toString()}
                pulse={lastUpdate === 'attendance'}
              />
            )}
            <ContextStatusPill
              icon="📋" label="Agenda"
              color={agendaItems.length > 0 ? '#3B82F6' : '#94A3B8'}
              value={agendaItems.length > 0 ? `${agendaItems.length} items` : 'None'}
              pulse={lastUpdate === 'agenda'}
            />
            {activeGroup && (
              <ContextStatusPill
                icon={activeGroup.icon} label="Group" color={activeGroup.color}
                value={activeGroup.name}
              />
            )}
            {meetingType && MEETING_TYPE_LABELS[meetingType] && (
              <ContextStatusPill
                icon="📍" label="Type" color={MEETING_TYPE_LABELS[meetingType].colour}
                value={MEETING_TYPE_LABELS[meetingType].label}
              />
            )}
          </div>

          <Button
            onClick={onStartRecording}
            className="px-6 py-5 rounded-xl text-[14px] font-extrabold shadow-lg transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              boxShadow: '0 4px 20px #EF444444',
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white mr-2" />
            Start Recording
          </Button>
        </Card>
        {/* Skip setup */}
        <div className="text-center py-1.5">
          <button
            onClick={onStartRecording}
            className="text-[11px] text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
          >
            or start recording without setup
          </button>
        </div>
      </div>
    </div>
  );
};
