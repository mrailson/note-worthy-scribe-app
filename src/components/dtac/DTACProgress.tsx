import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { DTACAssessment } from "@/types/dtac";

interface Props {
  assessment: DTACAssessment;
}

export const DTACProgress: React.FC<Props> = ({ assessment }) => {
  // Calculate completion percentage for each section
  const calculateSectionCompletion = (section: any, requiredFields: string[]): number => {
    if (!section) return 0;
    const completed = requiredFields.filter(field => {
      const value = section[field];
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return false;
    }).length;
    return Math.round((completed / requiredFields.length) * 100);
  };

  const sectionA = calculateSectionCompletion(assessment.companyInfo, [
    'a1_companyName', 'a2_productName', 'a3_productType', 'a4_contactName',
    'a5_contactEmail', 'a6_contactPhone', 'a7_companyRegistrationNumber', 
    'a8_registeredAddress', 'a10_yearsTrading'
  ]);

  const sectionB = calculateSectionCompletion(assessment.valueProposition, [
    'b1_targetUsers', 'b2_problemSolved', 'b3_benefits', 'b4_evidenceBase'
  ]);

  const sectionC1 = calculateSectionCompletion(assessment.clinicalSafety, [
    'c1_1_csoName', 'c1_2_dcb0129Compliant', 'c1_4_hazardLog'
  ]);

  const sectionC2 = calculateSectionCompletion(assessment.dataProtection, [
    'c2_1_icoRegistered', 'c2_2_dpoName', 'c2_3_dsptStatus', 'c2_3_2_dpiaCompleted',
    'c2_4_dataMinimisation', 'c2_5_dataLocation'
  ]);

  const sectionC3 = calculateSectionCompletion(assessment.technicalSecurity, [
    'c3_1_cyberEssentials', 'c3_2_penetrationTesting', 'c3_3_vulnerabilityManagement',
    'c3_4_incidentResponse'
  ]);

  const sectionC4 = calculateSectionCompletion(assessment.interoperability, [
    'c4_1_standardsCompliance', 'c4_2_apiAvailable', 'c4_3_integrationSupport'
  ]);

  const sectionD = calculateSectionCompletion(assessment.usabilityAccessibility, [
    'd1_1_userTesting', 'd1_2_accessibilityStandard', 'd1_3_accessibilityTesting',
    'd1_4_userSupport', 'd1_5_trainingProvided'
  ]);

  const overallProgress = Math.round((sectionA + sectionB + sectionC1 + sectionC2 + sectionC3 + sectionC4 + sectionD) / 7);

  const getStatusIcon = (percentage: number) => {
    if (percentage === 100) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (percentage > 0) return <AlertCircle className="h-4 w-4 text-warning" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage === 100) return <Badge variant="default" className="bg-success">Complete</Badge>;
    if (percentage > 0) return <Badge variant="secondary">In Progress</Badge>;
    return <Badge variant="outline">Not Started</Badge>;
  };

  const sections = [
    { name: "Section A: Company Info", progress: sectionA },
    { name: "Section B: Value Proposition", progress: sectionB },
    { name: "Section C1: Clinical Safety", progress: sectionC1 },
    { name: "Section C2: Data Protection", progress: sectionC2 },
    { name: "Section C3: Technical Security", progress: sectionC3 },
    { name: "Section C4: Interoperability", progress: sectionC4 },
    { name: "Section D: Usability", progress: sectionD },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Assessment Progress</span>
          <Badge variant="outline" className="text-lg">
            {overallProgress}% Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.name} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
              <div className="flex items-center gap-2 flex-1">
                {getStatusIcon(section.progress)}
                <span className="text-sm">{section.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{section.progress}%</span>
                {getStatusBadge(section.progress)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
