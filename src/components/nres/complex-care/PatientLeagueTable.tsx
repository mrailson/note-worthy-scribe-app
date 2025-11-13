import { useState } from "react";
import { ComplexCarePatient } from "@/types/complexCareTypes";
import { PatientRow } from "./PatientRow";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "../InfoTooltip";

interface PatientLeagueTableProps {
  patients: ComplexCarePatient[];
  onBookReview: (patient: ComplexCarePatient) => void;
  onViewRecord: (patient: ComplexCarePatient) => void;
  onExemptPatient: (patient: ComplexCarePatient) => void;
}

export const PatientLeagueTable = ({
  patients,
  onBookReview,
  onViewRecord,
  onExemptPatient,
}: PatientLeagueTableProps) => {
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const handleToggleExpand = (patientId: string) => {
    setExpandedPatientId(expandedPatientId === patientId ? null : patientId);
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-muted text-foreground p-4 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Top 25 Priority Patients
          <InfoTooltip 
            content="AI-ranked league table showing highest-risk patients requiring proactive intervention. Click any row to expand full patient details. Rankings update in real-time based on clinical metrics, engagement status, and risk algorithms." 
          />
        </h2>
        <span className="text-sm">
          Showing {patients.length} patients
        </span>
      </div>

      {/* Table Header */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-4 p-4 bg-muted text-foreground font-semibold text-sm border-b border-border">
        <div className="lg:col-span-1">Rank</div>
        <div className="lg:col-span-2">Patient</div>
        <div className="lg:col-span-1">Risk</div>
        <div className="lg:col-span-2">Conditions</div>
        <div className="lg:col-span-2">Key Metrics</div>
        <div className="lg:col-span-2">Engagement</div>
        <div className="lg:col-span-2">Actions</div>
      </div>

      {/* Patient Rows */}
      <div className="max-h-[800px] overflow-y-auto">
        {patients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No patients match the selected filter criteria.</p>
          </div>
        ) : (
          patients.map((patient) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              expanded={expandedPatientId === patient.id}
              onToggleExpand={() => handleToggleExpand(patient.id)}
              onBookReview={onBookReview}
              onViewRecord={onViewRecord}
              onExemptPatient={onExemptPatient}
            />
          ))
        )}
      </div>
    </Card>
  );
};
