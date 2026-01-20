import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Users, ClipboardList, ListTodo, Loader2 } from 'lucide-react';
import { ScreenshotImportTab } from './ScreenshotImportTab';
import { AttendeesImportTab } from './AttendeesImportTab';
import { ActionsImportTab } from './ActionsImportTab';
import { AgendaImportTab } from './AgendaImportTab';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LiveImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
  onImportComplete?: () => void;
}

export type ImportedContent = {
  attendees?: string[];
  agenda?: string;
  actionItems?: string[];
  rawText?: string;
};

export const LiveImportModal: React.FC<LiveImportModalProps> = ({
  open,
  onOpenChange,
  meetingId,
  onImportComplete
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('screenshot');
  const [isImporting, setIsImporting] = useState(false);
  
  // Get current meeting ID from session if not provided
  const getCurrentMeetingId = useCallback(() => {
    return meetingId || sessionStorage.getItem('currentMeetingId') || null;
  }, [meetingId]);

  const handleImportContent = async (content: ImportedContent) => {
    const currentMeetingId = getCurrentMeetingId();
    
    if (!currentMeetingId) {
      showToast.error('No active meeting found', { section: 'meeting_manager' });
      return;
    }

    if (!user?.id) {
      showToast.error('User not authenticated', { section: 'meeting_manager' });
      return;
    }

    setIsImporting(true);

    try {
      // Update meeting with imported content
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };

      // If we have attendees, add to meeting_attendees junction table
      if (content.attendees && content.attendees.length > 0) {
        for (const attendeeName of content.attendees) {
          // Check if attendee exists in user's attendees table
          const { data: attendeeRecord } = await supabase
            .from('attendees')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', attendeeName)
            .maybeSingle();
          
          if (attendeeRecord) {
            // Link existing attendee to meeting
            await supabase
              .from('meeting_attendees')
              .upsert({
                meeting_id: currentMeetingId,
                attendee_id: attendeeRecord.id
              }, { onConflict: 'meeting_id,attendee_id' });
          } else {
            // Create new attendee and link
            const { data: newAttendee } = await supabase
              .from('attendees')
              .insert({ name: attendeeName, user_id: user.id })
              .select('id')
              .single();
            
            if (newAttendee) {
              await supabase
                .from('meeting_attendees')
                .insert({
                  meeting_id: currentMeetingId,
                  attendee_id: newAttendee.id
                });
            }
          }
        }
      }

      // If we have agenda, append or update
      if (content.agenda) {
        const { data: existingMeeting } = await supabase
          .from('meetings')
          .select('agenda')
          .eq('id', currentMeetingId)
          .single();

        const existingAgenda = existingMeeting?.agenda || '';
        if (existingAgenda) {
          updatePayload.agenda = `${existingAgenda}\n\n${content.agenda}`;
        } else {
          updatePayload.agenda = content.agenda;
        }
      }

      // If we have action items, store them as meeting action items
      if (content.actionItems && content.actionItems.length > 0) {
        for (const actionText of content.actionItems) {
          await supabase
            .from('meeting_action_items')
            .insert({
              meeting_id: currentMeetingId,
              action_text: actionText,
              status: 'pending',
              user_id: user.id
            });
        }
      }

      // Apply updates to meeting
      if (Object.keys(updatePayload).length > 1) {
        const { error } = await supabase
          .from('meetings')
          .update(updatePayload)
          .eq('id', currentMeetingId);

        if (error) throw error;
      }

      showToast.success('Content imported successfully', { section: 'meeting_manager' });
      onImportComplete?.();
      
    } catch (error: any) {
      console.error('Import error:', error);
      showToast.error(`Import failed: ${error.message}`, { section: 'meeting_manager' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-semibold">Import Content</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add context to your active meeting without interrupting the recording
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 px-6 py-2 bg-muted/30 rounded-none border-b border-border/50">
              <TabsTrigger 
                value="screenshot" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Screenshot</span>
              </TabsTrigger>
              <TabsTrigger 
                value="attendees"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Attendees</span>
              </TabsTrigger>
              <TabsTrigger 
                value="actions"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">Actions</span>
              </TabsTrigger>
              <TabsTrigger 
                value="agenda"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Agenda</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-6">
              <TabsContent value="screenshot" className="mt-0 h-full">
                <ScreenshotImportTab 
                  onImport={handleImportContent}
                  isImporting={isImporting}
                />
              </TabsContent>
              
              <TabsContent value="attendees" className="mt-0 h-full">
                <AttendeesImportTab 
                  onImport={handleImportContent}
                  isImporting={isImporting}
                />
              </TabsContent>
              
              <TabsContent value="actions" className="mt-0 h-full">
                <ActionsImportTab 
                  onImport={handleImportContent}
                  isImporting={isImporting}
                />
              </TabsContent>
              
              <TabsContent value="agenda" className="mt-0 h-full">
                <AgendaImportTab 
                  onImport={handleImportContent}
                  isImporting={isImporting}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {isImporting && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-3 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-medium">Importing content...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
