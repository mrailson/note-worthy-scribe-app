import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * AuthConfirm page - prevents email security scanners from consuming magic link tokens
 * 
 * Flow:
 * 1. Magic link email contains link to /auth-confirm?token_hash=...&type=magiclink
 * 2. User clicks "Sign In" button on this page
 * 3. Page uses Supabase client to verify the token
 * 4. On success, redirects to the final destination
 */
export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract all the params from the magic link
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') || 'magiclink';
  const redirectTo = searchParams.get('redirect_to') || 'https://gpnotewell.co.uk/';

  const handleSignIn = async () => {
    if (!tokenHash) return;
    
    setIsRedirecting(true);
    setError(null);

    try {
      // Use Supabase client to verify the OTP token
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'magiclink' | 'recovery' | 'invite' | 'email',
      });

      if (verifyError) {
        console.error('Verification error:', verifyError);
        
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // User is already logged in, redirect them
          window.location.href = redirectTo;
          return;
        }
        
        // Token was already used or expired
        if (verifyError.message.includes('token') || verifyError.message.includes('expired')) {
          setError('This sign-in link has already been used or has expired. Please request a new one.');
        } else {
          setError(verifyError.message);
        }
        setIsRedirecting(false);
        return;
      }

      if (data?.session) {
        console.log('Successfully verified, redirecting...');
        // Small delay to ensure session is stored
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 500);
      } else {
        setError('Verification succeeded but no session was created. Please try again.');
        setIsRedirecting(false);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'An unexpected error occurred');
      setIsRedirecting(false);
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Already logged in, redirect
        window.location.href = redirectTo;
      }
    };
    checkSession();
  }, [redirectTo]);

  // Check if this looks like a bot/scanner (no user interaction expected)
  useEffect(() => {
    // If no token, redirect to auth page
    if (!tokenHash) {
      navigate('/auth');
      return;
    }

    // Auto-redirect after 30 seconds if user doesn't click
    const timer = setTimeout(() => {
      setAutoRedirect(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, [tokenHash, navigate]);

  if (!tokenHash) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Confirm Sign In</CardTitle>
          <CardDescription>
            Click the button below to complete your sign in to GPNotewell
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                <p>{error}</p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-destructive underline"
                  onClick={() => navigate('/auth')}
                >
                  Go to login page
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={handleSignIn}
            disabled={isRedirecting}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing you in...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Sign In to GPNotewell
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            This extra step protects your account from email security scanners that might accidentally use your sign-in link.
          </p>

          {autoRedirect && !error && (
            <p className="text-xs text-amber-600 text-center">
              Link will expire soon. Please click the button above to sign in.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}