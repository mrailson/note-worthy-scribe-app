import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MagicLinkRequestProps {
  onBackToLogin: () => void;
}

export const MagicLinkRequest = ({ onBackToLogin }: MagicLinkRequestProps) => {
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const validateEmail = (email: string) => {
    const validDomains = ['@nhs.net', '@nhs.uk', '@nhft.nhs.uk'];
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasValidDomain = validDomains.some(domain => email.toLowerCase().includes(domain));
    
    // Special exception for specific Gmail address
    const isSpecialException = email.toLowerCase() === 'egplearning@gmail.com';
    
    const isValid = isValidFormat && (hasValidDomain || isSpecialException);
    setIsValid(isValid);
    return isValid;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    validateEmail(newEmail);
  };

  const handleSendMagicLink = async () => {
    if (!validateEmail(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid NHS email address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Use Supabase's built-in magic link system which includes the actual working magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: "https://notewell.dialai.co.uk/",
          shouldCreateUser: false // Only allow existing users to use magic links
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setSubmitted(true);
        toast({
          title: "Magic Link Sent!",
          description: "Check your email for a secure login link that expires in 60 minutes.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send magic link. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="w-full shadow-strong">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            Magic Link Sent
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="text-center space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-md p-4">
              <Mail className="h-12 w-12 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                We've sent a secure login link to:
              </p>
              <p className="font-medium break-all">{email}</p>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Click the link in your email to log in securely</p>
              <p>• The link expires in 60 minutes for security</p>
              <p>• No VPN required - works from any network</p>
              <p>• Check your spam folder if you don't see it</p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Another Link
              </Button>
              
              <Button
                onClick={onBackToLogin}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-strong">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-primary">
          <Mail className="h-5 w-5" />
          Secure Magic Link
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
            <p className="font-medium text-blue-900 mb-1">VPN Alternative Login</p>
            <p className="text-blue-700">
              Having trouble with your corporate VPN? Request a secure magic link that bypasses network restrictions.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="magic-link-email">NHS Email Address</Label>
            <Input
              id="magic-link-email"
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
              <p className="text-xs text-destructive">
                Please use a valid NHS email address (@nhs.net or @nhs.uk)
              </p>
            )}
          </div>

          <Button 
            onClick={handleSendMagicLink}
            disabled={!isValid || loading}
            className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle"
          >
            {loading ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                Sending Magic Link...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Secure Magic Link
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Link expires in 60 minutes</p>
            <p>• Works from any network (bypasses VPN issues)</p>
            <p>• Only for existing registered users</p>
          </div>

          <div className="text-center">
            <Button
              onClick={onBackToLogin}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary-hover"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};