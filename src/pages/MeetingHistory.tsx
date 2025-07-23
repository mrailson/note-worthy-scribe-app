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
import { Plus, Clock, FileText, Trash2, Edit, Mail, RefreshCw, Square, CheckSquare } from "lucide-react";
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

  const handleNewMeeting = () => {
    navigate("/");
  };

  const handleViewMeetingSummary = async (meetingId: string) => {
    try {
      // Fetch meeting details
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
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
      
      setMeetingSummary(data.summary);
      
      // Save to database
      await supabase
        .from('meeting_summaries')
        .upsert({
          meeting_id: selectedMeeting.id,
          summary: data.summary,
          key_points: data.key_points || [],
          action_items: data.action_items || [],
          decisions: data.decisions || [],
          next_steps: data.next_steps || []
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
      
      // First get meetings
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (meetingsError) throw meetingsError;

      // Then get transcript counts and summaries separately to avoid duplicates
      const meetingIds = meetingsData?.map(m => m.id) || [];
      
      const [transcriptData, summaryData] = await Promise.all([
        supabase
          .from('meeting_transcripts')
          .select('meeting_id')
          .in('meeting_id', meetingIds),
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
      ]);

      // Count transcripts and check for summaries
      const transcriptCounts = transcriptData.data?.reduce((acc, t) => {
        acc[t.meeting_id] = (acc[t.meeting_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const summaryExists = summaryData.data?.reduce((acc, s) => {
        acc[s.meeting_id] = true;
        return acc;
      }, {} as Record<string, boolean>) || {};

      const enrichedMeetings = meetingsData?.map(meeting => ({
        ...meeting,
        transcript_count: transcriptCounts[meeting.id] || 0,
        summary_exists: !!summaryExists[meeting.id]
      })) || [];

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
              <div>
                <CardTitle>{selectedMeeting.title}</CardTitle>
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
              <Tabs defaultValue="minutes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="minutes">AI Generated Minutes</TabsTrigger>
                  <TabsTrigger value="details">Meeting Details</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                </TabsList>
                
                <TabsContent value="minutes" className="mt-4">
                  <div className="space-y-4">
                    {meetingSummary ? (
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap text-sm">{meetingSummary}</pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No AI-generated minutes available for this meeting.</p>
                        <Button 
                          onClick={handleGenerateNotes}
                          disabled={isGeneratingNotes || !meetingTranscript}
                          className="touch-manipulation min-h-[44px]"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                          {isGeneratingNotes ? 'Generating...' : 'Generate Minutes'}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="details" className="mt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                    {selectedMeeting.description && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1">{selectedMeeting.description}</p>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button 
                          onClick={handleGenerateNotes}
                          disabled={isGeneratingNotes || !meetingTranscript}
                          className="flex-1 touch-manipulation min-h-[44px]"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                          {isGeneratingNotes ? 'Generating...' : 'Regenerate Notes'}
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
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="transcript" className="mt-4">
                  <div className="space-y-4">
                    {meetingTranscript ? (
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                          {meetingTranscript}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No transcript available for this meeting.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <MeetingHistoryList 
            meetings={filteredMeetings}
            onEdit={handleMeetingEdit}
            onViewSummary={handleViewMeetingSummary}
            onDelete={handleMeetingDelete}
            loading={loading}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
          />
        )}

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