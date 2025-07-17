import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingSearchBar } from "@/components/MeetingSearchBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, FileText } from "lucide-react";
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

  const handleNewMeeting = () => {
    navigate("/");
  };

  const handleHelp = () => {
    console.log("Help & About clicked");
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
      
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_transcripts(count),
          meeting_summaries(id)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (meetingsError) throw meetingsError;

      const enrichedMeetings = meetingsData?.map(meeting => ({
        ...meeting,
        transcript_count: meeting.meeting_transcripts?.[0]?.count || 0,
        summary_exists: !!meeting.meeting_summaries?.[0]?.id
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
    navigate(`/?edit=${meetingId}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} onHelp={handleHelp} />
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
      <Header onNewMeeting={handleNewMeeting} onHelp={handleHelp} />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Meeting History</h1>
              <p className="text-muted-foreground">
                View, edit, and manage your saved meetings
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleNewMeeting}
            className="bg-gradient-primary hover:bg-primary-hover shadow-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Meeting
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Meetings List */}
        <MeetingHistoryList 
          meetings={filteredMeetings}
          onEdit={handleMeetingEdit}
          onDelete={handleMeetingDelete}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default MeetingHistory;