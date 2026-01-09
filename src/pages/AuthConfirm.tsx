import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, Shield } from 'lucide-react';

/**
 * AuthConfirm page - prevents email security scanners from consuming magic link tokens
 * 
 * Flow:
 * 1. Magic link email contains link to /auth-confirm?token_hash=...&type=magiclink
 * 2. User clicks "Sign In" button on this page
 * 3. Page redirects to Supabase /auth/v1/verify with the token
 * 4. Supabase verifies and redirects to the final destination
 */
export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(false);

  // Extract all the params from the magic link
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') || 'magiclink';
  const redirectTo = searchParams.get('redirect_to') || 'https://gpnotewell.co.uk/';

  // Construct the Supabase verify URL
  const supabaseUrl = 'https://dphcnbricafkbtizkoal.supabase.co';
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token_hash=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;

  const handleSignIn = () => {
    setIsRedirecting(true);
    // Small delay to show loading state
    setTimeout(() => {
      window.location.href = verifyUrl;
    }, 300);
  };

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

          {autoRedirect && (
            <p className="text-xs text-amber-600 text-center">
              Link will expire soon. Please click the button above to sign in.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}