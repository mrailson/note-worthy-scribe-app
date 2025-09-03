import React, { useState, useEffect } from "react";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Copy, 
  FileText, 
  Download,
  ExternalLink,
  Calendar,
  Clock,
  Users,
  RefreshCw
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  notes_style_2?: string;
  notes_style_3?: string;
  notes_style_4?: string;
  notes_style_5?: string;
}

interface MobileNotesSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  notes: string;
}

export const MobileNotesSheet: React.FC<MobileNotesSheetProps> = ({
  isOpen,
  onOpenChange,
  meeting,
  notes
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("brief");
  const [notesStyle2, setNotesStyle2] = useState("");
  const [notesStyle3, setNotesStyle3] = useState("");
  const [notesStyle4, setNotesStyle4] = useState("");
  const [notesStyle5, setNotesStyle5] = useState("");
  const [loading, setLoading] = useState(false);

  // Load existing note styles from database
  const loadExistingNoteStyles = async () => {
    if (!meeting?.id || !user?.id) return;

    setLoading(true);
    try {
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .select('notes_style_2, notes_style_3, notes_style_4, notes_style_5')
        .eq('id', meeting.id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading note styles:', error);
        return;
      }

      if (meetingData) {
        setNotesStyle2(meetingData.notes_style_2 || "");
        setNotesStyle3(meetingData.notes_style_3 || "");
        setNotesStyle4(meetingData.notes_style_4 || "");
        setNotesStyle5(meetingData.notes_style_5 || "");
      }
    } catch (error) {
      console.error('Error loading note styles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load notes when sheet opens
  useEffect(() => {
    if (isOpen && meeting?.id && user?.id) {
      loadExistingNoteStyles();
    }
  }, [isOpen, meeting?.id, user?.id]);

  // Copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Notes copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy notes');
    }
  };

  // Open in new tab for full view
  const openInNewTab = () => {
    const content = getCurrentTabContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Get current tab content
  const getCurrentTabContent = () => {
    switch (activeTab) {
      case "brief":
        return notes;
      case "detailed":
        return notesStyle2;
      case "comprehensive":
        return notesStyle3;
      case "executive":
        return notesStyle4;
      case "creative":
        return notesStyle5;
      default:
        return notes;
    }
  };

  // Download notes as text file
  const downloadNotes = () => {
    const content = getCurrentTabContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting?.title || 'Meeting'}_Notes_${activeTab}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Notes downloaded');
  };

  // Share using Web Share API if available
  const shareNotes = async () => {
    const content = getCurrentTabContent();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${meeting?.title} - Notes`,
          text: content,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(content);
        }
      }
    } else {
      copyToClipboard(content);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">
            {meeting?.title || 'Meeting Notes'}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {meeting?.start_time ? formatDate(meeting.start_time) : 'N/A'}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid w-full max-w-md grid-cols-3 h-8">
                <TabsTrigger value="brief" className="text-xs">Brief</TabsTrigger>
                <TabsTrigger value="detailed" className="text-xs">Detailed</TabsTrigger>
                <TabsTrigger value="comprehensive" className="text-xs">Full</TabsTrigger>
              </TabsList>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={loadExistingNoteStyles}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <TabsContent value="brief" className="mt-0 p-4">
                <div className="prose prose-sm max-w-none">
                  {notes ? (
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: notes.replace(/\n/g, '<br/>') }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No brief notes available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="detailed" className="mt-0 p-4">
                <div className="prose prose-sm max-w-none">
                  {notesStyle2 ? (
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: notesStyle2.replace(/\n/g, '<br/>') }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No detailed notes available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="comprehensive" className="mt-0 p-4">
                <div className="prose prose-sm max-w-none">
                  {notesStyle3 ? (
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: notesStyle3.replace(/\n/g, '<br/>') }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No comprehensive notes available</p>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={shareNotes}
                disabled={!getCurrentTabContent()}
              >
                <Copy className="h-4 w-4 mr-2" />
                Share
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadNotes}
                disabled={!getCurrentTabContent()}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={openInNewTab}
              disabled={!getCurrentTabContent()}
              className="mt-2"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Full View
            </Button>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};