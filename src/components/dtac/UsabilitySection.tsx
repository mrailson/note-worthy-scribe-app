import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users } from "lucide-react";
import type { UsabilityAccessibility } from "@/types/dtac";

interface Props {
  data: UsabilityAccessibility;
  onChange: (data: UsabilityAccessibility) => void;
}

export const UsabilitySection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof UsabilityAccessibility, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Section D: Usability & Accessibility
        </CardTitle>
        <CardDescription>
          Demonstrate user-centred design and accessibility compliance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">D1.1 User Testing *</h3>
          <RadioGroup
            value={data.d1_1_userTesting ? "yes" : "no"}
            onValueChange={(value) => handleChange('d1_1_userTesting', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="test-yes" />
              <Label htmlFor="test-yes">Yes - User testing conducted</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="test-no" />
              <Label htmlFor="test-no">No - No user testing</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="d1_1_details">User Testing Details</Label>
            <Textarea
              id="d1_1_details"
              value={data.d1_1_userTestingDetails}
              onChange={(e) => handleChange('d1_1_userTestingDetails', e.target.value)}
              placeholder="Describe user testing methodology, participants, and key findings"
              rows={4}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">D1.2 Accessibility Standards *</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="d1_2_standard">Accessibility Standard</Label>
              <Input
                id="d1_2_standard"
                value={data.d1_2_accessibilityStandard}
                onChange={(e) => handleChange('d1_2_accessibilityStandard', e.target.value)}
                placeholder="e.g., WCAG 2.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="d1_2_level">WCAG Level</Label>
              <Input
                id="d1_2_level"
                value={data.d1_2_wcagLevel}
                onChange={(e) => handleChange('d1_2_wcagLevel', e.target.value)}
                placeholder="e.g., AA, AAA"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">D1.3 Accessibility Testing *</h3>
          <Textarea
            id="d1_3"
            value={data.d1_3_accessibilityTesting}
            onChange={(e) => handleChange('d1_3_accessibilityTesting', e.target.value)}
            placeholder="Describe accessibility testing conducted and results"
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">D1.4 User Support *</h3>
          <Textarea
            id="d1_4"
            value={data.d1_4_userSupport}
            onChange={(e) => handleChange('d1_4_userSupport', e.target.value)}
            placeholder="Describe user support mechanisms (helpdesk, documentation, in-app help, etc.)"
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">D1.5 Training *</h3>
          <RadioGroup
            value={data.d1_5_trainingProvided ? "yes" : "no"}
            onValueChange={(value) => handleChange('d1_5_trainingProvided', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="train-yes" />
              <Label htmlFor="train-yes">Yes - Training provided</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="train-no" />
              <Label htmlFor="train-no">No - No training provided</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="d1_5_details">Training Details</Label>
            <Textarea
              id="d1_5_details"
              value={data.d1_5_trainingDetails}
              onChange={(e) => handleChange('d1_5_trainingDetails', e.target.value)}
              placeholder="Describe training materials and support provided"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
