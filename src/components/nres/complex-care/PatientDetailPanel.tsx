import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplexCarePatient } from "@/types/complexCareTypes";
import { RiskScoreBadge } from "./RiskScoreBadge";
import { ConditionTag } from "./ConditionTag";
import { ClinicalMetric } from "./ClinicalMetric";
import { EngagementStatus } from "./EngagementStatus";
import { User, Calendar, Activity, FileText } from "lucide-react";

interface PatientDetailPanelProps {
  patient: ComplexCarePatient;
}

export const PatientDetailPanel = ({ patient }: PatientDetailPanelProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border-t border-blue-200">
      {/* Demographics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-[#005EB8]" />
            Patient Demographics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground">Full Name</p>
              <p className="font-semibold">{patient.lastName}, {patient.firstName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date of Birth</p>
              <p className="font-semibold">{patient.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Age</p>
              <p className="font-semibold">{patient.age} years</p>
            </div>
            <div>
              <p className="text-muted-foreground">NHS Number</p>
              <p className="font-semibold">{patient.nhsNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Practice</p>
              <p className="font-semibold">{patient.practice}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Assigned GP</p>
              <p className="font-semibold">{patient.assignedGP}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#005EB8]" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Current Risk Score</p>
            <RiskScoreBadge score={patient.riskScore} size="large" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Chronic Conditions</p>
            <div className="flex flex-wrap gap-2">
              {patient.conditions.map((condition) => (
                <ConditionTag key={condition.code} condition={condition} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#005EB8]" />
            All Clinical Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {patient.clinicalMetrics.map((metric, index) => (
              <ClinicalMetric key={index} metric={metric} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#005EB8]" />
            Engagement Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EngagementStatus status={patient.engagementStatus} />
          {patient.lastReview && (
            <div>
              <p className="text-xs text-muted-foreground">Last Review</p>
              <p className="text-sm font-semibold">{patient.lastReview.toLocaleDateString('en-GB')}</p>
            </div>
          )}
          {patient.nextAppointment && (
            <div>
              <p className="text-xs text-muted-foreground">Next Appointment</p>
              <p className="text-sm font-semibold">{patient.nextAppointment.toLocaleDateString('en-GB')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
