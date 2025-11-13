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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComplexCarePatient } from "@/types/complexCareTypes";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ExemptPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: ComplexCarePatient | null;
  onConfirm: (reason: string, notes: string) => void;
}

export const ExemptPatientModal = ({
  open,
  onOpenChange,
  patient,
  onConfirm,
}: ExemptPatientModalProps) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (reason) {
      onConfirm(reason, notes);
      setReason('');
      setNotes('');
      onOpenChange(false);
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#003087]">
            <AlertTriangle className="h-5 w-5 text-[#ffc107]" />
            Exempt Patient from Active Monitoring
          </DialogTitle>
          <DialogDescription>
            Exempt <span className="font-semibold">{patient.lastName}, {patient.initials}</span> (NHS: {patient.nhsNumber}) from the active proactive care list?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Exemption Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple-dnas">Multiple DNAs</SelectItem>
                <SelectItem value="declined-care">Declined Care</SelectItem>
                <SelectItem value="moved-away">Moved Away</SelectItem>
                <SelectItem value="deceased">Deceased</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter any additional context or details about the exemption..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Exempting this patient will:
            </p>
            <ul className="text-sm text-amber-800 list-disc list-inside mt-2 space-y-1">
              <li>Remove them from the active priority league table</li>
              <li>Move them to the "Non-Engaged" list</li>
              <li>Promote the next patient (rank 26) to position 25</li>
              <li>Create an audit log entry with your details</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason}
            className="bg-[#ffc107] hover:bg-[#e0a800] text-black"
          >
            Confirm Exemption
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
