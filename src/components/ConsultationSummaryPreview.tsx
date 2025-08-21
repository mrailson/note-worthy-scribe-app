import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Clock, Users, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface RecentConsultation {
  id: string;
  title: string;
  duration_minutes: number;
  created_at: string;
  summary?: string;
}

export const ConsultationSummaryPreview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentConsultations, setRecentConsultations] = useState<RecentConsultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRecentConsultations();
    }
  }, [user]);

  const fetchRecentConsultations = async () => {
    try {
      setIsLoading(true);
      
      // Fetch recent meetings that could be consultations
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          duration_minutes,
          created_at,
          meeting_summaries(summary)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching consultations:', error);
        return;
      }

      if (meetings) {
        const consultations = meetings.map(meeting => ({
          id: meeting.id,
          title: meeting.title || 'Untitled Consultation',
          duration_minutes: meeting.duration_minutes || 0,
          created_at: meeting.created_at,
          summary: (meeting as any).meeting_summaries?.[0]?.summary
        }));
        
        setRecentConsultations(consultations);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewFull = (consultationId: string) => {
    navigate(`/consultation/summary?meetingId=${consultationId}`);
  };

  if (isLoading) {
    return (
      <div className="w-80 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-3 bg-muted rounded"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 max-h-96 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Recent Consultations
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/consultation/summary')}
            className="text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View All
          </Button>
        </div>

        {recentConsultations.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No recent consultations found
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => navigate('/gp-scribe')}
              >
                Start New Consultation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentConsultations.map((consultation) => (
              <Card key={consultation.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {consultation.title}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {consultation.duration_minutes}m
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {formatDate(consultation.created_at)}
                    </p>
                    
                    {consultation.summary && (
                      <p className="text-xs text-foreground line-clamp-2">
                        {consultation.summary}
                      </p>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleViewFull(consultation.id)}
                    >
                      View Summary
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <Separator />
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => navigate('/gp-scribe')}
          >
            <FileText className="h-3 w-3 mr-1" />
            New Consultation
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => navigate('/consultation/summary')}
          >
            <Users className="h-3 w-3 mr-1" />
            View All
          </Button>
        </div>
      </div>
    </div>
  );
};