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
  const [activeTab, setActiveTab] = useState("executive");
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
    const formattedContent = formatContent(content);
    const title = meeting?.title || 'Meeting Notes';
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${tabName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            color: #1a1a1a;
          }
          h1, h2, h3 { margin-top: 24px; margin-bottom: 12px; }
          h1 { font-size: 24px; color: #1a1a1a; }
          h2 { font-size: 20px; color: #1a1a1a; }
          h3 { font-size: 16px; color: #1a1a1a; }
          p { margin-bottom: 12px; color: #1a1a1a; }
          strong { font-weight: 600; color: #1a1a1a; }
          em { color: #6b7280; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
          .content { line-height: 1.7; }
          .list-item { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
          .bullet { color: #3b82f6; font-weight: bold; }
          @media (prefers-color-scheme: dark) {
            body { background-color: #1a1a1a; color: #e5e7eb; }
            h1, h2, h3, p, strong { color: #e5e7eb; }
            em { color: #9ca3af; }
            .header { border-bottom-color: #374151; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p><strong>Type:</strong> ${tabName} Notes</p>
          ${meeting?.start_time ? `<p><strong>Date:</strong> ${formatDate(meeting.start_time)}</p>` : ''}
        </div>
        <div class="content">
          ${formattedContent}
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
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
    
    // Enhanced markdown parsing for better mobile display
    return content
      // Handle headings first (must be at start of line or after line break)
      .replace(/(^|\n)### ([^\n]+)/g, '$1<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">$2</h3>')
      .replace(/(^|\n)## ([^\n]+)/g, '$1<h2 class="text-lg font-bold mt-6 mb-3 text-foreground">$2</h2>')
      .replace(/(^|\n)# ([^\n]+)/g, '$1<h1 class="text-xl font-bold mt-6 mb-4 text-foreground">$2</h1>')
      // Handle bold and italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-muted-foreground">$1</em>')
      // Handle lists
      .replace(/(^|\n)- ([^\n]+)/g, '$1<div class="flex items-start gap-2 my-1"><span class="text-primary">•</span><span class="flex-1">$2</span></div>')
      // Handle line breaks and paragraphs
      .replace(/\n\n/g, '</p><p class="mb-3 text-foreground leading-relaxed">')
      .replace(/\n/g, '<br/>')
      // Wrap in paragraph
      .replace(/^/, '<div class="prose prose-sm max-w-none"><p class="mb-3 text-foreground leading-relaxed">')
      .replace(/$/, '</p></div>');
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

  // Format content for sharing (converts markdown to readable plain text)
  const formatContentForSharing = (content: string) => {
    if (!content) return '';
    
    return content
      // Remove all heading markers (# ## ###) and clean up
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      .replace(/(\n)#{1,6}\s+(.+)$/gm, '$1$2')
      // Remove bold markers completely
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Remove italic markers
      .replace(/\*([^*]+)\*/g, '$1')
      // Convert bullet points to clean format
      .replace(/^-\s+(.+)$/gm, '• $1')
      .replace(/(\n)-\s+(.+)$/gm, '$1• $2')
      // Clean up multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Final cleanup
      .trim();
  };

  // Share using Web Share API if available
  const shareNotes = async () => {
    const rawContent = getCurrentTabContent();
    const formattedContent = formatContentForSharing(rawContent);
    const title = meeting?.title || 'Meeting Notes';
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    
    const shareContent = `${title} - ${tabName} Notes\n${meeting?.start_time ? `Date: ${formatDate(meeting.start_time)}\n` : ''}\n${formattedContent}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${tabName} Notes`,
          text: shareContent,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareContent);
        }
      }
    } else {
      copyToClipboard(shareContent);
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
            <div className="flex justify-between items-center p-3 pb-2 border-b flex-shrink-0">
              <TabsList className="grid w-full max-w-lg grid-cols-4 h-10">
                <TabsTrigger value="executive" className="text-xs px-2 font-medium">Exec</TabsTrigger>
                <TabsTrigger value="detailed" className="text-xs px-2 font-medium">Detail</TabsTrigger>
                <TabsTrigger value="comprehensive" className="text-xs px-2 font-medium">V.Detail</TabsTrigger>
                <TabsTrigger value="creative" className="text-xs px-2 font-medium">Creative</TabsTrigger>
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
                <div className="p-4 pb-8">
                  <TabsContent value="executive" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Executive Summary</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('executive')}
                        disabled={regenerating.executive}
                        className="h-8 px-2 text-xs"
                      >
                        {regenerating.executive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1">
                          {regenerating.executive ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="bg-card rounded-lg border p-4">
                      {notesStyle4 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle4) }}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4 text-sm">
                            No executive summary available
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => regenerateNotes('executive')}
                            disabled={regenerating.executive}
                            className="text-xs"
                          >
                            Generate Executive Summary
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="detailed" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Detailed Minutes</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('detailed')}
                        disabled={regenerating.detailed}
                        className="h-8 px-2 text-xs"
                      >
                        {regenerating.detailed ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1">
                          {regenerating.detailed ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="bg-card rounded-lg border p-4">
                      {notesStyle2 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle2) }}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4 text-sm">
                            No detailed minutes available
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => regenerateNotes('detailed')}
                            disabled={regenerating.detailed}
                            className="text-xs"
                          >
                            Generate Detailed Minutes
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="comprehensive" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Very Detailed</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('comprehensive')}
                        disabled={regenerating.comprehensive}
                        className="h-8 px-2 text-xs"
                      >
                        {regenerating.comprehensive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1">
                          {regenerating.comprehensive ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="bg-card rounded-lg border p-4">
                      {notesStyle3 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle3) }}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4 text-sm">
                            No very detailed notes available
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => regenerateNotes('comprehensive')}
                            disabled={regenerating.comprehensive}
                            className="text-xs"
                          >
                            Generate Very Detailed Notes
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="creative" className="mt-0">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Creative Summary</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateNotes('creative')}
                        disabled={regenerating.creative}
                        className="h-8 px-2 text-xs"
                      >
                        {regenerating.creative ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1">
                          {regenerating.creative ? 'Generating...' : 'Regenerate'}
                        </span>
                      </Button>
                    </div>
                    <div className="bg-card rounded-lg border p-4">
                      {notesStyle5 ? (
                        <div 
                          className="text-sm leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatContent(notesStyle5) }}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4 text-sm">
                            No creative summary available
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => regenerateNotes('creative')}
                            disabled={regenerating.creative}
                            className="text-xs"
                          >
                            Generate Creative Summary
                          </Button>
                        </div>
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