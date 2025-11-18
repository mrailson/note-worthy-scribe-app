import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2 } from "lucide-react";
import type { CompanyInformation } from "@/types/dtac";

interface Props {
  data: CompanyInformation;
  onChange: (data: CompanyInformation) => void;
}

export const CompanyInfoSection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof CompanyInformation, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Section A: Company Information
        </CardTitle>
        <CardDescription>
          Provide details about your organisation and the digital technology being assessed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="a1">A1. Company Name *</Label>
            <Input
              id="a1"
              value={data.a1_companyName}
              onChange={(e) => handleChange('a1_companyName', e.target.value)}
              placeholder="Enter company name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a2">A2. Product/Service Name *</Label>
            <Input
              id="a2"
              value={data.a2_productName}
              onChange={(e) => handleChange('a2_productName', e.target.value)}
              placeholder="Enter product name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a3">A3. Product Type *</Label>
            <Input
              id="a3"
              value={data.a3_productType}
              onChange={(e) => handleChange('a3_productType', e.target.value)}
              placeholder="e.g., Clinical decision support, Patient portal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a4">A4. Primary Contact Name *</Label>
            <Input
              id="a4"
              value={data.a4_contactName}
              onChange={(e) => handleChange('a4_contactName', e.target.value)}
              placeholder="Enter contact name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a5">A5. Contact Email *</Label>
            <Input
              id="a5"
              type="email"
              value={data.a5_contactEmail}
              onChange={(e) => handleChange('a5_contactEmail', e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a6">A6. Contact Phone *</Label>
            <Input
              id="a6"
              type="tel"
              value={data.a6_contactPhone}
              onChange={(e) => handleChange('a6_contactPhone', e.target.value)}
              placeholder="+44 20 xxxx xxxx"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a7">A7. Company Registration Number *</Label>
            <Input
              id="a7"
              value={data.a7_companyRegistrationNumber}
              onChange={(e) => handleChange('a7_companyRegistrationNumber', e.target.value)}
              placeholder="e.g., 12345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a9">A9. Website URL</Label>
            <Input
              id="a9"
              type="url"
              value={data.a9_websiteUrl}
              onChange={(e) => handleChange('a9_websiteUrl', e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a10">A10. Years Trading *</Label>
            <Input
              id="a10"
              value={data.a10_yearsTrading}
              onChange={(e) => handleChange('a10_yearsTrading', e.target.value)}
              placeholder="e.g., 5 years"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="a8">A8. Registered Address *</Label>
          <Textarea
            id="a8"
            value={data.a8_registeredAddress}
            onChange={(e) => handleChange('a8_registeredAddress', e.target.value)}
            placeholder="Enter full registered address"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};
