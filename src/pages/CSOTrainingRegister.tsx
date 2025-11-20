import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, Shield, FileText, AlertCircle } from 'lucide-react';

export default function CSOTrainingRegister() {
  const navigate = useNavigate();
  const { register } = useCSORegistration();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    gmc_number: '',
    email: '',
    phone: '',
    practice_name: '',
    practice_address: '',
    practice_postcode: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      return;
    }

    // Validate GMC number format (7 digits)
    if (!/^\d{7}$/.test(formData.gmc_number)) {
      return;
    }

    // Validate UK postcode format
    const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(formData.practice_postcode)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register(formData);
      navigate('/cso-training-dashboard');
    } catch (error) {
      // Error handling done in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">Clinical Safety Officer Training</h1>
          </div>
          <p className="text-xl text-muted-foreground">Level 1 Certification Programme</p>
          <p className="text-sm text-muted-foreground mt-2">Provided by PCN Services Limited</p>
        </div>

        {/* Programme Overview */}
        <Card className="p-6 mb-8 border-primary/20">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            What You'll Learn
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">DCB0129 & DCB0160 Standards</p>
                <p className="text-sm text-muted-foreground">NHS Digital clinical safety requirements</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Hazard Identification</p>
                <p className="text-sm text-muted-foreground">Systematic risk identification techniques</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Clinical Risk Assessment</p>
                <p className="text-sm text-muted-foreground">ALARP principles and risk matrices</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 bg-primary rounded-full mt-2" />
              <div>
                <p className="font-medium">Incident Management</p>
                <p className="text-sm text-muted-foreground">Investigation and CAPA processes</p>
              </div>
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span><strong>Duration:</strong> Approx. 2.5 hours | <strong>Assessment:</strong> 10 questions (80% pass mark) | <strong>Certificate:</strong> No expiry</span>
            </p>
          </div>
        </Card>

        {/* Registration Form */}
        <Card className="p-8">
          <h2 className="text-2xl font-semibold mb-6">Register for Training</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Personal Details</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Dr Jane Smith"
                  />
                </div>
                
                <div>
                  <Label htmlFor="gmc_number">GMC Number *</Label>
                  <Input
                    id="gmc_number"
                    required
                    pattern="^\d{7}$"
                    value={formData.gmc_number}
                    onChange={(e) => setFormData({ ...formData, gmc_number: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    placeholder="1234567"
                    maxLength={7}
                  />
                  <p className="text-xs text-muted-foreground mt-1">7-digit GMC registration number</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane.smith@nhs.net"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07700 900000"
                  />
                </div>
              </div>
            </div>

            {/* Practice Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">Practice Details</h3>
              
              <div>
                <Label htmlFor="practice_name">Practice Name *</Label>
                <Input
                  id="practice_name"
                  required
                  value={formData.practice_name}
                  onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
                  placeholder="Example Medical Centre"
                />
              </div>

              <div>
                <Label htmlFor="practice_address">Practice Address *</Label>
                <textarea
                  id="practice_address"
                  required
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.practice_address}
                  onChange={(e) => setFormData({ ...formData, practice_address: e.target.value })}
                  placeholder="123 High Street&#10;Example Town"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="practice_postcode">Postcode *</Label>
                <Input
                  id="practice_postcode"
                  required
                  value={formData.practice_postcode}
                  onChange={(e) => setFormData({ ...formData, practice_postcode: e.target.value.toUpperCase() })}
                  placeholder="SW1A 1AA"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I agree to the terms and conditions
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I confirm that the information provided is accurate and I consent to PCN Services Limited processing my data for the purpose of this training programme.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">
                  Your data will be stored securely and used only for training administration and certificate issuance. 
                  It will not be shared with third parties without your consent.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || !agreedToTerms}
            >
              {isSubmitting ? 'Registering...' : 'Begin Training Programme'}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Official Sensitive - For authorised use only</p>
          <p className="mt-2">© {new Date().getFullYear()} PCN Services Limited. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
