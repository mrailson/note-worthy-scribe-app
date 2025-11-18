import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Workflow } from "lucide-react";
import type { Interoperability } from "@/types/dtac";

interface Props {
  data: Interoperability;
  onChange: (data: Interoperability) => void;
}

export const InteroperabilitySection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof Interoperability, value: string | boolean | string[]) => {
    onChange({ ...data, [field]: value });
  };

  const standardOptions = [
    { id: "HL7", label: "HL7 FHIR" },
    { id: "SNOMED", label: "SNOMED CT" },
    { id: "READ", label: "Read Codes" },
    { id: "ICD10", label: "ICD-10" },
    { id: "OPCS4", label: "OPCS-4" },
    { id: "NHS_NUMBER", label: "NHS Number" },
  ];

  const toggleStandard = (standard: string) => {
    const current = data.c4_1_standardsCompliance || [];
    const updated = current.includes(standard)
      ? current.filter(s => s !== standard)
      : [...current, standard];
    handleChange('c4_1_standardsCompliance', updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Section C4: Interoperability
        </CardTitle>
        <CardDescription>
          Demonstrate ability to integrate with NHS systems and standards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">C4.1 Standards Compliance *</h3>
          <p className="text-sm text-muted-foreground">Select all applicable standards:</p>
          
          <div className="grid gap-3 md:grid-cols-2">
            {standardOptions.map((standard) => (
              <div key={standard.id} className="flex items-center space-x-2">
                <Checkbox
                  id={standard.id}
                  checked={data.c4_1_standardsCompliance?.includes(standard.id)}
                  onCheckedChange={() => toggleStandard(standard.id)}
                />
                <Label htmlFor={standard.id} className="font-normal cursor-pointer">
                  {standard.label}
                </Label>
              </div>
            ))}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="c4_1_details">Standards Details</Label>
            <Textarea
              id="c4_1_details"
              value={data.c4_1_standardsDetails}
              onChange={(e) => handleChange('c4_1_standardsDetails', e.target.value)}
              placeholder="Provide details about how your technology implements these standards"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C4.2 API Availability *</h3>
          <RadioGroup
            value={data.c4_2_apiAvailable ? "yes" : "no"}
            onValueChange={(value) => handleChange('c4_2_apiAvailable', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="api-yes" />
              <Label htmlFor="api-yes">Yes - API available</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="api-no" />
              <Label htmlFor="api-no">No - No API</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="c4_2_docs">API Documentation</Label>
            <Textarea
              id="c4_2_docs"
              value={data.c4_2_apiDocumentation}
              onChange={(e) => handleChange('c4_2_apiDocumentation', e.target.value)}
              placeholder="Provide link to API documentation or describe API capabilities"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C4.3 Integration Support *</h3>
          <Textarea
            id="c4_3"
            value={data.c4_3_integrationSupport}
            onChange={(e) => handleChange('c4_3_integrationSupport', e.target.value)}
            placeholder="Describe integration support provided (technical assistance, documentation, training, SLAs)"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};
