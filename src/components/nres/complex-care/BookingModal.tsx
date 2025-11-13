import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ComplexCarePatient } from "@/types/complexCareTypes";
import { Calendar, Clock } from "lucide-react";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: ComplexCarePatient | null;
  onConfirm: () => void;
}

export const BookingModal = ({
  open,
  onOpenChange,
  patient,
  onConfirm,
}: BookingModalProps) => {
  const getNextAvailableSlots = () => {
    const slots = [];
    const now = new Date();
    
    for (let i = 1; i <= 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      slots.push({
        date: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: '09:00',
      });
    }
    return slots;
  };

  if (!patient) return null;

  const availableSlots = getNextAvailableSlots();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#003087]">
            <Calendar className="h-5 w-5 text-[#005EB8]" />
            Book Complex Care Review
          </DialogTitle>
          <DialogDescription>
            Book a 30-minute complex care appointment for <span className="font-semibold">{patient.lastName}, {patient.initials}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Patient Details</Label>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
              <p className="text-sm"><strong>Name:</strong> {patient.lastName}, {patient.firstName} ({patient.initials})</p>
              <p className="text-sm"><strong>Age:</strong> {patient.age} years</p>
              <p className="text-sm"><strong>NHS Number:</strong> {patient.nhsNumber}</p>
              <p className="text-sm"><strong>Practice:</strong> {patient.practice}</p>
              <p className="text-sm"><strong>Assigned GP:</strong> {patient.assignedGP}</p>
              <p className="text-sm"><strong>Risk Score:</strong> {patient.riskScore}/100</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available Slots</Label>
            <div className="space-y-2">
              {availableSlots.map((slot, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start hover:bg-[#005EB8]/10 hover:border-[#005EB8]"
                  onClick={() => {
                    onConfirm();
                    onOpenChange(false);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {slot.date}
                  <Clock className="h-4 w-4 ml-auto mr-2" />
                  {slot.time}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              <strong>Appointment Type:</strong> 30-minute Complex Care Review
            </p>
            <p className="text-sm text-green-800 mt-1">
              Patient will receive SMS confirmation automatically
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
