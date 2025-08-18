import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, Building2, KeyRound } from 'lucide-react';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PracticeDetails {
  id?: string;
  practice_name: string;
  address: string;
  email: string;
  website: string;
  phone: string;
  direct_dial?: string;
}

export const UserProfileModal = ({ open, onOpenChange }: UserProfileModalProps) => {
  const { user, resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails>({
    practice_name: '',
    address: '',
    email: '',
    website: '',
    phone: '',
    direct_dial: ''
  });

  useEffect(() => {
    if (open && user) {
      fetchPracticeDetails();
    }
  }, [open, user]);

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
          direct_dial: '' // This field doesn't exist in the table, so we'll keep it as empty
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

      toast.success('Practice details updated successfully');
    } catch (error: any) {
      console.error('Error saving practice details:', error);
      toast.error('Failed to update practice details: ' + error.message);
    } finally {
      setLoading(false);
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
          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Information</CardTitle>
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
                <Label>User ID</Label>
                <Input
                  value={user?.id || ''}
                  disabled
                  className="bg-muted text-xs"
                />
              </div>
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