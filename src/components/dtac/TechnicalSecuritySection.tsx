import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Lock } from "lucide-react";
import type { TechnicalSecurity } from "@/types/dtac";

interface Props {
  data: TechnicalSecurity;
  onChange: (data: TechnicalSecurity) => void;
}

export const TechnicalSecuritySection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof TechnicalSecurity, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Section C3: Technical Security
        </CardTitle>
        <CardDescription>
          Demonstrate robust technical security measures and certifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">C3.1 Cyber Essentials Certification *</h3>
          
          <div className="space-y-3">
            <RadioGroup
              value={data.c3_1_cyberEssentials ? "yes" : "no"}
              onValueChange={(value) => handleChange('c3_1_cyberEssentials', value === "yes")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="ce-yes" />
                <Label htmlFor="ce-yes">Yes - Cyber Essentials certified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="ce-no" />
                <Label htmlFor="ce-no">No - Not certified</Label>
              </div>
            </RadioGroup>

            <RadioGroup
              value={data.c3_1_cyberEssentialsPlus ? "yes" : "no"}
              onValueChange={(value) => handleChange('c3_1_cyberEssentialsPlus', value === "yes")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="ceplus-yes" />
                <Label htmlFor="ceplus-yes">Yes - Cyber Essentials Plus certified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="ceplus-no" />
                <Label htmlFor="ceplus-no">No - Not certified</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="c3_1_cert">Certificate Number</Label>
            <Input
              id="c3_1_cert"
              value={data.c3_1_certificateNumber}
              onChange={(e) => handleChange('c3_1_certificateNumber', e.target.value)}
              placeholder="Enter certificate number if applicable"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C3.2 Penetration Testing *</h3>
          <RadioGroup
            value={data.c3_2_penetrationTesting ? "yes" : "no"}
            onValueChange={(value) => handleChange('c3_2_penetrationTesting', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="pen-yes" />
              <Label htmlFor="pen-yes">Yes - Regular penetration testing conducted</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="pen-no" />
              <Label htmlFor="pen-no">No - No penetration testing</Label>
            </div>
          </RadioGroup>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c3_2_freq">Testing Frequency</Label>
              <Input
                id="c3_2_freq"
                value={data.c3_2_testingFrequency}
                onChange={(e) => handleChange('c3_2_testingFrequency', e.target.value)}
                placeholder="e.g., Annually, Bi-annually"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c3_2_date">Last Test Date</Label>
              <Input
                id="c3_2_date"
                type="date"
                value={data.c3_2_lastTestDate}
                onChange={(e) => handleChange('c3_2_lastTestDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C3.3 Vulnerability Management *</h3>
          <Textarea
            id="c3_3"
            value={data.c3_3_vulnerabilityManagement}
            onChange={(e) => handleChange('c3_3_vulnerabilityManagement', e.target.value)}
            placeholder="Describe your vulnerability management processes (scanning, patching, monitoring)"
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C3.4 Incident Response *</h3>
          <Textarea
            id="c3_4"
            value={data.c3_4_incidentResponse}
            onChange={(e) => handleChange('c3_4_incidentResponse', e.target.value)}
            placeholder="Describe your incident response procedures including security breach notification"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};
