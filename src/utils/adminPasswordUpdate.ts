import { supabase } from '@/integrations/supabase/client';

export const updateUserPassword = async (email: string, newPassword: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('update-user-password-admin', {
      body: { email, new_password: newPassword }
    });
    
    if (error) {
      throw error;
    }
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to update password');
    }
    
    return { success: true, message: data.message };
  } catch (error: any) {
    console.error('Password update error:', error);
    throw new Error(error.message || 'Failed to update password');
  }
};

// Call this function to update the password
updateUserPassword('lucy.hibberd@nhs.net', 'Letmein1!')
  .then(result => {
    console.log('Password update successful:', result.message);
  })
  .catch(error => {
    console.error('Password update failed:', error.message);
  });