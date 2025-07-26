import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, Save, Image as ImageIcon, Building2 } from 'lucide-react';

interface ComplaintSignature {
  id?: string;
  name: string;
  job_title: string;
  qualifications?: string;
  email: string;
  phone?: string;
  signature_text?: string;
  signature_image_url?: string;
  practice_id?: string;
  is_default: boolean;
  use_for_acknowledgements: boolean;
  use_for_outcome_letters: boolean;
}

interface PracticeStyle {
  letterhead_style: string;
  acknowledgement_template: string;
  outcome_template: string;
  practice_logo_url?: string;
  practice_address?: string;
  practice_footer?: string;
  show_page_numbers?: boolean;
  website?: string;
  phone?: string;
  email?: string;
}

export const ComplaintSignatureSettings = () => {
  const { user } = useAuth();
  const [signature, setSignature] = useState<ComplaintSignature>({
    name: '',
    job_title: '',
    qualifications: '',
    email: user?.email || '',
    phone: '',
    signature_text: '',
    signature_image_url: '',
    is_default: true,
    use_for_acknowledgements: true,
    use_for_outcome_letters: true
  });

  const [practiceStyle, setPracticeStyle] = useState<PracticeStyle>({
    letterhead_style: 'nhs_standard',
    acknowledgement_template: 'nhs_standard',
    outcome_template: 'nhs_standard',
    practice_address: '',
    practice_footer: '',
    show_page_numbers: true,
    website: '',
    phone: '',
    email: ''
  });

  const [practices, setPractices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (user) {
      loadSignatureSettings();
      loadPractices();
    }
  }, [user]);

  // Load practice style when signature.practice_id changes
  useEffect(() => {
    if (signature.practice_id) {
      loadPracticeStyle(signature.practice_id);
    }
  }, [signature.practice_id]);

  const loadSignatureSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_signatures')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!error && data) {
        setSignature(data);
      }
    } catch (error: any) {
      console.log('No existing signature settings found');
    }
  };

  const loadPractices = async () => {
    try {
      // Get user's practice details directly
      const { data: userPractices, error: practicesError } = await supabase
        .from('practice_details')
        .select('id, practice_name')
        .eq('user_id', user?.id);

      if (!practicesError && userPractices) {
        // Transform the data to match expected format
        const formattedPractices = userPractices.map(p => ({
          practice_id: p.id,
          practice_name: p.practice_name
        }));
        
        setPractices(formattedPractices);
        
        // Auto-select the first practice if available and none is selected
        if (formattedPractices.length > 0 && !signature.practice_id) {
          setSignature(prev => ({ ...prev, practice_id: formattedPractices[0].practice_id }));
          loadPracticeStyle(formattedPractices[0].practice_id);
        } else if (signature.practice_id) {
          loadPracticeStyle(signature.practice_id);
        }
      }
    } catch (error: any) {
      console.error('Error loading practices:', error);
    }
  };

  const loadPracticeStyle = async (practiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .eq('id', practiceId)
        .single();

      if (!error && data) {
        setPracticeStyle(prev => ({
          ...prev,
          practice_address: data.address || '',
          practice_footer: data.footer_text || '',
          practice_logo_url: data.logo_url || '',
          show_page_numbers: data.show_page_numbers ?? true,
          website: data.website || '',
          phone: data.phone || '',
          email: data.email || ''
        }));
      }
    } catch (error: any) {
      console.log('No practice style settings found');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !signature.practice_id) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${signature.practice_id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('practice-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('practice-logos')
        .getPublicUrl(fileName);

      setPracticeStyle(prev => ({
        ...prev,
        practice_logo_url: urlData.publicUrl
      }));

      toast.success('Practice logo uploaded successfully');
    } catch (error: any) {
      toast.error(`Error uploading logo: ${error.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSignatureSettings = async () => {
    console.log('saveSignatureSettings called');
    console.log('signature:', signature);
    console.log('practiceStyle:', practiceStyle);
    
    if (!signature.name || !signature.job_title || !signature.email) {
      console.log('Validation failed - missing required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    if (!user?.id) {
      console.log('User not authenticated');
      toast.error('User not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      const signatureData = {
        ...signature,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      // Remove the id from signatureData for insert/update operations
      const { id, ...dataForOperation } = signatureData;

      if (signature.id) {
        const { error } = await supabase
          .from('complaint_signatures')
          .update(dataForOperation)
          .eq('id', signature.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('complaint_signatures')
          .insert([dataForOperation])
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        setSignature(data);
      }

      // Save practice style settings if practice is selected
      if (signature.practice_id) {
        const { error: practiceError } = await supabase
          .from('practice_details')
          .update({
            address: practiceStyle.practice_address,
            footer_text: practiceStyle.practice_footer,
            logo_url: practiceStyle.practice_logo_url,
            show_page_numbers: practiceStyle.show_page_numbers,
            website: practiceStyle.website,
            phone: practiceStyle.phone,
            email: practiceStyle.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', signature.practice_id);

        if (practiceError) {
          console.error('Practice update error:', practiceError);
          throw practiceError;
        }
      }

      toast.success('Signature settings saved successfully');
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error: any) {
      console.error('Error saving signature settings:', error);
      toast.error(`Error saving settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Personal Signature Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Personal Signature Details
          </CardTitle>
          <CardDescription>
            Configure your personal signature details for complaint letters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={signature.name}
                onChange={(e) => setSignature(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Dr. John Smith"
              />
            </div>
            <div>
              <Label htmlFor="job_title">Job Title *</Label>
              <Input
                id="job_title"
                value={signature.job_title}
                onChange={(e) => setSignature(prev => ({ ...prev, job_title: e.target.value }))}
                placeholder="Practice Manager / GP / Clinical Lead"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qualifications">Qualifications</Label>
              <Input
                id="qualifications"
                value={signature.qualifications || ''}
                onChange={(e) => setSignature(prev => ({ ...prev, qualifications: e.target.value }))}
                placeholder="MBBS, MRCGP, DRCOG"
              />
            </div>
            <div>
              <Label htmlFor="practice">Practice</Label>
              <Select 
                value={signature.practice_id || ''} 
                onValueChange={(value) => {
                  setSignature(prev => ({ ...prev, practice_id: value }));
                  if (value) loadPracticeStyle(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select practice" />
                </SelectTrigger>
                <SelectContent>
                  {practices.map((practice) => (
                    <SelectItem key={practice.practice_id} value={practice.practice_id}>
                      {practice.practice_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={signature.email}
                onChange={(e) => setSignature(prev => ({ ...prev, email: e.target.value }))}
                placeholder="doctor@practice.nhs.uk"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={signature.phone || ''}
                onChange={(e) => setSignature(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="01234 567890"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="signature_text">Signature Text</Label>
            <Textarea
              id="signature_text"
              value={signature.signature_text || ''}
              onChange={(e) => setSignature(prev => ({ ...prev, signature_text: e.target.value }))}
              placeholder="Additional signature text or closing remarks"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="use_acknowledgements"
                checked={signature.use_for_acknowledgements}
                onCheckedChange={(checked) => setSignature(prev => ({ ...prev, use_for_acknowledgements: checked }))}
              />
              <Label htmlFor="use_acknowledgements">Use for Acknowledgement Letters</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="use_outcomes"
                checked={signature.use_for_outcome_letters}
                onCheckedChange={(checked) => setSignature(prev => ({ ...prev, use_for_outcome_letters: checked }))}
              />
              <Label htmlFor="use_outcomes">Use for Outcome Letters</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Practice Branding & Style */}
      {signature.practice_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Practice Branding & Letter Style
            </CardTitle>
            <CardDescription>
              Configure practice logo, address, and letter template styles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="practice_logo">Practice Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                {practiceStyle.practice_logo_url && (
                  <img 
                    src={practiceStyle.practice_logo_url} 
                    alt="Practice Logo" 
                    className="h-16 w-16 object-contain border rounded"
                  />
                )}
                <div>
                  <input
                    id="practice_logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('practice_logo')?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="practice_address">Practice Address</Label>
              <Textarea
                id="practice_address"
                value={practiceStyle.practice_address || ''}
                onChange={(e) => setPracticeStyle(prev => ({ ...prev, practice_address: e.target.value }))}
                placeholder="Practice Name&#10;Street Address&#10;City, Postcode"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="practice_footer">Practice Footer Text</Label>
              <Textarea
                id="practice_footer"
                value={practiceStyle.practice_footer || ''}
                onChange={(e) => setPracticeStyle(prev => ({ ...prev, practice_footer: e.target.value }))}
                placeholder="Additional footer information, website, registration details, etc."
                rows={2}
              />
            </div>

            {/* Footer Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show_page_numbers">Footer Settings</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show_page_numbers"
                    checked={practiceStyle.show_page_numbers ?? true}
                    onCheckedChange={(checked) => setPracticeStyle(prev => ({ ...prev, show_page_numbers: checked }))}
                  />
                  <Label htmlFor="show_page_numbers">Show Page Numbers</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="practice_website">Practice Website</Label>
                  <Input
                    id="practice_website"
                    value={practiceStyle.website || ''}
                    onChange={(e) => setPracticeStyle(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="www.practicename.nhs.uk"
                  />
                </div>
                <div>
                  <Label htmlFor="practice_phone_footer">Practice Phone</Label>
                  <Input
                    id="practice_phone_footer"
                    value={practiceStyle.phone || ''}
                    onChange={(e) => setPracticeStyle(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="01234 567890"
                  />
                </div>
                <div>
                  <Label htmlFor="practice_email_footer">Practice Email</Label>
                  <Input
                    id="practice_email_footer"
                    value={practiceStyle.email || ''}
                    onChange={(e) => setPracticeStyle(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@practice.nhs.net"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="acknowledgement_style">Acknowledgement Letter Style</Label>
                <Select 
                  value={practiceStyle.acknowledgement_template} 
                  onValueChange={(value) => setPracticeStyle(prev => ({ ...prev, acknowledgement_template: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nhs_standard">NHS Standard Template</SelectItem>
                    <SelectItem value="custom_branded">Custom with Practice Branding</SelectItem>
                    <SelectItem value="minimal">Minimal Style</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="outcome_style">Outcome Letter Style</Label>
                <Select 
                  value={practiceStyle.outcome_template} 
                  onValueChange={(value) => setPracticeStyle(prev => ({ ...prev, outcome_template: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nhs_standard">NHS Standard Template</SelectItem>
                    <SelectItem value="custom_branded">Custom with Practice Branding</SelectItem>
                    <SelectItem value="minimal">Minimal Style</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={saveSignatureSettings} disabled={isLoading || isSaved}>
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? 'Saving...' : isSaved ? 'Saved' : 'Save Signature Settings'}
        </Button>
      </div>
    </div>
  );
};