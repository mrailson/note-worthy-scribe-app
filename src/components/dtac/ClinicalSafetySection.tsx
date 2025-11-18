import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Stethoscope } from "lucide-react";
import type { ClinicalSafety } from "@/types/dtac";

interface Props {
  data: ClinicalSafety;
  onChange: (data: ClinicalSafety) => void;
}

export const ClinicalSafetySection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof ClinicalSafety, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Section C1: Clinical Safety
        </CardTitle>
        <CardDescription>
          Demonstrate clinical safety management in accordance with NHS standards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">C1.1 Clinical Safety Officer Details *</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c1_1_name">CSO Name</Label>
              <Input
                id="c1_1_name"
                value={data.c1_1_csoName}
                onChange={(e) => handleChange('c1_1_csoName', e.target.value)}
                placeholder="Enter CSO name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c1_1_qual">CSO Qualifications</Label>
              <Input
                id="c1_1_qual"
                value={data.c1_1_csoQualifications}
                onChange={(e) => handleChange('c1_1_csoQualifications', e.target.value)}
                placeholder="e.g., DCB0160 Trained"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="c1_1_contact">CSO Contact Details</Label>
              <Input
                id="c1_1_contact"
                value={data.c1_1_csoContact}
                onChange={(e) => handleChange('c1_1_csoContact', e.target.value)}
                placeholder="Email and phone"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C1.2 DCB0129 Compliance *</h3>
          <RadioGroup
            value={data.c1_2_dcb0129Compliant ? "yes" : "no"}
            onValueChange={(value) => handleChange('c1_2_dcb0129Compliant', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="dcb-yes" />
              <Label htmlFor="dcb-yes">Yes - Compliant with DCB0129</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="dcb-no" />
              <Label htmlFor="dcb-no">No - Not compliant</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="c1_2_evidence">Evidence/Explanation</Label>
            <Textarea
              id="c1_2_evidence"
              value={data.c1_2_dcb0129Evidence}
              onChange={(e) => handleChange('c1_2_dcb0129Evidence', e.target.value)}
              placeholder="Provide evidence of DCB0129 compliance or explain non-compliance"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C1.3 MHRA Registration</h3>
          <RadioGroup
            value={data.c1_3_mhraRegistered ? "yes" : "no"}
            onValueChange={(value) => handleChange('c1_3_mhraRegistered', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="mhra-yes" />
              <Label htmlFor="mhra-yes">Yes - Registered as medical device</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="mhra-no" />
              <Label htmlFor="mhra-no">No - Not a medical device</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="c1_3_details">MHRA Details</Label>
            <Textarea
              id="c1_3_details"
              value={data.c1_3_mhraDetails}
              onChange={(e) => handleChange('c1_3_mhraDetails', e.target.value)}
              placeholder="Provide MHRA registration number or explain why not applicable"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C1.4 Hazard Log *</h3>
          <RadioGroup
            value={data.c1_4_hazardLog ? "yes" : "no"}
            onValueChange={(value) => handleChange('c1_4_hazardLog', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="hazard-yes" />
              <Label htmlFor="hazard-yes">Yes - Hazard log maintained</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="hazard-no" />
              <Label htmlFor="hazard-no">No - No hazard log</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="c1_4_summary">Hazard Log Summary</Label>
            <Textarea
              id="c1_4_summary"
              value={data.c1_4_hazardLogSummary}
              onChange={(e) => handleChange('c1_4_hazardLogSummary', e.target.value)}
              placeholder="Summarise key hazards identified and mitigations in place"
              rows={4}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
