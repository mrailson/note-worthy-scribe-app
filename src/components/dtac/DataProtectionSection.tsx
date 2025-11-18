import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, FileText, ExternalLink, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DataProtection } from "@/types/dtac";

interface Props {
  data: DataProtection;
  onChange: (data: DataProtection) => void;
}

export const DataProtectionSection: React.FC<Props> = ({ data, onChange }) => {
  const navigate = useNavigate();
  
  const handleChange = (field: keyof DataProtection, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Section C2: Data Protection
        </CardTitle>
        <CardDescription>
          Demonstrate compliance with UK GDPR and NHS data protection requirements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">C2.1 ICO Registration *</h3>
          <RadioGroup
            value={data.c2_1_icoRegistered ? "yes" : "no"}
            onValueChange={(value) => handleChange('c2_1_icoRegistered', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="ico-yes" />
              <Label htmlFor="ico-yes">Yes - Registered with ICO</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="ico-no" />
              <Label htmlFor="ico-no">No - Not registered</Label>
            </div>
          </RadioGroup>
          
          <div className="space-y-2">
            <Label htmlFor="c2_1_number">ICO Registration Number</Label>
            <Input
              id="c2_1_number"
              value={data.c2_1_icoNumber}
              onChange={(e) => handleChange('c2_1_icoNumber', e.target.value)}
              placeholder="e.g., ZA123456"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C2.2 Data Protection Officer *</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c2_2_name">DPO Name</Label>
              <Input
                id="c2_2_name"
                value={data.c2_2_dpoName}
                onChange={(e) => handleChange('c2_2_dpoName', e.target.value)}
                placeholder="Enter DPO name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c2_2_contact">DPO Contact</Label>
              <Input
                id="c2_2_contact"
                value={data.c2_2_dpoContact}
                onChange={(e) => handleChange('c2_2_dpoContact', e.target.value)}
                placeholder="Email and phone"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C2.3 DSPT Status *</h3>
          <div className="space-y-2">
            <Label htmlFor="c2_3_status">Data Security and Protection Toolkit Status</Label>
            <Input
              id="c2_3_status"
              value={data.c2_3_dsptStatus}
              onChange={(e) => handleChange('c2_3_dsptStatus', e.target.value)}
              placeholder="e.g., Standards Met, Standards Exceeded"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="c2_3_evidence">DSPT Evidence</Label>
            <Textarea
              id="c2_3_evidence"
              value={data.c2_3_dsptEvidence}
              onChange={(e) => handleChange('c2_3_dsptEvidence', e.target.value)}
              placeholder="Provide details of your DSPT submission and status"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C2.3.2 Data Protection Impact Assessment (DPIA) *</h3>
          
          <Alert className="border-primary/50 bg-primary/5">
            <FileText className="h-4 w-4" />
            <AlertTitle>DPIA Requirement</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>
                A comprehensive DPIA is required for any NHS digital technology that processes patient data.
                This DTAC assessment should reference your completed DPIA.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dpia')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Full DPIA
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <RadioGroup
            value={data.c2_3_2_dpiaCompleted ? "yes" : "no"}
            onValueChange={(value) => handleChange('c2_3_2_dpiaCompleted', value === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="dpia-yes" />
              <Label htmlFor="dpia-yes">Yes - DPIA completed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="dpia-no" />
              <Label htmlFor="dpia-no">No - DPIA not yet completed</Label>
            </div>
          </RadioGroup>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c2_3_2_date">DPIA Completion Date</Label>
              <Input
                id="c2_3_2_date"
                type="date"
                value={data.c2_3_2_dpiaDate}
                onChange={(e) => handleChange('c2_3_2_dpiaDate', e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="c2_3_2_summary">DPIA Summary</Label>
            <Textarea
              id="c2_3_2_summary"
              value={data.c2_3_2_dpiaSummary}
              onChange={(e) => handleChange('c2_3_2_dpiaSummary', e.target.value)}
              placeholder="Summarise key findings from your DPIA including identified risks and mitigations"
              rows={4}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C2.4 Data Minimisation *</h3>
          <Textarea
            id="c2_4"
            value={data.c2_4_dataMinimisation}
            onChange={(e) => handleChange('c2_4_dataMinimisation', e.target.value)}
            placeholder="Explain how your technology ensures only necessary data is collected and processed"
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">C2.5 Data Location *</h3>
          <div className="space-y-2">
            <Label htmlFor="c2_5_location">Where is data stored?</Label>
            <Input
              id="c2_5_location"
              value={data.c2_5_dataLocation}
              onChange={(e) => handleChange('c2_5_dataLocation', e.target.value)}
              placeholder="e.g., UK, EEA"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="c2_5_details">Data Location Details</Label>
            <Textarea
              id="c2_5_details"
              value={data.c2_5_dataLocationDetails}
              onChange={(e) => handleChange('c2_5_dataLocationDetails', e.target.value)}
              placeholder="Provide details about data centres, processors, and any international transfers"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
