import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb } from "lucide-react";
import type { ValueProposition } from "@/types/dtac";

interface Props {
  data: ValueProposition;
  onChange: (data: ValueProposition) => void;
}

export const ValuePropositionSection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof ValueProposition, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Section B: Value Proposition
        </CardTitle>
        <CardDescription>
          Describe the value your technology brings to NHS services and patients.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="b1">B1. Target Users *</Label>
          <Textarea
            id="b1"
            value={data.b1_targetUsers}
            onChange={(e) => handleChange('b1_targetUsers', e.target.value)}
            placeholder="Describe who will use this technology (e.g., GPs, practice nurses, patients)"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="b2">B2. Problem Solved *</Label>
          <Textarea
            id="b2"
            value={data.b2_problemSolved}
            onChange={(e) => handleChange('b2_problemSolved', e.target.value)}
            placeholder="What specific problem or challenge does this technology address in NHS care delivery?"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="b3">B3. Benefits *</Label>
          <Textarea
            id="b3"
            value={data.b3_benefits}
            onChange={(e) => handleChange('b3_benefits', e.target.value)}
            placeholder="Describe the key benefits (clinical outcomes, efficiency gains, cost savings, patient experience improvements)"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="b4">B4. Evidence Base *</Label>
          <Textarea
            id="b4"
            value={data.b4_evidenceBase}
            onChange={(e) => handleChange('b4_evidenceBase', e.target.value)}
            placeholder="Provide evidence supporting your claims (research, pilot results, customer testimonials, case studies)"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};
