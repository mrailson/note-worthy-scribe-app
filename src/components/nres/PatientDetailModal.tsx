import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HubConsultation } from "@/types/nresTypes";
import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import { Phone, CheckCircle, AlertTriangle, Clock, User, Building2, Stethoscope, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PatientDetailModalProps {
  consultation: HubConsultation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PatientDetailModal = ({ consultation, open, onOpenChange }: PatientDetailModalProps) => {
  if (!consultation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#003087]">
            Hub Consultation Details
          </DialogTitle>
          <DialogDescription>
            Complete context for results review and safety netting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Information */}
          <Card className="p-4 bg-[#F0F4F5]">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#005EB8]" />
                  <h3 className="font-semibold text-[#003087]">Patient Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient Initials</p>
                    <p className="font-semibold text-lg">{consultation.patientInitials}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-semibold">{consultation.patientDOB}</p>
                  </div>
                </div>
              </div>
              <StatusBadge status={consultation.status} hoursElapsed={consultation.hoursElapsed} />
            </div>
          </Card>

          {/* Hub Consultation Details */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-[#005EB8]" />
              <h3 className="font-semibold text-[#003087]">Hub Consultation Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Home Practice</p>
                <p className="font-medium">{consultation.homePractice}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hub Practice</p>
                <p className="font-medium">{consultation.hubPractice}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hub Clinician</p>
                <p className="font-medium">{consultation.clinician}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Consultation Date</p>
                <p className="font-medium">{format(consultation.receivedAt, 'HH:mm \'on\' dd/MM/yyyy')}</p>
              </div>
            </div>
          </Card>

          {/* Tests Ordered */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-[#005EB8]" />
              <h3 className="font-semibold text-[#003087]">Tests Ordered</h3>
            </div>
            <p className="font-medium text-lg">{consultation.testType}</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Results received: {format(consultation.receivedAt, 'HH:mm \'on\' dd/MM/yyyy')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-[#ED8B00]" />
              <span className="font-semibold text-[#ED8B00]">
                Time elapsed: {consultation.hoursElapsed} hours
              </span>
            </div>
          </Card>

          {/* Safety Netting */}
          {consultation.safetyNetting && (
            <Card className="p-4 border-[#FFB81C] bg-[#FFB81C]/5">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-[#ED8B00] mt-0.5" />
                <h3 className="font-semibold text-[#003087]">Safety Netting Instructions</h3>
              </div>
              <p className="text-sm leading-relaxed">{consultation.safetyNetting}</p>
            </Card>
          )}

          {/* Assignment & Responsibility */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-[#005EB8]" />
              <h3 className="font-semibold text-[#003087]">Assignment & Responsibility</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assigned GP</span>
                <span className="font-semibold">{consultation.assignedGP}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auto-assigned</span>
                <span className="font-medium">{format(consultation.receivedAt, 'HH:mm \'on\' dd/MM/yyyy')}</span>
              </div>
            </div>
          </Card>

          {/* Escalation History */}
          <Card className="p-4">
            <h3 className="font-semibold text-[#003087] mb-4">Escalation Timeline</h3>
            <div className="space-y-3">
              {consultation.escalationHistory.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {event.type === 'escalated-96hr' && <AlertTriangle className="h-5 w-5 text-[#DA291C]" />}
                      {event.type === 'reminder-72hr' && <AlertTriangle className="h-5 w-5 text-[#ED8B00]" />}
                      {event.type === 'reminder-48hr' && <Clock className="h-5 w-5 text-[#FFB81C]" />}
                      {event.type === 'auto-assigned' && <Clock className="h-5 w-5 text-[#005EB8]" />}
                      {event.type === 'reviewed' && <CheckCircle className="h-5 w-5 text-[#007F3B]" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(event.timestamp, 'HH:mm \'on\' dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  {index < consultation.escalationHistory.length - 1 && (
                    <Separator className="my-3" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button className="flex-1 bg-[#005EB8] hover:bg-[#003087]">
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Reviewed
            </Button>
            <Button variant="outline" className="flex-1">
              <Phone className="h-4 w-4 mr-2" />
              Contact {consultation.assignedGP}
            </Button>
            <Button variant="outline" className="flex-1">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Escalate Further
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
