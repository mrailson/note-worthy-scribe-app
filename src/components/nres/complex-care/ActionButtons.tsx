import { Button } from "@/components/ui/button";
import { Calendar, FileText, UserX } from "lucide-react";
import { ComplexCarePatient } from "@/types/complexCareTypes";

interface ActionButtonsProps {
  patient: ComplexCarePatient;
  onBookReview: (patient: ComplexCarePatient) => void;
  onViewRecord: (patient: ComplexCarePatient) => void;
  onExemptPatient: (patient: ComplexCarePatient) => void;
}

export const ActionButtons = ({ 
  patient, 
  onBookReview, 
  onViewRecord, 
  onExemptPatient 
}: ActionButtonsProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onBookReview(patient);
        }}
        className="bg-[#005EB8] hover:bg-[#003D7A] text-white"
      >
        <Calendar className="h-3 w-3 mr-1" />
        Book Review
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onViewRecord(patient);
        }}
        className="border-[#005EB8] text-[#005EB8] hover:bg-[#005EB8]/10"
      >
        <FileText className="h-3 w-3 mr-1" />
        View Record
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onExemptPatient(patient);
        }}
        className="border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107]/10"
      >
        <UserX className="h-3 w-3 mr-1" />
        Exempt
      </Button>
    </div>
  );
};
