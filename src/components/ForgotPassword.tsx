import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export const ForgotPassword = ({ onBackToLogin }: ForgotPasswordProps) => {
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const { resetPassword } = useAuth();

  const validateEmail = (email: string) => {
    const validDomains = ['@nhs.net', '@nhs.uk', '@nhft.nhs.uk'];
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasValidDomain = validDomains.some(domain => email.toLowerCase().includes(domain));
    
    setIsValid(isValidFormat && hasValidDomain);
    return isValidFormat && hasValidDomain;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    validateEmail(newEmail);
    setError("");
  };

  const handleResetPassword = async () => {
    if (!validateEmail(email)) return;
    
    setLoading(true);
    setError("");
    
    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
    
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Card className="w-full max-w-md shadow-strong">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5 text-success" />
              Reset Email Sent
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                We've sent a password reset link to <strong>{email}</strong>. 
                Check your email and follow the instructions to reset your password.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Check your spam/junk folder if you don't see the email</p>
              <p>• The reset link will expire in 1 hour</p>
              <p>• You can request a new reset email if needed</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={onBackToLogin}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
              <Button 
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                  setIsValid(false);
                }}
                variant="secondary"
                className="flex-1"
              >
                Send Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[500px] flex items-center justify-center">
      <Card className="w-full max-w-md shadow-strong">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            Reset Password
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              Enter your NHS email address and we'll send you a link to reset your password.
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your.name@nhs.net"
                value={email}
                onChange={handleEmailChange}
                className={`transition-colors ${
                  email && !isValid 
                    ? 'border-destructive focus:border-destructive' 
                    : email && isValid 
                    ? 'border-success focus:border-success'
                    : ''
                }`}
              />
              {email && !isValid && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="destructive" className="text-xs">
                    Please use an NHS email address
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={onBackToLogin}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
              <Button 
                onClick={handleResetPassword}
                disabled={!isValid || loading}
                className="flex-1 bg-gradient-primary hover:bg-primary-hover shadow-subtle disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};