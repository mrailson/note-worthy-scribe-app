import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key } from 'lucide-react';

export const QuickPasswordUpdate = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const handlePasswordUpdate = async () => {
    try {
      setUpdating(true);
      
      const { data, error } = await supabase.functions.invoke('update-user-password-admin', {
        body: { email, new_password: newPassword }
      });
      
      if (error) {
        throw error;
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update password');
      }
      
      toast.success('Password updated successfully');
      
    } catch (error: any) {
      console.error('Password update failed:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Quick Password Update
        </CardTitle>
        <CardDescription>
          Update user password (Admin Only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">User Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@nhs.net"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Strong password"
          />
        </div>
        
        <Button 
          onClick={handlePasswordUpdate}
          disabled={updating || !email || !newPassword}
          className="w-full"
        >
          {updating ? 'Updating...' : 'Update Password'}
        </Button>
      </CardContent>
    </Card>
  );
};