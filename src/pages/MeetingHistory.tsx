import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingSearchBar } from "@/components/MeetingSearchBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, FileText, Trash2, Edit } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
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
  transcript_count?: number;
  summary_exists?: boolean;
}

const MeetingHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMeetingType, setEditMeetingType] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

      // Combine all transcript content
      const fullTranscript = transcripts?.map(t => t.content).join(' ') || '';
      const wordCount = fullTranscript.split(' ').length;

      // Calculate duration
      const startTime = new Date(meeting.start_time);
      const endTime = meeting.end_time ? new Date(meeting.end_time) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      const durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);
      const duration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

      // Navigate to meeting summary with data
      navigate('/meeting-summary', {
        state: {
          id: meeting.id,
          title: meeting.title,
          duration: duration,
          wordCount: wordCount,
          transcript: fullTranscript,
          speakerCount: 1,
          startTime: meeting.start_time,
          practiceName: ""
        }
      });
    } catch (error: any) {
      toast({
        title: "Error Loading Meeting",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user]);

  useEffect(() => {
    filterMeetings();
  }, [meetings, searchQuery]);

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
      toast({
        title: "Error Loading Meetings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterMeetings = () => {
    if (!searchQuery.trim()) {
      setFilteredMeetings(meetings);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = meetings.filter(meeting =>
      meeting.title.toLowerCase().includes(query) ||
      meeting.description?.toLowerCase().includes(query) ||
      meeting.meeting_type.toLowerCase().includes(query)
    );
    
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

      toast({
        title: "Meeting Updated",
        description: "Meeting has been successfully updated",
      });

      setEditDialogOpen(false);
      setEditingMeeting(null);
      setEditTitle("");
      setEditMeetingType("");
      fetchMeetings(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error Updating Meeting",
        description: error.message,
        variant: "destructive",
      });
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

      toast({
        title: "Meeting Deleted",
        description: "Meeting has been successfully deleted",
      });

      fetchMeetings();
    } catch (error: any) {
      toast({
        title: "Error Deleting Meeting",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "All Meetings Deleted",
        description: "All meetings have been successfully deleted",
      });

      setDeleteConfirmation("");
      fetchMeetings();
    } catch (error: any) {
      toast({
        title: "Error Deleting Meetings",
        description: error.message,
        variant: "destructive",
      });
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        />

        {/* Delete All Button */}
        {meetings.length > 0 && (
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Meetings
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
        )}

        {/* Meetings List */}
        <MeetingHistoryList 
          meetings={filteredMeetings}
          onEdit={handleMeetingEdit}
          onViewSummary={handleViewMeetingSummary}
          onDelete={handleMeetingDelete}
          loading={loading}
        />

        {/* Edit Meeting Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
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
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-type">Meeting Type</Label>
                <Select value={editMeetingType} onValueChange={setEditMeetingType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="patient-consultation">Patient Meeting (Complaint Handling or other Administration Reason)</SelectItem>
                    <SelectItem value="team-meeting">Team Meeting</SelectItem>
                    <SelectItem value="clinical-review">Clinical Review</SelectItem>
                    <SelectItem value="training">Training Session</SelectItem>
                    <SelectItem value="pcn-meeting">PCN Meeting</SelectItem>
                    <SelectItem value="icb-meeting">ICB Meeting</SelectItem>
                    <SelectItem value="neighbourhood-meeting">Neighbourhood Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="w-full sm:w-auto"
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