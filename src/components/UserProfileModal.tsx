import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, Building2, KeyRound, Upload, X, FileImage, PenTool, Image as ImageIcon, Mail, FileText, Save } from 'lucide-react';
import SignatureEditor from '@/components/SignatureEditor';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id?: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface PracticeDetails {
  id?: string;
  practice_name: string;
  address: string;
  email: string;
  website: string;
  phone: string;
  direct_dial?: string;
  practice_logo_url?: string;
  email_signature?: string;
  letter_signature?: string;
}

export const UserProfileModal = ({ open, onOpenChange }: UserProfileModalProps) => {
  const { user, resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    role: ''
  });
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails>({
    practice_name: '',
    address: '',
    email: '',
    website: '',
    phone: '',
    direct_dial: '',
    practice_logo_url: '',
    email_signature: '',
    letter_signature: ''
  });

  useEffect(() => {
    if (open && user) {
      fetchUserProfile();
      fetchPracticeDetails();
    }
  }, [open, user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserProfile({
          id: data.id,
          title: (data as any).title || '', // Use title field from profiles table (type will be updated)
          first_name: data.full_name?.split(' ')[0] || '', // Extract from full_name
          last_name: data.full_name?.split(' ').slice(1).join(' ') || '', // Extract from full_name
          email: user.email || '',
          role: data.department || '' // Use department field from profiles table for role
        });
      } else {
        // No profile found, use email from auth
        setUserProfile(prev => ({
          ...prev,
          email: user.email || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchPracticeDetails = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching practice details:', error);
        return;
      }

      if (data) {
        setPracticeDetails({
          id: data.id,
          practice_name: data.practice_name || '',
          address: data.address || '',
          email: data.email || '',
          website: data.website || '',
          phone: data.phone || '',
          direct_dial: '', // This field doesn't exist in the table, so we'll keep it as empty
          practice_logo_url: (data as any).practice_logo_url || '',
          email_signature: (data as any).email_signature || '',
          letter_signature: (data as any).letter_signature || ''
        });
      }
    } catch (error) {
      console.error('Error fetching practice details:', error);
    }
  };

  const handleSavePracticeDetails = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const practiceData = {
        user_id: user.id,
        practice_name: practiceDetails.practice_name,
        address: practiceDetails.address,
        email: practiceDetails.email,
        website: practiceDetails.website,
        phone: practiceDetails.phone,
        practice_logo_url: practiceDetails.practice_logo_url,
        email_signature: practiceDetails.email_signature,
        letter_signature: practiceDetails.letter_signature,
        updated_at: new Date().toISOString()
      };

      if (practiceDetails.id) {
        // Update existing record
        const { error } = await supabase
          .from('practice_details')
          .update(practiceData)
          .eq('id', practiceDetails.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('practice_details')
          .insert(practiceData);

        if (error) throw error;
      }

      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2000);
      toast.success('Practice details updated successfully');
    } catch (error: any) {
      console.error('Error saving practice details:', error);
      toast.error('Failed to update practice details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserProfile = async () => {
    if (!user) return;

    setProfileLoading(true);
    try {
      const fullName = `${userProfile.first_name} ${userProfile.last_name}`.trim();
      
      if (userProfile.id) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({
            title: userProfile.title, // Save title field
            full_name: fullName,
            department: userProfile.role, // Save role to department field
            updated_at: new Date().toISOString()
          })
          .eq('id', userProfile.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            title: userProfile.title, // Save title field
            full_name: fullName,
            department: userProfile.role, // Save role to department field
            email: user.email
          });

        if (error) throw error;
      }

      toast.success('Personal information updated successfully');
    } catch (error: any) {
      console.error('Error saving user profile:', error);
      toast.error('Failed to update personal information: ' + error.message);
    } finally {
      setProfileLoading(false);
    }

  };

  const handleResetPassword = async () => {
    if (!user?.email) return;

    setResetLoading(true);
    try {
      const { error } = await resetPassword(user.email);
      
      if (error) {
        toast.error('Failed to send reset email: ' + error.message);
      } else {
        toast.success('Password reset email sent successfully! Check your inbox.');
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setLogoUploading(true);
    try {
      const fileName = `${user.id}/logo-${Date.now()}.${file.type.split('/')[1]}`;
      
      // Delete existing logo if present
      if (practiceDetails.practice_logo_url) {
        const oldPath = practiceDetails.practice_logo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('practice-logos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('practice-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('practice-logos')
        .getPublicUrl(fileName);

      // Update practice details
      setPracticeDetails(prev => ({ ...prev, practice_logo_url: publicUrl }));
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo: ' + error.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setPracticeDetails(prev => ({ ...prev, practice_logo_url: '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            My Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Select
                  value={userProfile.title}
                  onValueChange={(value) => setUserProfile(prev => ({ ...prev, title: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Miss">Miss</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                    <SelectItem value="Prof">Prof</SelectItem>
                    <SelectItem value="Rev">Rev</SelectItem>
                    <SelectItem value="Sir">Sir</SelectItem>
                    <SelectItem value="Dame">Dame</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={userProfile.first_name}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={userProfile.last_name}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={userProfile.role}
                  onValueChange={(value) => setUserProfile(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GP Partner">GP Partner</SelectItem>
                    <SelectItem value="Practice Manager">Practice Manager</SelectItem>
                    <SelectItem value="Salaried GP">Salaried GP</SelectItem>
                    <SelectItem value="Locum GP">Locum GP</SelectItem>
                    <SelectItem value="Advanced Nurse Practitioner">Advanced Nurse Practitioner</SelectItem>
                    <SelectItem value="Practice Nurse">Practice Nurse</SelectItem>
                    <SelectItem value="Clinical Pharmacist">Clinical Pharmacist</SelectItem>
                    <SelectItem value="First Contact Practitioner">First Contact Practitioner</SelectItem>
                    <SelectItem value="Physician Associate">Physician Associate</SelectItem>
                    <SelectItem value="Healthcare Assistant">Healthcare Assistant</SelectItem>
                    <SelectItem value="Mental Health Practitioner">Mental Health Practitioner</SelectItem>
                    <SelectItem value="Social Prescriber">Social Prescriber</SelectItem>
                    <SelectItem value="Care Coordinator">Care Coordinator</SelectItem>
                    <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                    <SelectItem value="Secretary">Secretary</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSaveUserProfile}
                disabled={profileLoading}
                className="w-full"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Personal Information'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Practice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Practice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="practice_name">Practice Name</Label>
                <Input
                  id="practice_name"
                  value={practiceDetails.practice_name}
                  disabled
                  className="bg-muted"
                  placeholder="Practice name is defined in system settings"
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={practiceDetails.address}
                  onChange={(e) => setPracticeDetails(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter practice address"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="email">Practice Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={practiceDetails.email}
                  onChange={(e) => setPracticeDetails(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter practice email"
                />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={practiceDetails.website}
                  onChange={(e) => setPracticeDetails(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="Enter website URL"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Main Phone Number</Label>
                  <Input
                    id="phone"
                    value={practiceDetails.phone}
                    onChange={(e) => setPracticeDetails(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter main phone number"
                  />
                </div>

                <div>
                  <Label htmlFor="direct_dial">Direct Dial (Optional)</Label>
                  <Input
                    id="direct_dial"
                    value={practiceDetails.direct_dial}
                    onChange={(e) => setPracticeDetails(prev => ({ ...prev, direct_dial: e.target.value }))}
                    placeholder="Enter direct dial number"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSavePracticeDetails}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Practice Details'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Email & Letter Signatures */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Digital Signatures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Signature */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4" />
                  Email Signature
                </Label>
                <SignatureEditor
                  content={practiceDetails.email_signature || ''}
                  onChange={(content) => setPracticeDetails(prev => ({ ...prev, email_signature: content }))}
                  placeholder="Create your professional email signature..."
                />
              </div>

              <Separator />

              {/* Letter Signature */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4" />
                  Letter Signature
                </Label>
                <SignatureEditor
                  content={practiceDetails.letter_signature || ''}
                  onChange={(content) => setPracticeDetails(prev => ({ ...prev, letter_signature: content }))}
                  placeholder="Create your professional letter signature..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Practice Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Practice Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {practiceDetails.practice_logo_url ? (
                <div className="space-y-4">
                  <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 bg-muted/10">
                    <img 
                      src={practiceDetails.practice_logo_url} 
                      alt="Practice logo"
                      className="max-h-32 mx-auto object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Your current practice logo
                  </p>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                >
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload practice logo
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    PNG, JPG, WEBP up to 10MB
                  </p>
                </div>
              )}
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={logoUploading}
              />
              {logoUploading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm">Uploading logo...</span>
                </div>
              )}
              
              {/* Save Button for Practice Logo */}
              <Button 
                onClick={handleSavePracticeDetails}
                disabled={loading || logoUploading}
                variant="outline"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : logoSaved ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Practice Logo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Password Reset */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Password Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to receive a password reset email at {user?.email}
              </p>
              <Button 
                onClick={handleResetPassword}
                disabled={resetLoading}
                variant="outline"
                className="w-full"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Email...
                  </>
                ) : (
                  'Send Password Reset Email'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};