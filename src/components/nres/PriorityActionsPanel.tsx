import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Eye, Phone } from "lucide-react";
import { useState } from "react";
import { HubConsultation } from "@/types/nresTypes";
import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import { InfoTooltip } from "./InfoTooltip";

interface PriorityActionsPanelProps {
  consultations: HubConsultation[];
  onViewDetails: (consultation: HubConsultation) => void;
}

export const PriorityActionsPanel = ({ consultations, onViewDetails }: PriorityActionsPanelProps) => {
  const [criticalOpen, setCriticalOpen] = useState(true);
  const [urgentOpen, setUrgentOpen] = useState(true);
  const [dueSoonOpen, setDueSoonOpen] = useState(false);

  const critical = consultations.filter(c => c.status === 'critical');
  const urgent = consultations.filter(c => c.status === 'overdue');
  const dueSoon = consultations.filter(c => c.status === 'pending' && c.hoursElapsed >= 24);

  const renderConsultationCard = (consultation: HubConsultation) => (
    <Card key={consultation.id} className="p-4 mb-3 hover:shadow-md transition-shadow border-l-4 border-l-[#DA291C]">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-[#003087]">{consultation.patientInitials}</p>
            <p className="text-sm text-muted-foreground">DOB: {consultation.patientDOB}</p>
          </div>
          <StatusBadge status={consultation.status} hoursElapsed={consultation.hoursElapsed} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Home:</p>
            <p className="font-medium">{consultation.homePractice}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hub:</p>
            <p className="font-medium">{consultation.hubPractice}</p>
          </div>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground">Test: <span className="font-medium text-foreground">{consultation.testType}</span></p>
          <p className="text-muted-foreground">Clinician: <span className="font-medium text-foreground">{consultation.clinician}</span></p>
          <p className="text-muted-foreground">Assigned: <span className="font-medium text-foreground">{consultation.assignedGP}</span></p>
          <p className="text-muted-foreground">Received: <span className="font-medium text-foreground">{format(consultation.receivedAt, 'HH:mm \'on\' dd/MM/yyyy')}</span></p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            className="flex-1 bg-[#005EB8] hover:bg-[#003087]"
            onClick={() => onViewDetails(consultation)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View Results
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <Phone className="h-4 w-4 mr-1" />
            Contact
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#003087]">Priority Actions</h2>
        <InfoTooltip content="Results requiring urgent attention, automatically prioritized by time elapsed. System sends automated reminders at 48hrs and 72hrs, with escalation to Practice Manager at 96hrs." />
      </div>

      {/* Critical - >72 hours */}
      <Collapsible open={criticalOpen} onOpenChange={setCriticalOpen}>
        <Card className={`${critical.length > 0 ? 'border-[#DA291C] bg-[#DA291C]/5' : ''}`}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#DA291C] animate-pulse" />
              <h3 className="font-semibold text-[#DA291C]">CRITICAL (&gt;72 hours)</h3>
              <span className="text-sm text-muted-foreground">({critical.length})</span>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${criticalOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0">
            {critical.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No critical results</p>
            ) : (
              critical.map(renderConsultationCard)
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Urgent - 48-72 hours */}
      <Collapsible open={urgentOpen} onOpenChange={setUrgentOpen}>
        <Card className={`${urgent.length > 0 ? 'border-[#ED8B00] bg-[#ED8B00]/5' : ''}`}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ED8B00]" />
              <h3 className="font-semibold text-[#ED8B00]">URGENT (48-72 hours)</h3>
              <span className="text-sm text-muted-foreground">({urgent.length})</span>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${urgentOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0">
            {urgent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No urgent results</p>
            ) : (
              urgent.map(renderConsultationCard)
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Due Soon - <48 hours */}
      <Collapsible open={dueSoonOpen} onOpenChange={setDueSoonOpen}>
        <Card className={`${dueSoon.length > 0 ? 'border-[#FFB81C] bg-[#FFB81C]/5' : ''}`}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FFB81C]" />
              <h3 className="font-semibold text-[#FFB81C]">DUE SOON (&lt;48 hours)</h3>
              <span className="text-sm text-muted-foreground">({dueSoon.length})</span>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${dueSoonOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0">
            {dueSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results due soon</p>
            ) : (
              dueSoon.map(renderConsultationCard)
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
