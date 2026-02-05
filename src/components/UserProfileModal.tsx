import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, Building2, KeyRound, Upload, X, FileImage, PenTool, Image as ImageIcon, Mail, FileText, Save, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import SignatureEditor from '@/components/SignatureEditor';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OrganisationType = 'practice' | 'non-practice';

interface UserProfile {
  id?: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  organisation_type: OrganisationType;
  letter_signature?: string; // Personal signature - stored per-user
  email_signature?: string;  // Personal email signature - stored per-user
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
  // Note: letter_signature removed - now stored in UserProfile (per-user)
}

export const UserProfileModal = ({ open, onOpenChange }: UserProfileModalProps) => {
  const { user, resetPassword, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [signatureLoading, setSignatureLoading] = useState(false);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    organisation_type: 'practice'
  });
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails>({
    practice_name: '',
    address: '',
    email: '',
    website: '',
    phone: '',
    direct_dial: '',
    practice_logo_url: ''
  });

  useEffect(() => {
    if (open && user) {
      console.log('UserProfileModal opening for user:', user.id);
      fetchUserProfile();
      fetchPracticeDetails();
    }
  }, [open, user]);

  // Add auto-refresh when modal is open
  // Removed periodic auto-refresh to prevent overwriting in-progress edits (e.g., digital signature)
  // Previously this ran every 5s and could reset local state while typing.
  // If needed later, reintroduce with an "isEditing" guard around SignatureEditor.

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
        // Determine organisation type based on role (case-insensitive check)
        const nonPracticeRoles = ['lmc user', 'federation user', 'icb user'];
        const savedRole = data.department || '';
        const orgType: OrganisationType = nonPracticeRoles.includes(savedRole.toLowerCase()) ? 'non-practice' : 'practice';
        
        setUserProfile({
          id: data.id,
          title: (data as any).title || '',
          first_name: data.full_name?.split(' ')[0] || '',
          last_name: data.full_name?.split(' ').slice(1).join(' ') || '',
          email: user.email || '',
          role: savedRole,
          organisation_type: orgType,
          letter_signature: (data as any).letter_signature || '',
          email_signature: (data as any).email_signature || ''
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
    if (!user) {
      console.log('No user found, skipping practice details fetch');
      return;
    }

    console.log('Fetching practice details for user:', user.id);

    try {
      // First, get user's practice assignments from user_roles (filter out null practice_ids)
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .not('practice_id', 'is', null);

      console.log('User roles query result:', { userRoles, rolesError });

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        return;
      }

      if (userRoles && userRoles.length > 0) {
        const practiceId = userRoles[0].practice_id;
        console.log('Found practice_id:', practiceId);
        
        // IMPORTANT: practice_id references gp_practices.id, NOT practice_details.id
        // First get the organisation name from gp_practices
        const { data: gpPractice, error: gpError } = await supabase
          .from('gp_practices')
          .select('name')
          .eq('id', practiceId)
          .maybeSingle();

        console.log('GP practice lookup result:', { gpPractice, gpError });

        if (gpPractice?.name) {
          // Now find practice_details that matches this organisation name (shared across all users)
          const { data: practiceData, error: practiceError } = await supabase
            .from('practice_details')
            .select('*')
            .ilike('practice_name', gpPractice.name)
            .order('updated_at', { ascending: false })
            .maybeSingle();

          console.log('Practice details query result:', { practiceData, practiceError });

          if (!practiceError && practiceData) {
            console.log('Setting practice details from organisation lookup:', practiceData);
            setPracticeDetails({
              id: practiceData.id,
              practice_name: practiceData.practice_name || '',
              address: practiceData.address || '',
              email: practiceData.email || '',
              website: practiceData.website || '',
              phone: practiceData.phone || '',
              direct_dial: '',
              practice_logo_url: (practiceData as any).practice_logo_url || ''
            });
            console.log('Practice details state updated successfully (shared org details)');
            return;
          }
        }
      }

      console.log('No practice found via user_roles, trying direct lookup...');
      
      // Fallback: try to get practice details directly by user_id
      const { data: directPracticeData, error: directError } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      console.log('Direct practice lookup result:', { directPracticeData, directError });

      if (!directError && directPracticeData && directPracticeData.length > 0) {
        console.log('Setting practice details from direct lookup:', directPracticeData[0]);
        setPracticeDetails({
          id: directPracticeData[0].id,
          practice_name: directPracticeData[0].practice_name || '',
          address: directPracticeData[0].address || '',
          email: directPracticeData[0].email || '',
          website: directPracticeData[0].website || '',
          phone: directPracticeData[0].phone || '',
          direct_dial: '',
          practice_logo_url: (directPracticeData[0] as any).practice_logo_url || ''
        });
        console.log('Practice details state updated from direct lookup');
      } else {
        console.log('No practice details found anywhere');
      }
    } catch (error) {
      console.error('Unexpected error fetching practice details:', error);
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

  const handleChangePassword = async () => {
    // Validate password requirements
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setPasswordChangeLoading(true);
    try {
      const { error } = await updatePassword(newPassword);
      
      if (error) {
        toast.error('Failed to change password: ' + error.message);
      } else {
        toast.success('Password changed successfully!');
        // Clear the form
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setPasswordChangeLoading(false);
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

  const handleSaveSignatures = async () => {
    if (!user) return;

    setSignatureLoading(true);
    try {
      console.log('Saving signature for user:', user.id);
      console.log('Signature length:', userProfile.letter_signature?.length || 0);

      // Save signature to user's profile (personal, not shared)
      const { error } = await supabase
        .from('profiles')
        .update({
          letter_signature: userProfile.letter_signature || '',
          email_signature: userProfile.email_signature || '',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      console.log('Signature saved to user profile successfully');
      toast.success('Signature saved successfully');
    } catch (error: any) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature: ' + error.message);
    } finally {
      setSignatureLoading(false);
    }
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

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="personal" className="text-xs sm:text-sm">
              <User className="h-4 w-4 mr-1 hidden sm:inline" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="practice" className="text-xs sm:text-sm">
              <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="password" className="text-xs sm:text-sm">
              <KeyRound className="h-4 w-4 mr-1 hidden sm:inline" />
              Password
            </TabsTrigger>
            <TabsTrigger value="signature" className="text-xs sm:text-sm">
              <PenTool className="h-4 w-4 mr-1 hidden sm:inline" />
              Signature
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
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
                <Label htmlFor="organisation_type">Organisation Type</Label>
                <Select
                  value={userProfile.organisation_type}
                  onValueChange={(value: OrganisationType) => {
                    setUserProfile(prev => ({ 
                      ...prev, 
                      organisation_type: value,
                      role: '' // Reset role when organisation type changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organisation type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="non-practice">Non-Practice (LMC, Federation, ICB)</SelectItem>
                  </SelectContent>
                </Select>
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
                    {userProfile.organisation_type === 'practice' ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <SelectItem value="LMC User">LMC User</SelectItem>
                        <SelectItem value="Federation User">Federation User</SelectItem>
                        <SelectItem value="ICB User">ICB User</SelectItem>
                      </>
                    )}
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
          </TabsContent>

          {/* Practice Details Tab (includes Logo) */}
          <TabsContent value="practice" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
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
                  onChange={(e) => setPracticeDetails(prev => ({ ...prev, practice_name: e.target.value }))}
                  placeholder="Enter practice name"
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
                <Label htmlFor="practice_email">Practice Email</Label>
                <Input
                  id="practice_email"
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
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <Label htmlFor="direct_dial">Direct Dial (Optional)</Label>
                  <Input
                    id="direct_dial"
                    name="direct_dial"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={practiceDetails.direct_dial}
                    onChange={(e) => {
                      const next = e.target.value;
                      // Prevent browser/email autofill from polluting a telephone field
                      if (next.includes('@')) {
                        setPracticeDetails((prev) => ({ ...prev, direct_dial: '' }));
                        return;
                      }
                      setPracticeDetails((prev) => ({ ...prev, direct_dial: next }));
                    }}
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
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Practice Details
                  </>
                )}
              </Button>
              </CardContent>
            </Card>

            {/* Practice Logo - in Practice tab */}
            <Card>
              <CardHeader className="pb-3">
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
          </TabsContent>

          {/* Password Management Tab */}
          <TabsContent value="password" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Password Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Direct Password Change */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Change Password</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        name="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        name="confirm-password"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="space-y-1 text-sm">
                    <div className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {newPassword.length >= 8 ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 ${/\d/.test(newPassword) ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {/\d/.test(newPassword) ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      Contains at least one number
                    </div>
                    <div className={`flex items-center gap-2 ${newPassword && confirmNewPassword && newPassword === confirmNewPassword ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {newPassword && confirmNewPassword && newPassword === confirmNewPassword ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      Passwords match
                    </div>
                  </div>

                  <Button 
                    onClick={handleChangePassword}
                    disabled={passwordChangeLoading || newPassword.length < 8 || !/\d/.test(newPassword) || newPassword !== confirmNewPassword}
                    className="w-full"
                  >
                    {passwordChangeLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digital Signature Tab */}
          <TabsContent value="signature" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Digital Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Signature */}
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" />
                    Signature
                  </Label>
                  <SignatureEditor
                    content={userProfile.letter_signature || ''}
                    onChange={(content) => setUserProfile(prev => ({ ...prev, letter_signature: content }))}
                    placeholder="Create your professional signature..."
                  />
                </div>

                <Button 
                  onClick={handleSaveSignatures}
                  disabled={signatureLoading}
                  className="w-full"
                >
                  {signatureLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Signature...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Signature
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};