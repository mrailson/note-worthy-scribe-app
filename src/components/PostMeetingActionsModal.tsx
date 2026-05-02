import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, PlayCircle, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from "@/utils/toastWrapper";
import { useAuth } from '@/contexts/AuthContext';

interface PostMeetingActionsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  meetingDuration: string;
  onStartNewMeeting: () => void;
}

export const PostMeetingActionsModal: React.FC<PostMeetingActionsModalProps> = ({
  isOpen,
  onOpenChange,
  meetingId,
  meetingTitle,
  meetingDuration,
  onStartNewMeeting,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notesStatus, setNotesStatus] = useState<'generating' | 'completed' | 'error' | 'stalled'>('generating');
  const [retrying, setRetrying] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [meetingData, setMeetingData] = useState<any>(null);
  const [transcriptLength, setTranscriptLength] = useState<number>(0);
  const [emailSent, setEmailSent] = useState(false);
  const emailSentRef = useRef(false); // Prevent duplicate sends

  // Format number in K style (e.g., 4200 -> 4.2K)
  const formatNumberK = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Subscribe to notes generation status
  useEffect(() => {
    if (!meetingId || !isOpen) return;

    const fetchMeetingStatus = async () => {
      // Handle test meeting IDs - simulate completed notes
      if (meetingId.startsWith('test-meeting-id-')) {
        setNotesStatus('completed');
        setMeetingNotes('This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.');
        setMeetingData({
          title: meetingTitle,
          startTime: new Date().toISOString(),
          duration: meetingDuration,
          attendees: ['Test User'],
          meetingLocation: 'Test Location',
          overview: 'This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.',
          content: 'This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.',
        });
        return;
      }

      const { data, error } = await supabase
        .from('meetings')
        .select('notes_generation_status, overview, notes_style_3, title, start_time, duration_minutes, agenda, participants, word_count, updated_at')
        .eq('id', meetingId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching meeting status:', error);
        setNotesStatus('error');
        return;
      }

      if (!data) {
        console.warn('Meeting not found:', meetingId);
        setNotesStatus('error');
        return;
      }

      if (data) {
        // Set transcript length
        setTranscriptLength(data.word_count || 0);
        
        // Fetch full notes from meeting_summaries table (the AI-generated notes)
        let fullNotes = '';
        if (data.notes_generation_status === 'completed') {
          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('summary')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          
          // Use meeting_summaries.summary as primary, fall back to notes_style_3 then overview
          fullNotes = summaryData?.summary || data.notes_style_3 || data.overview || '';
        } else {
          fullNotes = data.notes_style_3 || data.overview || '';
        }
        
        // Set meeting data for export
        setMeetingData({
          title: data.title,
          startTime: data.start_time,
          duration: data.duration_minutes ? `${data.duration_minutes} minutes` : meetingDuration,
          attendees: data.participants || [],
          meetingLocation: '',
          overview: data.overview || '',
          content: fullNotes,
        });
        
        if (data.notes_generation_status === 'completed') {
          setNotesStatus('completed');
          setMeetingNotes(fullNotes);
        } else if (data.notes_generation_status === 'error' || data.notes_generation_status === 'failed') {
          setNotesStatus('error');
        } else {
          // Stale-job safety net: if the row says 'generating' but the server hasn't
          // touched it in over 6 minutes, the orchestrator likely crashed without
          // flipping the status. Surface a retry CTA instead of an infinite spinner.
          const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          const ageMs = Date.now() - updatedAt;
          const STALE_THRESHOLD_MS = 6 * 60 * 1000;
          if (updatedAt && ageMs > STALE_THRESHOLD_MS) {
            console.warn(`⏱️ Meeting ${meetingId} stuck in 'generating' for ${Math.round(ageMs / 1000)}s — surfacing retry CTA`);
            setNotesStatus('stalled');
          } else {
            setNotesStatus('generating');
          }
        }
      }
    };

    // Initial fetch
    fetchMeetingStatus();

    // Skip real-time subscription for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      return;
    }

    // ENHANCEMENT: Polling fallback every 15 seconds
    // This catches cases where Realtime subscription misses the update
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for notes status update...');
      fetchMeetingStatus();
    }, 15000);

    // Subscribe to real-time updates (primary, faster method)
    const channel = supabase
      .channel(`meeting-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${meetingId}`,
        },
        (payload) => {
          console.log('📡 Meeting status updated:', payload);
          if (payload.new.notes_generation_status === 'completed') {
            // Re-fetch to get full notes_style_3 content (not just overview from payload)
            fetchMeetingStatus();
            showToast.success('Meeting notes are ready!', { section: 'meeting_manager' });
          } else if (payload.new.notes_generation_status === 'error' || payload.new.notes_generation_status === 'failed') {
            setNotesStatus('error');
            showToast.error('Failed to generate meeting notes', { section: 'meeting_manager' });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [meetingId, isOpen]);

  // Auto-send email when notes are ready
  useEffect(() => {
    if (notesStatus !== 'completed' || !meetingData || !user?.email || emailSentRef.current) {
      return;
    }

    const sendAutoEmail = async () => {
      // Prevent duplicate sends
      emailSentRef.current = true;
      setEmailSent(true);

      try {
        console.log('📧 Auto-sending meeting notes email...');
        
        // FETCH FRESH NOTES FROM DATABASE to avoid stale React state
        console.log('📧 Fetching fresh notes from database...');
        const { data: freshSummary } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        
        const freshNotes = freshSummary?.summary || '';
        
        if (!freshNotes.trim()) {
          console.warn('⚠️ No notes available for auto-email, skipping send');
          emailSentRef.current = false;
          setEmailSent(false);
          return;
        }
        
        console.log('✅ Fresh notes fetched:', freshNotes.length, 'chars');
        
        // Fetch fresh meeting metadata
        const { data: freshMeeting } = await supabase
          .from('meetings')
          .select('title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count')
          .eq('id', meetingId)
          .maybeSingle();

        // If the title is still a generic placeholder, wait briefly for the AI title
        // generator to finish committing, then refetch. If still generic, call
        // generate-meeting-title manually as a final fallback.
        const GENERIC_EXACT_TITLES = new Set([
          'meeting',
          'general meeting',
          'new meeting',
          'untitled meeting',
          'untitled',
          'mobile recording',
          'general discussion',
          'general update',
          'team meeting',
          'weekly meeting',
          'monthly meeting',
        ]);

        const GENERIC_TITLE_PATTERNS: RegExp[] = [
          /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i,           // "Meeting 20 Apr 18:50"
          /^Mobile Recording\b/i,                              // "Mobile Recording 20 Apr"
          /^Meeting\s*-\s*\w{3},/i,                            // "Meeting - Thu, 30th April 2026 (9:27 am)"
          /^Meeting\s*-\s*\w+day/i,                            // "Meeting - Monday..."
          /^Meeting\s*-\s*\d{1,2}(st|nd|rd|th)/i,              // "Meeting - 14th..."
          /^Meeting\s+\d+$/i,                                  // "Meeting 1"
          /^Imported Meeting\s*-/i,                            // "Imported Meeting - 30/04/2026"
        ];

        const isGenericMeetingTitle = (t: string | null | undefined): boolean => {
          if (!t) return true;
          const trimmed = t.trim();
          if (GENERIC_EXACT_TITLES.has(trimmed.toLowerCase())) return true;
          return GENERIC_TITLE_PATTERNS.some(p => p.test(trimmed));
        };

        let resolvedMeeting = freshMeeting;
        const waitMs = [3000, 5000, 8000];
        for (const wait of waitMs) {
          if (!isGenericMeetingTitle(resolvedMeeting?.title)) break;
          console.log(`⏳ Title still generic ("${resolvedMeeting?.title}") — waiting ${wait}ms for AI title…`);
          await new Promise(r => setTimeout(r, wait));
          const { data: refreshed } = await supabase
            .from('meetings')
            .select('title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count')
            .eq('id', meetingId)
            .maybeSingle();
          if (refreshed) resolvedMeeting = refreshed;
        }

        // If the title is still generic after the wait, ask generate-meeting-title to retry directly
        if (isGenericMeetingTitle(resolvedMeeting?.title)) {
          try {
            const { data: titleResult } = await supabase.functions.invoke<{ title?: string }>(
              'generate-meeting-title',
              { body: { meetingId, currentTitle: resolvedMeeting?.title || 'Meeting' } }
            );
            const newTitle = titleResult?.title?.trim();
            if (newTitle && !isGenericMeetingTitle(newTitle)) {
              await supabase.from('meetings').update({ title: newTitle }).eq('id', meetingId);
              resolvedMeeting = { ...(resolvedMeeting || {}), title: newTitle } as typeof resolvedMeeting;
              console.log(`✅ Generated fallback title for post-meeting send: "${newTitle}"`);
            }
          } catch (e) {
            console.warn('⚠️ Fallback title generation failed:', e);
          }
        }

        const freshMeetingData = {
          title: resolvedMeeting?.title || meetingTitle,
          startTime: freshMeeting?.start_time,
          duration: freshMeeting?.duration_minutes,
          participants: freshMeeting?.participants || [],
          content: freshNotes,
          format: freshMeeting?.meeting_format,
          location: freshMeeting?.meeting_location,
          overview: freshMeeting?.overview,
          wordCount: freshMeeting?.word_count,
        };
        
        // Get user's full name from profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('email', user.email)
          .single();
        
        const senderName = profileData?.full_name || user.email?.split('@')[0] || 'Notewell AI';
        
        // Format the meeting date for subject
        const meetingDate = freshMeetingData.startTime 
          ? new Date(freshMeetingData.startTime).toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
          : new Date().toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            });
        
        const subject = `Notewell AI | ${freshMeetingData.title} — ${meetingDate}`;
        
        // Generate Word document attachment FIRST so the email body can reflect attachment status
        let wordAttachment = null;
        try {
          const { generateProfessionalWordBlob } = await import('@/utils/generateProfessionalMeetingDocx');
          
          const cleanTitle = freshMeetingData.title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
          
          // Build parsed details from meeting metadata
          const parsedDetails = {
            title: cleanTitle,
            date: meetingDate || undefined,
            time: freshMeetingData.startTime 
              ? new Date(freshMeetingData.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
              : undefined,
            location: freshMeetingData.format || freshMeetingData.location || undefined,
            attendees: Array.isArray(freshMeetingData.participants) && freshMeetingData.participants.length > 0
              ? freshMeetingData.participants.join(', ')
              : undefined,
          };
          
          // Fetch action items for this meeting
          let parsedActionItems: any[] = [];
          try {
            const { data: actionItemsData } = await supabase
              .from('meeting_action_items')
              .select('action_text, assignee_name, due_date, priority, status')
              .eq('meeting_id', meetingId);
            
            if (actionItemsData && actionItemsData.length > 0) {
              parsedActionItems = actionItemsData.map((item: any) => ({
                action: item.action_text,
                owner: item.assignee_name || 'Unassigned',
                deadline: item.due_date || undefined,
                priority: item.priority || 'medium',
                status: item.status === 'completed' ? 'Completed' as const : item.status === 'in_progress' ? 'In Progress' as const : 'Open' as const,
                isCompleted: item.status === 'completed',
              }));
            }
          } catch (aiErr) {
            console.warn('Could not fetch action items for Word attachment:', aiErr);
          }
          
          // Generate the professional Word blob
          const blob = await generateProfessionalWordBlob(freshMeetingData.content, cleanTitle, parsedDetails, parsedActionItems);
          
          // Convert blob to base64
          const base64Content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              if (result) {
                resolve(result.split(',')[1]);
              } else {
                reject(new Error('FileReader returned empty result'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
          });
          
          const { generateMeetingFilename } = await import('@/utils/meetingFilename');
          const attachmentFilename = generateMeetingFilename(
            freshMeetingData.title,
            freshMeetingData.startTime ? new Date(freshMeetingData.startTime) : new Date(),
            'docx'
          );
          
          wordAttachment = {
            content: base64Content,
            filename: attachmentFilename,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
          console.log('📎 Professional Word attachment generated:', attachmentFilename, `(${Math.round(base64Content.length / 1024)}KB base64)`);
        } catch (docError) {
          console.error('❌ Word document generation failed for auto-email:', docError);
          // Fallback: try professional generator without parsed data
          try {
            const { generateProfessionalWordBlob } = await import('@/utils/generateProfessionalMeetingDocx');
            const blob = await generateProfessionalWordBlob(freshMeetingData.content, freshMeetingData.title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim(), undefined, []);
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
              };
            });
            reader.readAsDataURL(blob);
            const base64Content = await base64Promise;
            wordAttachment = {
              content: base64Content,
              filename: `meeting_notes.docx`,
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            };
            console.log('📎 Word attachment generated via professional fallback');
          } catch (fallbackError) {
            console.error('All Word generation attempts failed:', fallbackError);
            showToast.warning('Email sent without Word attachment — open the meeting from history and click "Email Meeting Notes" to retry.', { duration: 8000 });
          }
        }
        
        // Convert notes content to styled HTML using shared professional builder
        const { buildProfessionalMeetingEmail } = await import('@/utils/meetingEmailBuilder');
        const htmlContent = buildProfessionalMeetingEmail(
          freshMeetingData.content,
          senderName,
          freshMeetingData.title,
          {
            date: meetingDate,
            time: freshMeetingData.startTime 
              ? new Date(freshMeetingData.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
              : undefined,
            duration: freshMeetingData.duration,
            format: freshMeetingData.format,
            location: freshMeetingData.location,
            overview: freshMeetingData.overview,
            wordCount: freshMeetingData.wordCount,
            attendees: Array.isArray(freshMeetingData.participants) ? freshMeetingData.participants : [],
            hasAttachment: wordAttachment !== null,
          }
        );
        
        // Send email via Resend edge function
        const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
          body: {
            to_email: user.email,
            cc_emails: [],
            subject,
            html_content: htmlContent,
            from_name: senderName,
            word_attachment: wordAttachment
          }
        });
        
        if (error) {
          console.error('Auto-email sending error:', error);
          return;
        }
        
        if (data?.success) {
          console.log('✅ Auto-email sent successfully to:', user.email);
        } else {
          console.error('Auto-email failed:', data);
        }
      } catch (error) {
        console.error('Error sending auto-email:', error);
      }
    };

    sendAutoEmail();
  }, [notesStatus, meetingData, user?.email, meetingNotes, meetingTitle]);

  // Reset email sent state when modal closes or meeting changes
  useEffect(() => {
    if (!isOpen) {
      emailSentRef.current = false;
      setEmailSent(false);
    }
  }, [isOpen, meetingId]);

  const handleViewMeeting = () => {
    if (notesStatus !== 'completed') {
      showToast.info('Meeting notes are still being generated. Please wait a moment.', { section: 'meeting_manager' });
      return;
    }
    
    // Don't navigate for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      showToast.info('Test meetings cannot be viewed. Please record a real meeting.', { section: 'meeting_manager' });
      return;
    }
    
    onOpenChange(false);
    // Navigate to home page and trigger SafeModeNotesModal in the History tab (the new better version)
    navigate('/', { 
      state: { 
        openSafeModeModal: true,
        safeModeModalMeetingId: meetingId,
        switchToHistoryTab: true
      } 
    });
  };

  const handleStartNew = () => {
    onOpenChange(false);
    onStartNewMeeting();
  };

  const getStatusBadge = () => {
    switch (notesStatus) {
      case 'generating':
        return (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating notes...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="flex items-center gap-1.5 bg-green-600 w-fit">
            <CheckCircle className="h-3 w-3" />
            Ready
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Error generating notes
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
              </div>
              <DialogTitle className="text-2xl font-semibold">
                Meeting Saved Successfully
              </DialogTitle>
            </div>
            <DialogDescription className="space-y-3 pt-2 px-2">
              <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <span className="font-medium text-foreground">Title:</span>
                <span className="text-foreground">{meetingData?.title || meetingTitle}</span>
                
                <span className="font-medium text-foreground">Duration:</span>
                <span className="text-foreground">
                  {meetingDuration}
                  {transcriptLength > 0 && (
                    <span className="text-muted-foreground ml-2">
                      • Transcript: {formatNumberK(transcriptLength)} words
                    </span>
                  )}
                </span>
                
                <span className="font-medium text-foreground">Status:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge()}
                  {emailSent && (
                    <Badge variant="default" className="flex items-center gap-1.5 bg-green-600 w-fit hover:bg-green-600">
                      <Mail className="h-3 w-3" />
                      Emailed
                    </Badge>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 px-2">
            {/* View Minutes Button */}
            <Button
              onClick={handleViewMeeting}
              disabled={notesStatus !== 'completed'}
              className="w-full justify-start h-12 text-base"
              size="lg"
            >
              <FileText className="h-5 w-5 mr-3" />
              View Meeting Notes
            </Button>

            {/* Start New Meeting Button */}
            <Button
              onClick={handleStartNew}
              variant="secondary"
              className="w-full justify-center h-12"
              size="lg"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Start New Meeting
            </Button>

            {/* Close Button */}
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Close and Return to Notewell AI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
