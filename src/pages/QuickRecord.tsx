import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mic, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const QuickRecord = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'validating' | 'authenticating' | 'error'>('validating');
  const [errorMessage, setErrorMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    const validateAndAuthenticate = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('No token provided. Please use a valid Quick Record link.');
        return;
      }

      try {
        setStatus('validating');

        // Call edge function to validate token
        const { data, error } = await supabase.functions.invoke('validate-quick-record-token', {
          body: { token },
        });

        if (error || !data?.success) {
          setStatus('error');
          setErrorMessage(data?.error || error?.message || 'Invalid or expired token');
          return;
        }

        setStatus('authenticating');

        // Use the magic link token to authenticate
        if (data.auth_token && data.token_type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: data.auth_token,
            type: data.token_type,
          });

          if (verifyError) {
            console.error('Auth verification error:', verifyError);
            setStatus('error');
            setErrorMessage('Failed to authenticate. Please try again or use normal login.');
            return;
          }
        }

        // Redirect to meeting recorder with autoStart
        navigate('/?autoStart=true', { replace: true });
      } catch (err) {
        console.error('Quick record error:', err);
        setStatus('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    };

    validateAndAuthenticate();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'validating' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Validating Token</h2>
                <p className="text-muted-foreground mt-1">Please wait...</p>
              </div>
            </div>
          )}

          {status === 'authenticating' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <Mic className="h-12 w-12 text-primary" />
                <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Starting Recording</h2>
                <p className="text-muted-foreground mt-1">Preparing your meeting recorder...</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h2 className="text-xl font-semibold">Access Denied</h2>
                <p className="text-muted-foreground mt-1">{errorMessage}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  Go to Login
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickRecord;
