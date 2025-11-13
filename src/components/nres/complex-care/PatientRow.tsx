import { ComplexCarePatient } from "@/types/complexCareTypes";
import { RiskScoreBadge } from "./RiskScoreBadge";
import { ConditionTag } from "./ConditionTag";
import { ClinicalMetric } from "./ClinicalMetric";
import { EngagementStatus } from "./EngagementStatus";
import { ActionButtons } from "./ActionButtons";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientDetailPanel } from "./PatientDetailPanel";

interface PatientRowProps {
  patient: ComplexCarePatient;
  expanded: boolean;
  onToggleExpand: () => void;
  onBookReview: (patient: ComplexCarePatient) => void;
  onViewRecord: (patient: ComplexCarePatient) => void;
  onExemptPatient: (patient: ComplexCarePatient) => void;
}

export const PatientRow = ({
  patient,
  expanded,
  onToggleExpand,
  onBookReview,
  onViewRecord,
  onExemptPatient,
}: PatientRowProps) => {
  return (
    <div className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 cursor-pointer",
          expanded && "bg-blue-50"
        )}
        onClick={onToggleExpand}
      >
        {/* Rank - Col 1 */}
        <div className="lg:col-span-1 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 hover:bg-blue-100 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-[#005EB8]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#005EB8]" />
            )}
          </button>
          <span className="text-2xl font-bold text-[#003087]">{patient.rank}</span>
        </div>

        {/* Patient Details - Col 2-3 */}
        <div className="lg:col-span-2">
          <p className="font-bold text-[#003087]">{patient.lastName}, {patient.initials}</p>
          <p className="text-sm text-muted-foreground">{patient.age}y, {patient.practice}</p>
          <p className="text-xs text-muted-foreground">{patient.nhsNumber}</p>
          <p className="text-xs text-muted-foreground">{patient.assignedGP}</p>
        </div>

        {/* Risk Score - Col 4 */}
        <div className="lg:col-span-1 flex items-center">
          <RiskScoreBadge score={patient.riskScore} />
        </div>

        {/* Conditions - Col 5-6 */}
        <div className="lg:col-span-2 flex items-center">
          <div className="flex flex-wrap gap-1">
            {patient.conditions.map((condition) => (
              <ConditionTag key={condition.code} condition={condition} />
            ))}
          </div>
        </div>

        {/* Key Metrics - Col 7-8 */}
        <div className="lg:col-span-2 flex items-center">
          <div className="flex flex-wrap gap-1">
            {patient.clinicalMetrics.slice(0, 3).map((metric, index) => (
              <ClinicalMetric key={index} metric={metric} />
            ))}
          </div>
        </div>

        {/* Engagement - Col 9 */}
        <div className="lg:col-span-2 flex items-center">
          <EngagementStatus status={patient.engagementStatus} />
        </div>

        {/* Actions - Col 10-12 */}
        <div className="lg:col-span-2 flex items-center">
          <ActionButtons
            patient={patient}
            onBookReview={onBookReview}
            onViewRecord={onViewRecord}
            onExemptPatient={onExemptPatient}
          />
        </div>
      </div>

      {/* Expanded Details Panel */}
      {expanded && <PatientDetailPanel patient={patient} />}
    </div>
  );
};
