import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Plus, Edit } from "lucide-react";
import { CommsPlan, CommsEvent } from "@/types/commsStrategyTypes";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";

interface CommsPlansTableProps {
  plans: CommsPlan[];
  events: CommsEvent[];
  onViewDetails: (plan: CommsPlan) => void;
  onAddEvent: (plan: CommsPlan) => void;
  onUpdateStatus: (plan: CommsPlan) => void;
}

export const CommsPlansTable = ({
  plans,
  events,
  onViewDetails,
  onAddEvent,
  onUpdateStatus,
}: CommsPlansTableProps) => {
  const getLatestEvent = (planId: string): CommsEvent | undefined => {
    const planEvents = events.filter(e => e.planId === planId);
    return planEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())[0];
  };

  const formatDate = (date: Date) => {
    return format(date, 'dd/MM/yyyy', { locale: enGB });
  };

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white border-b-2 border-[#005EB8]">
              <TableHead className="text-[#003087] font-semibold">Plan Name</TableHead>
              <TableHead className="text-[#003087] font-semibold">Target Audience</TableHead>
              <TableHead className="text-[#003087] font-semibold">Channels</TableHead>
              <TableHead className="text-[#003087] font-semibold">Practice</TableHead>
              <TableHead className="text-[#003087] font-semibold">Target Date</TableHead>
              <TableHead className="text-[#003087] font-semibold">Status</TableHead>
              <TableHead className="text-[#003087] font-semibold">Latest Event</TableHead>
              <TableHead className="text-[#003087] font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan, index) => {
              const latestEvent = getLatestEvent(plan.id);
              return (
                <TableRow 
                  key={plan.id}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-[#f8fafb]'}
                >
                  <TableCell className="font-medium">{plan.planName}</TableCell>
                  <TableCell>{plan.targetAudience}</TableCell>
                  <TableCell>
...
                  </TableCell>
                  <TableCell className="text-sm">{plan.practice}</TableCell>
                  <TableCell className="text-sm">{formatDate(plan.targetCompletionDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={plan.currentStatus} />
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {latestEvent ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{latestEvent.eventType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(latestEvent.eventDate, 'HH:mm \'on\' dd/MM/yyyy', { locale: enGB })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No events</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => onViewDetails(plan)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        onClick={() => onAddEvent(plan)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Event
                      </Button>
                      <Button
                        onClick={() => onUpdateStatus(plan)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Status
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
