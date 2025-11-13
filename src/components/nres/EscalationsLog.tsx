import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EscalationEvent } from "@/types/nresTypes";
import { format } from "date-fns";
import { InfoTooltip } from "./InfoTooltip";
import { AlertCircle, Clock, CheckCircle, Bell, AlertTriangle } from "lucide-react";

interface EscalationsLogProps {
  events: EscalationEvent[];
}

export const EscalationsLog = ({ events }: EscalationsLogProps) => {
  const getEventIcon = (type: EscalationEvent['type']) => {
    switch (type) {
      case 'escalated-96hr':
        return <AlertCircle className="h-5 w-5 text-[#DA291C]" />;
      case 'reminder-72hr':
        return <AlertTriangle className="h-5 w-5 text-[#ED8B00]" />;
      case 'reminder-48hr':
        return <Bell className="h-5 w-5 text-[#FFB81C]" />;
      case 'reviewed':
        return <CheckCircle className="h-5 w-5 text-[#007F3B]" />;
      default:
        return <Clock className="h-5 w-5 text-[#005EB8]" />;
    }
  };

  const getEventColor = (type: EscalationEvent['type']) => {
    switch (type) {
      case 'escalated-96hr':
        return 'border-l-[#DA291C] bg-[#DA291C]/5';
      case 'reminder-72hr':
        return 'border-l-[#ED8B00] bg-[#ED8B00]/5';
      case 'reminder-48hr':
        return 'border-l-[#FFB81C] bg-[#FFB81C]/5';
      case 'reviewed':
        return 'border-l-[#007F3B] bg-[#007F3B]/5';
      default:
        return 'border-l-[#005EB8] bg-[#005EB8]/5';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#003087]">Safety Net Escalations</h3>
        <InfoTooltip content="Real-time activity feed showing all automated escalations and manual actions. Complete audit trail for CQC compliance and safety governance." />
      </div>

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {events.map(event => (
            <div 
              key={event.id}
              className={`p-3 rounded-lg border-l-4 ${getEventColor(event.type)} transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#003087]">{event.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(event.timestamp, 'HH:mm \'on\' dd/MM/yyyy')}
                    {event.actor && ` • ${event.actor}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Real-time updates • Last refreshed: {format(new Date(), 'HH:mm')}
        </p>
      </div>
    </Card>
  );
};
