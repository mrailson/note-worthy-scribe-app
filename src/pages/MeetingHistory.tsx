import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingSearchBar, SearchFilters } from "@/components/MeetingSearchBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Clock, FileText, Trash2, Edit, Edit2, Mail, RefreshCw, Square, CheckSquare, ChevronDown, Copy, Sparkles, Save, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { useNavigate } from "react-router-dom";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  created_at: string;
  location?: string | null;
  format?: string | null;
  transcript_count?: number;
  summary_exists?: boolean;
}

const MeetingHistory = () => {
  const { user } = useAuth();
  
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Multi-select functionality
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Advanced search filters
  const [advancedFilters, setAdvancedFilters] = useState<Partial<SearchFilters>>({
    dateFrom: "",
    dateTo: "",
    durationMin: "",
    durationMax: "",
    location: "",
    format: "all"
  });
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMeetingType, setEditMeetingType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Meeting detail view state
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [meetingSummary, setMeetingSummary] = useState("");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  // Transcript view state
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [viewingTranscript, setViewingTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);
  const [currentMeetingForTranscript, setCurrentMeetingForTranscript] = useState<Meeting | null>(null);

  const [isSavingCleanedTranscript, setIsSavingCleanedTranscript] = useState(false);

  const handleNewMeeting = () => {
    navigate("/");
  };

  const handleViewMeetingSummary = async (meetingId: string) => {
    try {
      // Fetch meeting details
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) throw meetingError;

      // Fetch transcript
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      if (transcriptError) throw transcriptError;

      // Fetch existing summary if available
      const { data: summaryData, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      const fullTranscript = transcripts?.map(t => t.content).join(' ') || '';
      
      setSelectedMeeting(meeting);
      setMeetingTranscript(fullTranscript);
      setMeetingSummary(summaryData?.summary || '');
    } catch (error: any) {
      console.error("Error Loading Meeting:", error.message);
    }
  };

  const handleGenerateNotes = async () => {
    if (!selectedMeeting || !meetingTranscript) return;
    
    setIsGeneratingNotes(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: meetingTranscript,
          meetingTitle: selectedMeeting.title,
          meetingType: selectedMeeting.meeting_type
        }
      });

      if (error) throw error;
      
      setMeetingSummary(data.meetingMinutes);
      
      // Save to database
      await supabase
        .from('meeting_summaries')
        .upsert({
          meeting_id: selectedMeeting.id,
          summary: data.meetingMinutes,
          key_points: [],
          action_items: [],
          decisions: [],
          next_steps: []
        });
        
    } catch (error: any) {
      console.error("Error generating notes:", error.message);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleEmailNotes = async () => {
    if (!selectedMeeting || !meetingSummary) return;
    
    try {
      const { error } = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          to: user?.email,
          meetingTitle: selectedMeeting.title,
          summary: meetingSummary,
          meetingDate: new Date(selectedMeeting.start_time).toLocaleDateString()
        }
      });

      if (error) throw error;
      console.log("Meeting notes emailed successfully");
    } catch (error: any) {
      console.error("Error emailing notes:", error.message);
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    try {
      // Fetch meeting details
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) throw meetingError;

      // Fetch transcript for the specific meeting
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      if (transcriptError) throw transcriptError;

      const fullTranscript = transcripts?.map(t => t.content).join(' ') || '';
      setViewingTranscript(fullTranscript);
      setCurrentMeetingForTranscript(meeting);
      setCleanedTranscript(""); // Reset cleaned transcript
      setTranscriptDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading transcript:", error.message);
    }
  };

  const copyTranscriptToClipboard = async () => {
    try {
      const textToCopy = cleanedTranscript || viewingTranscript;
      await navigator.clipboard.writeText(textToCopy);
      console.log("Transcript copied to clipboard");
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  const cleanCurrentTranscript = async () => {
    if (!viewingTranscript || !currentMeetingForTranscript) return;
    
    setIsCleaningTranscript(true);
    try {
      // Remove speaker labels and join with spaces
      const rawTranscript = viewingTranscript
        .split('\n')
        .map(line => line.replace(/^Speaker \d+:\s*/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');

      // Clean the transcript using AI
      const { data: cleanData, error: cleanError } = await supabase.functions.invoke('clean-transcript', {
        body: {
          rawTranscript: rawTranscript,
          meetingTitle: currentMeetingForTranscript.title
        }
      });

      if (cleanError || !cleanData?.cleanedTranscript) {
        throw new Error('Failed to clean transcript');
      }

      setCleanedTranscript(cleanData.cleanedTranscript);
      console.log(`Transcript cleaned for "${currentMeetingForTranscript.title}"`);
    } catch (error) {
      console.error('Error cleaning transcript:', error);
    } finally {
      setIsCleaningTranscript(false);
    }
  };

  const saveCleanedTranscript = async () => {
    if (!cleanedTranscript || !currentMeetingForTranscript) return;
    
    setIsSavingCleanedTranscript(true);
    try {
      // First, delete all existing transcript records for this meeting
      const { error: deleteError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', currentMeetingForTranscript.id);

      if (deleteError) throw deleteError;

      // Then, insert a single new record with the cleaned transcript
      const { error: insertError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: currentMeetingForTranscript.id,
          content: cleanedTranscript,
          speaker_name: 'AI Cleaned Transcript',
          timestamp_seconds: 0,
          confidence_score: 1.0,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      console.log('Cleaned transcript saved successfully');
      setViewingTranscript(cleanedTranscript); // Update the original to match cleaned
      
      // Also update the main meeting transcript if this meeting is currently selected
      if (selectedMeeting?.id === currentMeetingForTranscript.id) {
        setMeetingTranscript(cleanedTranscript);
      }
      
      // Show success feedback
      console.log('✅ Transcript replaced with cleaned version');
    } catch (error) {
      console.error('Error saving cleaned transcript:', error);
    } finally {
      setIsSavingCleanedTranscript(false);
    }
  };

  const downloadTranscriptAsWord = async () => {
    if (!currentMeetingForTranscript) return;
    
    const transcriptToUse = cleanedTranscript || viewingTranscript;
    if (!transcriptToUse) return;

    try {
      // Create comprehensive meeting details
      const meetingDate = new Date(currentMeetingForTranscript.start_time);
      const formattedDate = meetingDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = meetingDate.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Create Word document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // Title
              new Paragraph({
                children: [
                  new TextRun({
                    text: currentMeetingForTranscript.title,
                    bold: true,
                    size: 32,
                  }),
                ],
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              
              // Meeting Details Header
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Meeting Details",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 200 },
              }),
              
              // Meeting Information
              new Paragraph({
                children: [
                  new TextRun({ text: "Date: ", bold: true }),
                  new TextRun({ text: formattedDate }),
                ],
                spacing: { after: 100 },
              }),
              
              new Paragraph({
                children: [
                  new TextRun({ text: "Time: ", bold: true }),
                  new TextRun({ text: formattedTime }),
                ],
                spacing: { after: 100 },
              }),
              
              new Paragraph({
                children: [
                  new TextRun({ text: "Type: ", bold: true }),
                  new TextRun({ text: currentMeetingForTranscript.meeting_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }),
                ],
                spacing: { after: 100 },
              }),
              
              ...(currentMeetingForTranscript.duration_minutes ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Duration: ", bold: true }),
                    new TextRun({ text: `${currentMeetingForTranscript.duration_minutes} minutes` }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.location ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Location: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.location }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.format ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Format: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online' }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.description ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Description: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.description }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              // Transcript Header
              new Paragraph({
                children: [
                  new TextRun({
                    text: cleanedTranscript ? "AI-Enhanced Transcript" : "Meeting Transcript",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              
              ...(cleanedTranscript ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "This transcript has been processed with AI to remove filler words, improve grammar, and enhance readability while preserving the original meaning.",
                      italics: true,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 200 },
                })
              ] : []),
              
              // Transcript Content - Split into paragraphs to preserve spacing
              ...(function() {
                // Split the transcript into paragraphs (the AI creates natural paragraph breaks)
                const paragraphs = transcriptToUse.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                
                return paragraphs.map(paragraphText => 
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: paragraphText.trim(),
                        size: 22,
                      }),
                    ],
                    spacing: { 
                      before: 120,  // Space before paragraph
                      after: 120,   // Space after paragraph
                      lineRule: "atLeast", 
                      line: 360     // 1.5 line spacing within paragraph
                    },
                    alignment: AlignmentType.JUSTIFIED, // Makes text look more professional
                  })
                );
              })(),
              
              // Footer
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400 },
              }),
            ],
          },
        ],
      });

      // Generate and download the document
      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentMeetingForTranscript.title} - ${formattedDate.replace(/,/g, '')} - ${cleanedTranscript ? 'AI Enhanced ' : ''}Transcript.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Word document downloaded successfully');
    } catch (error) {
      console.error('Error creating Word document:', error);
    }
  };

  const formatMeetingTitle = (meeting: Meeting) => {
    const date = new Date(meeting.start_time);
    const formattedDate = date.toLocaleDateString('en-GB', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    const formattedTime = date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `${meeting.title} - ${formattedDate} at ${formattedTime}${meeting.location ? ` (${meeting.location})` : ''}`;
  };


  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user]);

  useEffect(() => {
    filterMeetings();
  }, [meetings, searchQuery, filterType, advancedFilters]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      
      // Get everything in one optimized query using joins
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          meeting_type,
          start_time,
          end_time,
          duration_minutes,
          status,
          created_at,
          location,
          format,
          audio_backup_path,
          audio_backup_created_at,
          requires_audio_backup,
          meeting_overviews(overview)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10); // Limit initial load for performance

      if (meetingsError) throw meetingsError;

      if (!meetingsData || meetingsData.length === 0) {
        setMeetings([]);
        return;
      }

      // Batch the remaining queries efficiently
      const meetingIds = meetingsData.map(m => m.id);
      
      const [transcriptCounts, summaryExists] = await Promise.all([
        // Get transcript counts in one query
        supabase
          .from('meeting_transcripts')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            return data?.reduce((acc, t) => {
              acc[t.meeting_id] = (acc[t.meeting_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>) || {};
          }),
        
        // Get summary existence in one query
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            return data?.reduce((acc, s) => {
              acc[s.meeting_id] = true;
              return acc;
            }, {} as Record<string, boolean>) || {};
          })
      ]);

      const enrichedMeetings = meetingsData.map(meeting => ({
        ...meeting,
        transcript_count: transcriptCounts[meeting.id] || 0,
        summary_exists: !!summaryExists[meeting.id]
      }));

      setMeetings(enrichedMeetings);
    } catch (error: any) {
      console.error("Error Loading Meetings:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterMeetings = () => {
    let filtered = meetings;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.title.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query) ||
        meeting.location?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(meeting => meeting.meeting_type === filterType);
    }

    // Apply advanced filters
    if (advancedFilters.dateFrom) {
      const fromDate = new Date(advancedFilters.dateFrom);
      filtered = filtered.filter(meeting => new Date(meeting.start_time) >= fromDate);
    }

    if (advancedFilters.dateTo) {
      const toDate = new Date(advancedFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(meeting => new Date(meeting.start_time) <= toDate);
    }

    if (advancedFilters.durationMin) {
      const minDuration = parseInt(advancedFilters.durationMin);
      filtered = filtered.filter(meeting => 
        meeting.duration_minutes !== null && meeting.duration_minutes >= minDuration
      );
    }

    if (advancedFilters.durationMax) {
      const maxDuration = parseInt(advancedFilters.durationMax);
      filtered = filtered.filter(meeting => 
        meeting.duration_minutes !== null && meeting.duration_minutes <= maxDuration
      );
    }

    if (advancedFilters.location && advancedFilters.location.trim()) {
      const locationQuery = advancedFilters.location.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.location?.toLowerCase().includes(locationQuery)
      );
    }

    if (advancedFilters.format && advancedFilters.format !== "all") {
      filtered = filtered.filter(meeting => meeting.format === advancedFilters.format);
    }
    
    setFilteredMeetings(filtered);
  };

  const handleMeetingEdit = (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setEditingMeeting(meeting);
      setEditTitle(meeting.title);
      setEditMeetingType(meeting.meeting_type);
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMeeting || !editTitle.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          title: editTitle.trim(),
          meeting_type: editMeetingType,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMeeting.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("Meeting Updated - Meeting has been successfully updated");

      setEditDialogOpen(false);
      setEditingMeeting(null);
      setEditTitle("");
      setEditMeetingType("");
      
      // Update the selected meeting if it's currently being viewed
      if (selectedMeeting?.id === editingMeeting.id) {
        setSelectedMeeting({
          ...selectedMeeting,
          title: editTitle.trim(),
          meeting_type: editMeetingType
        });
      }
      
      fetchMeetings(); // Refresh the list
    } catch (error: any) {
      console.error("Error Updating Meeting:", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingMeeting(null);
    setEditTitle("");
    setEditMeetingType("");
  };

  const handleMeetingDelete = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("Meeting Deleted - Meeting has been successfully deleted");

      fetchMeetings();
    } catch (error: any) {
      console.error("Error Deleting Meeting:", error.message);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("All Meetings Deleted - All meetings have been successfully deleted");

      setDeleteConfirmation("");
      fetchMeetings();
    } catch (error: any) {
      console.error("Error Deleting Meetings:", error.message);
    }
  };

  // Multi-select handlers
  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const handleSelectAll = () => {
    if (selectedMeetings.length === filteredMeetings.length) {
      setSelectedMeetings([]);
    } else {
      setSelectedMeetings(filteredMeetings.map(m => m.id));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log(`${selectedMeetings.length} meetings deleted successfully`);
      
      setSelectedMeetings([]);
      setIsSelectMode(false);
      fetchMeetings();
    } catch (error: any) {
      console.error("Error deleting selected meetings:", error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading meetings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Meeting History</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                View, edit, and manage your saved meetings
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleNewMeeting}
            className="bg-gradient-primary hover:bg-primary-hover shadow-medium w-full sm:w-auto touch-manipulation min-h-[48px]"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Meeting
          </Button>
        </div>

        {/* Stats Cards - Hidden on mobile, collapsible on larger screens */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{meetings.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {meetings.filter(m => 
                  new Date(m.created_at).getMonth() === new Date().getMonth()
                ).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Summaries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {meetings.filter(m => m.summary_exists).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <MeetingSearchBar 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          resultsCount={filteredMeetings.length}
          filterType={filterType}
          onFilterChange={setFilterType}
          onAdvancedFiltersChange={setAdvancedFilters}
          advancedFilters={advancedFilters}
        />

        {/* Multi-select and Delete Controls */}
        {meetings.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Multi-select controls */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedMeetings([]);
                }}
                className="touch-manipulation min-h-[44px]"
              >
                {isSelectMode ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Cancel Selection
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select Multiple
                  </>
                )}
              </Button>
              
              {isSelectMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                  >
                    {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  
                  {selectedMeetings.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedMeetings.length} selected
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Delete actions */}
            <div className="flex gap-2">
              {isSelectMode && selectedMeetings.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedMeetings.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Selected Meetings</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm">
                        This action will permanently delete {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''}, their transcripts, and summaries. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="touch-manipulation min-h-[44px]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteSelected}
                        className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                      >
                        Delete Selected
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Meetings</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
                      This action will permanently delete all {meetings.length} meetings, their transcripts, and summaries. This cannot be undone.
                      <br /><br />
                      To confirm, please type <strong>delete</strong> in the field below:
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    placeholder="Type 'delete' to confirm"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="touch-manipulation min-h-[44px]"
                  />
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel 
                      onClick={() => setDeleteConfirmation("")}
                      className="touch-manipulation min-h-[44px]"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAll}
                      disabled={deleteConfirmation.toLowerCase() !== 'delete'}
                      className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                    >
                      Delete All Meetings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}


        {/* Meeting Detail View or Meetings List */}
        {selectedMeeting ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex-1">
                {editingMeeting?.id === selectedMeeting.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-semibold"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editTitle.trim()}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CardTitle>{selectedMeeting.title}</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMeetingEdit(selectedMeeting.id)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">
                  {new Date(selectedMeeting.start_time).toLocaleDateString()}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setSelectedMeeting(null)}
                className="touch-manipulation min-h-[44px]"
              >
                Back to List
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Meeting Notes Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Meeting Notes</h3>
                  {meetingSummary ? (
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg border">
                        {meetingSummary}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/50 rounded-lg border">
                      <p className="text-muted-foreground mb-4">No AI-generated notes available for this meeting.</p>
                      <Button 
                        onClick={handleGenerateNotes}
                        disabled={isGeneratingNotes || !meetingTranscript}
                        className="touch-manipulation min-h-[44px]"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                        {isGeneratingNotes ? 'Generating...' : 'Generate Notes'}
                      </Button>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  {meetingSummary && (
                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                      <Button 
                        onClick={handleGenerateNotes}
                        disabled={isGeneratingNotes || !meetingTranscript}
                        variant="outline"
                        className="flex-1 touch-manipulation min-h-[44px]"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                        {isGeneratingNotes ? 'Regenerating...' : 'Regenerate Notes'}
                      </Button>
                      
                      <Button 
                        onClick={handleEmailNotes}
                        disabled={!meetingSummary}
                        variant="outline"
                        className="flex-1 touch-manipulation min-h-[44px]"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email Notes
                      </Button>
                    </div>
                  )}
                </div>

                {/* Transcript Section - Collapsible */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="transcript" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Transcript
                        {meetingTranscript && (
                          <span className="text-sm text-muted-foreground font-normal">
                            ({meetingTranscript.split(' ').length} words)
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {meetingTranscript ? (
                        <div className="prose max-w-none">
                          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                            {meetingTranscript}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No transcript available for this meeting.</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Meeting Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Meeting Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                      <p className="text-sm">{selectedMeeting.title}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                      <p className="text-sm">{selectedMeeting.meeting_type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                      <p className="text-sm">{new Date(selectedMeeting.start_time).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Time</Label>
                      <p className="text-sm">{new Date(selectedMeeting.start_time).toLocaleTimeString()}</p>
                    </div>
                    {selectedMeeting.duration_minutes && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                        <p className="text-sm">{selectedMeeting.duration_minutes} minutes</p>
                      </div>
                    )}
                    {selectedMeeting.location && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                        <p className="text-sm">{selectedMeeting.location}</p>
                      </div>
                    )}
                    {selectedMeeting.format && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Format</Label>
                        <p className="text-sm">{selectedMeeting.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online'}</p>
                      </div>
                    )}
                    {selectedMeeting.status && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <p className="text-sm capitalize">{selectedMeeting.status}</p>
                      </div>
                    )}
                    {selectedMeeting.description && (
                      <div className="sm:col-span-2">
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1">{selectedMeeting.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <MeetingHistoryList 
            meetings={filteredMeetings}
            onEdit={handleMeetingEdit}
            onViewSummary={handleViewMeetingSummary}
            onViewTranscript={handleViewTranscript}
            onDelete={handleMeetingDelete}
            loading={loading}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
          />
        )}

        {/* Enhanced Transcript View Dialog with AI Cleaning */}
        <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
          <DialogContent className="mx-4 max-w-5xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Meeting Transcript
              </DialogTitle>
              {currentMeetingForTranscript && (
                <DialogDescription className="space-y-1">
                  <div className="font-medium text-foreground">
                    {formatMeetingTitle(currentMeetingForTranscript)}
                  </div>
                  <div className="text-sm">
                    {currentMeetingForTranscript.meeting_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {currentMeetingForTranscript.duration_minutes && ` • ${currentMeetingForTranscript.duration_minutes} minutes`}
                    {currentMeetingForTranscript.format && ` • ${currentMeetingForTranscript.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online'}`}
                  </div>
                  <div className="text-xs">
                    View the original transcript or clean it with AI to remove filler words and improve formatting.
                  </div>
                </DialogDescription>
              )}
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {(cleanedTranscript || viewingTranscript).split(' ').length} words
                  </span>
                  {cleanedTranscript && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      ✨ AI Cleaned
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    onClick={cleanCurrentTranscript}
                    disabled={isCleaningTranscript || !viewingTranscript}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                  >
                    {isCleaningTranscript ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isCleaningTranscript ? 'Cleaning...' : 'Clean with AI'}
                  </Button>
                  
                  {cleanedTranscript && (
                    <Button
                      onClick={saveCleanedTranscript}
                      disabled={isSavingCleanedTranscript}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                    >
                      {isSavingCleanedTranscript ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isSavingCleanedTranscript ? 'Saving...' : 'Save Cleaned'}
                    </Button>
                  )}
                  
                  <Button
                    onClick={downloadTranscriptAsWord}
                    disabled={!viewingTranscript}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Word
                  </Button>
                  
                  <Button
                    onClick={copyTranscriptToClipboard}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy {cleanedTranscript ? 'Cleaned' : 'Original'}
                  </Button>
                </div>
              </div>

              {/* Transcript Display */}
              <Tabs defaultValue="display" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="display">
                    {cleanedTranscript ? 'Cleaned Transcript' : 'Current Transcript'}
                  </TabsTrigger>
                  <TabsTrigger value="comparison" disabled={!cleanedTranscript}>
                    Compare Versions
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="display" className="space-y-4">
                  <div className="border rounded-lg p-4 bg-background max-h-[50vh] overflow-y-auto">
                    {cleanedTranscript ? (
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {cleanedTranscript}
                        </div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
                        {viewingTranscript || "No transcript available for this meeting."}
                      </pre>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="comparison" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Original Transcript</h4>
                      <div className="border rounded-lg p-4 bg-muted/30 max-h-[45vh] overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
                          {viewingTranscript}
                        </pre>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-green-700 dark:text-green-400">AI Cleaned Transcript</h4>
                      <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/30 max-h-[45vh] overflow-y-auto">
                        <div className="prose max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {cleanedTranscript}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <DialogFooter>
              <Button 
                onClick={() => {
                  setTranscriptDialogOpen(false);
                  setCleanedTranscript("");
                  setCurrentMeetingForTranscript(null);
                }}
                className="touch-manipulation min-h-[44px]"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Meeting Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
              <DialogDescription>
                Update the meeting name and type. Changes will be saved immediately.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Meeting Name</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter meeting name"
                  className="w-full touch-manipulation min-h-[44px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-type">Meeting Type</Label>
                <Select value={editMeetingType} onValueChange={setEditMeetingType}>
                  <SelectTrigger className="w-full touch-manipulation min-h-[44px]">
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="patient-consultation">Patient Meeting</SelectItem>
                    <SelectItem value="team-meeting">Team Meeting</SelectItem>
                    <SelectItem value="clinical-review">Clinical Review</SelectItem>
                    <SelectItem value="training">Training Session</SelectItem>
                    <SelectItem value="pcn-meeting">PCN Meeting</SelectItem>
                    <SelectItem value="icb-meeting">ICB Meeting</SelectItem>
                    <SelectItem value="neighbourhood-meeting">Neighbourhood Meeting</SelectItem>
                    <SelectItem value="federation">Federation</SelectItem>
                    <SelectItem value="locality">Locality</SelectItem>
                    <SelectItem value="lmc">LMC</SelectItem>
                    <SelectItem value="gp-partners">GP Partners Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="w-full sm:w-auto touch-manipulation min-h-[44px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="w-full sm:w-auto touch-manipulation min-h-[44px]"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MeetingHistory;