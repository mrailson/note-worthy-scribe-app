import React, { useState, useEffect } from "react";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
  RefreshCw,
  Share,
  RotateCcw,
  Loader2
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
  const [regenerating, setRegenerating] = useState<{
    brief: boolean;
    detailed: boolean;
    comprehensive: boolean;
    executive: boolean;
    creative: boolean;
  }>({
    brief: false,
    detailed: false,
    comprehensive: false,
    executive: false,
    creative: false,
  });

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

  // Format content for better display
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // Convert markdown-style formatting to HTML
    return content
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
      .replace(/\n\n/g, '</p><p>') // Paragraphs
      .replace(/\n/g, '<br/>') // Line breaks
      .replace(/^/, '<p>') // Start with paragraph
      .replace(/$/, '</p>'); // End with paragraph
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

  // Regenerate notes functions
  const regenerateNotes = async (noteType: keyof typeof regenerating) => {
    if (!meeting?.id || !user?.id) return;

    setRegenerating(prev => ({ ...prev, [noteType]: true }));

    try {
      let result;
      
      switch (noteType) {
        case 'brief':
          // Use auto-generate-meeting-notes for standard notes
          result = await supabase.functions.invoke('auto-generate-meeting-notes', {
            body: { meetingId: meeting.id, noteType: 'standard' }
          });
          break;
          
        case 'detailed':
          // Use auto-generate-meeting-notes for detailed notes
          result = await supabase.functions.invoke('auto-generate-meeting-notes', {
            body: { meetingId: meeting.id, noteType: 'detailed' }
          });
          break;
          
        case 'comprehensive':
          // Use auto-generate-meeting-notes for comprehensive notes
          result = await supabase.functions.invoke('auto-generate-meeting-notes', {
            body: { meetingId: meeting.id, noteType: 'comprehensive' }
          });
          break;
          
        case 'executive':
          // Use auto-generate-meeting-notes for executive notes
          result = await supabase.functions.invoke('auto-generate-meeting-notes', {
            body: { meetingId: meeting.id, noteType: 'executive' }
          });
          break;
          
        case 'creative':
          // Use generate-limerick-notes for creative notes
          result = await supabase.functions.invoke('generate-limerick-notes', {
            body: { meetingIds: [meeting.id] }
          });
          break;
      }

      if (result.error) {
        console.error(`Error regenerating ${noteType} notes:`, result.error);
        toast.error(`Failed to regenerate ${noteType} notes: ${result.error.message}`);
        return;
      }

      // Reload the notes to get the updated content
      await loadExistingNoteStyles();
      toast.success(`${noteType.charAt(0).toUpperCase() + noteType.slice(1)} notes regenerated successfully!`);

    } catch (error) {
      console.error(`Error regenerating ${noteType} notes:`, error);
      toast.error(`Failed to regenerate ${noteType} notes`);
    } finally {
      setRegenerating(prev => ({ ...prev, [noteType]: false }));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-3 border-b flex-shrink-0">
            <SheetTitle className="text-lg font-semibold text-left">
              {meeting?.title || 'Meeting Notes'}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {meeting?.start_time ? formatDate(meeting.start_time) : 'N/A'}
              </span>
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 pb-3 border-b flex-shrink-0">
              <TabsList className="grid w-full max-w-lg grid-cols-5 h-9">
                <TabsTrigger value="brief" className="text-xs px-1">Brief</TabsTrigger>
                <TabsTrigger value="detailed" className="text-xs px-1">Detail</TabsTrigger>
                <TabsTrigger value="comprehensive" className="text-xs px-1">Full</TabsTrigger>
                <TabsTrigger value="executive" className="text-xs px-1">Exec</TabsTrigger>
                <TabsTrigger value="creative" className="text-xs px-1">Fun</TabsTrigger>
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

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <TabsContent value="brief" className="mt-0">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Brief Notes</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('brief')}
                        disabled={regenerating.brief}
                        className="h-8 px-2"
                      >
                        {regenerating.brief ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {regenerating.brief ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {notes ? (
                        <div 
                          className="text-sm leading-relaxed space-y-3"
                          dangerouslySetInnerHTML={{ __html: formatContent(notes) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No brief notes available
                          <br />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => regenerateNotes('brief')}
                            disabled={regenerating.brief}
                          >
                            Generate Brief Notes
                          </Button>
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="detailed" className="mt-0">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Detailed Notes</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('detailed')}
                        disabled={regenerating.detailed}
                        className="h-8 px-2"
                      >
                        {regenerating.detailed ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {regenerating.detailed ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {notesStyle2 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-3"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle2) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No detailed notes available
                          <br />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => regenerateNotes('detailed')}
                            disabled={regenerating.detailed}
                          >
                            Generate Detailed Notes
                          </Button>
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="comprehensive" className="mt-0">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Comprehensive Notes</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('comprehensive')}
                        disabled={regenerating.comprehensive}
                        className="h-8 px-2"
                      >
                        {regenerating.comprehensive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {regenerating.comprehensive ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {notesStyle3 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-3"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle3) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No comprehensive notes available
                          <br />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => regenerateNotes('comprehensive')}
                            disabled={regenerating.comprehensive}
                          >
                            Generate Comprehensive Notes
                          </Button>
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="executive" className="mt-0">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Executive Summary</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('executive')}
                        disabled={regenerating.executive}
                        className="h-8 px-2"
                      >
                        {regenerating.executive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {regenerating.executive ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {notesStyle4 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-3"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle4) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No executive notes available
                          <br />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => regenerateNotes('executive')}
                            disabled={regenerating.executive}
                          >
                            Generate Executive Summary
                          </Button>
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="creative" className="mt-0">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Creative Notes (Limericks)</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('creative')}
                        disabled={regenerating.creative}
                        className="h-8 px-2"
                      >
                        {regenerating.creative ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {regenerating.creative ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {notesStyle5 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-3"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle5) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No creative notes available
                          <br />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => regenerateNotes('creative')}
                            disabled={regenerating.creative}
                          >
                            Generate Limerick Notes
                          </Button>
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </div>

            {/* Action buttons */}
            <div className="border-t pt-3 pb-1">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareNotes}
                  disabled={!getCurrentTabContent()}
                >
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadNotes}
                  disabled={!getCurrentTabContent()}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                  disabled={!getCurrentTabContent()}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Full
                </Button>
              </div>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};