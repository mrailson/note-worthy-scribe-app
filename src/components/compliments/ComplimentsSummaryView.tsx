import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  User, 
  Heart, 
  Eye,
  Building,
  ChevronRight,
  Users,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface Compliment {
  id: string;
  reference_number: string;
  patient_name: string;
  patient_contact_email: string | null;
  patient_contact_phone: string | null;
  compliment_date: string;
  compliment_title: string;
  compliment_description: string;
  category: string;
  staff_mentioned: string[] | null;
  location_service: string | null;
  source: string;
  status: string;
  shared_with_staff: boolean;
  shared_at: string | null;
  notes: string | null;
  created_by: string;
  practice_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: 'Received', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  shared: { label: 'Shared with Staff', color: 'bg-green-100 text-green-800 border-green-300' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-800 border-gray-300' },
};

const SOURCE_LABELS: Record<string, string> = {
  patient: 'Patient',
  nhs_choices: 'NHS Choices Review',
  letter: 'Letter',
  verbal: 'Verbal',
  card: 'Card',
  email: 'Email',
  other: 'Other',
};

interface ComplimentsSummaryViewProps {
  compliments: Compliment[];
}

export const ComplimentsSummaryView: React.FC<ComplimentsSummaryViewProps> = ({
  compliments,
}) => {
  const navigate = useNavigate();

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  };

  const getSourceLabel = (source: string) => {
    return SOURCE_LABELS[source] || source;
  };

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 pr-4">
        {compliments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No compliments found</p>
            <p className="text-sm mt-1">Compliments will appear here once they are logged.</p>
          </div>
        ) : (
          compliments.map((compliment) => {
            const statusConfig = getStatusConfig(compliment.status);

            return (
              <div
                key={compliment.id}
                className="rounded-lg border p-4 transition-all hover:shadow-md bg-card hover:bg-accent/30 border-teal-200 dark:border-teal-800"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-semibold text-teal-700 dark:text-teal-400">
                        {compliment.reference_number}
                      </span>
                      <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                        <span>{statusConfig.label}</span>
                      </Badge>
                      {compliment.shared_with_staff && (
                        <Badge variant="secondary" className="text-xs">
                          <Share2 className="h-3 w-3 mr-1" />
                          Shared
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-base truncate">
                      {compliment.compliment_title}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => navigate(`/compliments/${compliment.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-sm">
                  {/* Category */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Category</p>
                    <p className="font-medium">{compliment.category}</p>
                  </div>

                  {/* Source */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <User className="h-3 w-3" /> From
                    </p>
                    <p className="font-medium truncate">{compliment.patient_name}</p>
                  </div>

                  {/* Source Type */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Source</p>
                    <p className="font-medium">{getSourceLabel(compliment.source)}</p>
                  </div>

                  {/* Date Received */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Received
                    </p>
                    <p className="font-medium">
                      {format(new Date(compliment.compliment_date), 'dd MMM yyyy')}
                    </p>
                  </div>

                  {/* Staff Mentioned */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Users className="h-3 w-3" /> Staff
                    </p>
                    <p className="font-medium truncate">
                      {compliment.staff_mentioned?.join(', ') || 'Not specified'}
                    </p>
                  </div>
                </div>

                {/* Description Preview */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {compliment.compliment_description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
};
