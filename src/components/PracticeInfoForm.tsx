import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, MapPin, Phone } from 'lucide-react';

interface PracticeInfo {
  name: string;
  address: string;
  phone: string;
}

interface PracticeInfoFormProps {
  practiceInfo: PracticeInfo;
  onPracticeInfoChange: (info: PracticeInfo) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const PracticeInfoForm: React.FC<PracticeInfoFormProps> = ({
  practiceInfo,
  onPracticeInfoChange,
  onSave,
  onCancel
}) => {
  const handleInputChange = (field: keyof PracticeInfo, value: string) => {
    onPracticeInfoChange({
      ...practiceInfo,
      [field]: value
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Practice Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="practice-name">Practice Name *</Label>
          <Input
            id="practice-name"
            value={practiceInfo.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter practice name"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="practice-address" className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Address *
          </Label>
          <Input
            id="practice-address"
            value={practiceInfo.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Enter practice address"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="practice-phone" className="flex items-center gap-1">
            <Phone className="w-4 h-4" />
            Phone Number
          </Label>
          <Input
            id="practice-phone"
            value={practiceInfo.phone || ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="Enter phone number (optional)"
          />
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button onClick={onSave} className="flex-1">
            Save & Export
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};