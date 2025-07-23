import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();

  // Handle password reset from email link
  useEffect(() => {
    const handlePasswordResetFromUrl = async () => {
      // Check if we have hash parameters (for password reset)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        try {
          // Set the session using the tokens from the email link
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Error setting session:', error);
            setError('Invalid or expired reset link. Please request a new one.');
          } else {
            // Clear the URL hash after successful session setup
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Error processing reset link:', err);
          setError('Error processing reset link. Please try again.');
        }
      } else if (!session && !accessToken) {
        // If no recovery params and no session, redirect to login
        navigate('/?error=invalid-reset-link');
      }
      
      setValidatingSession(false);
    };

    handlePasswordResetFromUrl();
  }, [session, navigate]);

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handlePasswordUpdate = async () => {
    if (!validatePassword(newPassword)) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError("");
    
    const { error } = await updatePassword(newPassword);
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      // Redirect to home page after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-strong">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5 text-success" />
              Password Updated
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your password has been successfully updated. You'll be redirected to the login page shortly.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={() => navigate('/')}
              className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validatingSession) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-strong">
          <CardContent className="text-center py-8">
            <div className="text-muted-foreground">Validating reset link...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-strong">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-primary">
            <Lock className="h-5 w-5" />
            Set New Password
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              Please enter your new password below.
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={
                    newPassword && !validatePassword(newPassword)
                      ? 'border-destructive focus:border-destructive'
                      : newPassword && validatePassword(newPassword)
                      ? 'border-success focus:border-success'
                      : ''
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={
                    confirmPassword && newPassword !== confirmPassword
                      ? 'border-destructive focus:border-destructive'
                      : confirmPassword && newPassword === confirmPassword && confirmPassword.length > 0
                      ? 'border-success focus:border-success'
                      : ''
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Password requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li className={validatePassword(newPassword) ? 'text-success' : ''}>
                  At least 8 characters long
                </li>
                <li className={newPassword === confirmPassword && confirmPassword.length > 0 ? 'text-success' : ''}>
                  Passwords must match
                </li>
              </ul>
            </div>

            <Button 
              onClick={handlePasswordUpdate}
              disabled={!validatePassword(newPassword) || newPassword !== confirmPassword || loading}
              className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle disabled:opacity-50"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};