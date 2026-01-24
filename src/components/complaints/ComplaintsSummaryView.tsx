import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Eye,
  Building,
  ChevronRight
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Complaint {
  id: string;
  reference_number: string;
  patient_name: string;
  complaint_title: string;
  complaint_description: string;
  incident_date: string;
  category: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  response_due_date: string | null;
  closed_at: string | null;
  created_at: string;
  practice_id: string | null;
  gp_practices?: {
    name: string;
  };
  complaint_outcomes?: Array<{
    outcome_letter: string;
    outcome_type: string;
    sent_at?: string | null;
  }>;
  // Allow additional properties
  [key: string]: any;
}

interface ComplaintsSummaryViewProps {
  complaints: Complaint[];
  onViewDetails: (complaint: Complaint) => void;
  calculateDaysUntilDeadline: (startDate: string) => number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: <FileText className="h-3 w-3" /> },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: <Clock className="h-3 w-3" /> },
  investigation: { label: 'Investigation', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: <AlertCircle className="h-3 w-3" /> },
  awaiting_response: { label: 'Awaiting Response', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: <Clock className="h-3 w-3" /> },
  closed: { label: 'Closed', color: 'bg-green-100 text-green-800 border-green-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300', icon: <XCircle className="h-3 w-3" /> },
};

const OUTCOME_LABELS: Record<string, string> = {
  upheld: 'Upheld',
  partially_upheld: 'Partially Upheld',
  not_upheld: 'Not Upheld',
  withdrawn: 'Withdrawn',
};

const CATEGORY_SHORT: Record<string, string> = {
  'Clinical Care & Treatment': 'Clinical Care',
  'Staff Attitude & Behaviour': 'Staff Attitude',
  'Appointments & Access': 'Appointments',
  'Prescriptions': 'Prescriptions',
  'Communication': 'Communication',
  'Facilities & Environment': 'Facilities',
  'Other': 'Other',
};

export const ComplaintsSummaryView: React.FC<ComplaintsSummaryViewProps> = ({
  complaints,
  onViewDetails,
  calculateDaysUntilDeadline
}) => {
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground', icon: null };
  };

  const getOutcomeLabel = (type: string) => {
    return OUTCOME_LABELS[type] || type;
  };

  const getCategoryShort = (category: string) => {
    return CATEGORY_SHORT[category] || category;
  };

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 pr-4">
        {complaints.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No complaints found</p>
          </div>
        ) : (
          complaints.map((complaint) => {
            const statusConfig = getStatusConfig(complaint.status);
            const startDate = complaint.submitted_at ?? complaint.created_at;
            const daysRemaining = startDate ? calculateDaysUntilDeadline(startDate) : null;
            const isClosed = complaint.status === 'closed';
            const isOverdue = daysRemaining !== null && daysRemaining < 0 && !isClosed;
            const outcome = complaint.complaint_outcomes?.[0];
            
            // Calculate days early/late for closed complaints
            let closedEarlyLate = '';
            if (isClosed && complaint.closed_at && startDate) {
              const deadline = new Date(startDate);
              deadline.setDate(deadline.getDate() + 25);
              const closedDate = new Date(complaint.closed_at);
              const daysDiff = differenceInDays(deadline, closedDate);
              if (daysDiff > 0) {
                closedEarlyLate = `${daysDiff} days early`;
              } else if (daysDiff < 0) {
                closedEarlyLate = `${Math.abs(daysDiff)} days late`;
              } else {
                closedEarlyLate = 'On time';
              }
            }

            return (
              <div
                key={complaint.id}
                className={cn(
                  "rounded-lg border p-4 transition-all hover:shadow-md",
                  isOverdue && "border-red-300 bg-red-50/50 dark:bg-red-950/10",
                  isClosed && "border-green-200 bg-green-50/30 dark:bg-green-950/10",
                  !isOverdue && !isClosed && "bg-card hover:bg-accent/30"
                )}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {complaint.reference_number}
                      </span>
                      <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                      {outcome && (
                        <Badge variant="secondary" className="text-xs">
                          {getOutcomeLabel(outcome.outcome_type)}
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          OVERDUE
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-base truncate">
                      {complaint.complaint_title}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onViewDetails(complaint)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-sm">
                  {/* Category */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Category</p>
                    <p className="font-medium">{getCategoryShort(complaint.category)}</p>
                  </div>

                  {/* Patient */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <User className="h-3 w-3" /> Patient
                    </p>
                    <p className="font-medium truncate">{complaint.patient_name}</p>
                  </div>

                  {/* Practice */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Building className="h-3 w-3" /> Practice
                    </p>
                    <p className="font-medium truncate">
                      {complaint.gp_practices?.name || 'Not assigned'}
                    </p>
                  </div>

                  {/* Received Date */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Received
                    </p>
                    <p className="font-medium">
                      {startDate ? format(new Date(startDate), 'dd MMM yyyy') : '-'}
                    </p>
                  </div>

                  {/* Deadline / Closed */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {isClosed ? 'Closed' : 'Deadline'}
                    </p>
                    {isClosed ? (
                      <div>
                        <p className="font-medium">
                          {complaint.closed_at ? format(new Date(complaint.closed_at), 'dd MMM yyyy') : '-'}
                        </p>
                        {closedEarlyLate && (
                          <p className={cn(
                            "text-xs",
                            closedEarlyLate.includes('early') && "text-green-600",
                            closedEarlyLate.includes('late') && "text-red-600"
                          )}>
                            {closedEarlyLate}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className={cn(
                          "font-medium",
                          isOverdue && "text-red-600"
                        )}>
                          {daysRemaining !== null ? `${Math.abs(daysRemaining)} days ${daysRemaining >= 0 ? 'left' : 'overdue'}` : '-'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Preview */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {complaint.complaint_description}
                  </p>
                </div>

                {/* Outcome/Findings if available */}
                {outcome && (
                  <div className="mt-2 pt-2 border-t border-dashed">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground font-medium">Outcome</p>
                      {outcome.sent_at && (
                        <p className="text-xs text-muted-foreground">
                          Sent to patient: {format(new Date(outcome.sent_at), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">
                      {outcome.outcome_letter?.substring(0, 200) || 'No outcome details recorded'}
                      {outcome.outcome_letter && outcome.outcome_letter.length > 200 && '...'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
};
