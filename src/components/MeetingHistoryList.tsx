import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar, 
  FileText, 
  Eye,
  Trash2, 
  Play,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Edit
} from "lucide-react";
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
import { format } from "date-fns";

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

interface MeetingHistoryListProps {
  meetings: Meeting[];
  onEdit: (meetingId: string) => void;
  onViewSummary: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  loading: boolean;
}

export const MeetingHistoryList = ({ 
  meetings, 
  onEdit, 
  onViewSummary,
  onDelete, 
  loading 
}: MeetingHistoryListProps) => {
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'completed': { variant: 'default' as const, label: 'Completed' },
      'in-progress': { variant: 'secondary' as const, label: 'In Progress' },
      'scheduled': { variant: 'outline' as const, label: 'Scheduled' },
      'cancelled': { variant: 'destructive' as const, label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['scheduled'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMeetingTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'general': 'General Meeting',
      'patient-consultation': 'Patient Meeting',
      'team-meeting': 'Team Meeting',
      'clinical-review': 'Clinical Review',
      'training': 'Training Session',
      'pcn-meeting': 'PCN Meeting',
      'icb-meeting': 'ICB Meeting',
      'neighbourhood-meeting': 'Neighbourhood Meeting',
      'federation': 'Federation',
      'locality': 'Locality',
      'lmc': 'LMC',
    };
    return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'No duration';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const generateOverview = (meeting: Meeting) => {
    const words = [];
    
    // Add meeting type
    words.push(getMeetingTypeLabel(meeting.meeting_type));
    
    // Add date
    words.push('on', format(new Date(meeting.start_time), 'MMM d, yyyy'));
    
    // Add duration if available
    if (meeting.duration_minutes) {
      words.push('lasting', formatDuration(meeting.duration_minutes));
    }
    
    // Add status context
    const statusContext = {
      'completed': 'successfully completed',
      'in-progress': 'currently in progress',
      'scheduled': 'scheduled for the future',
      'cancelled': 'was cancelled'
    };
    words.push('and', statusContext[meeting.status as keyof typeof statusContext] || 'is scheduled');
    
    // Add description excerpt if available
    if (meeting.description) {
      const descWords = meeting.description.split(' ').slice(0, 15);
      words.push('-', ...descWords);
    }
    
    // Add transcript/summary info
    if (meeting.transcript_count) {
      words.push('with', meeting.transcript_count.toString(), 'transcript entries');
    }
    if (meeting.summary_exists) {
      words.push('and summary available');
    }
    
    // Limit to 40 words
    return words.slice(0, 40).join(' ');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
          <p className="text-muted-foreground mb-4">
            Start by creating your first meeting or adjust your search criteria.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Create First Meeting
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Card key={meeting.id} className="hover:shadow-medium transition-shadow">
          <CardHeader className="pb-3">
            {/* Mobile-first layout */}
            <div className="space-y-3">
              {/* Title and Status Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(meeting.status)}
                    <h3 className="font-semibold text-base sm:text-lg truncate pr-2">{meeting.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getMeetingTypeLabel(meeting.meeting_type)}
                    </Badge>
                    {getStatusBadge(meeting.status)}
                  </div>
                </div>
              </div>

              {/* Date and Duration Row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{format(new Date(meeting.start_time), 'MMM d, yyyy h:mm a')}</span>
                </div>
                
                {meeting.duration_minutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span>{formatDuration(meeting.duration_minutes)}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons - Mobile Optimized */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewSummary(meeting.id)}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                >
                  <Eye className="h-4 w-4" />
                  <span>View Summary</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(meeting.id)}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-destructive hover:text-destructive touch-manipulation min-h-[44px]"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{meeting.title}"? This action cannot be undone.
                        This will permanently delete the meeting, transcript, and summary.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="touch-manipulation min-h-[44px]">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onDelete(meeting.id)}
                        className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Meeting Overview */}
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {generateOverview(meeting)}
              </p>
              
              {/* Meeting Stats - Mobile Responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  {meeting.transcript_count ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3 flex-shrink-0" />
                      <span>{meeting.transcript_count} transcript entries</span>
                    </div>
                  ) : null}
                  
                  {meeting.summary_exists && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      <span>Summary available</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Created {format(new Date(meeting.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};