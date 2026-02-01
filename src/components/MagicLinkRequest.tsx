import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Send, Clock } from "lucide-react";
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
  const [rateLimited, setRateLimited] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const { toast } = useToast();

  // Countdown timer effect
  useEffect(() => {
    if (waitSeconds > 0) {
      const timer = setInterval(() => {
        setWaitSeconds((prev) => {
          if (prev <= 1) {
            setRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [waitSeconds]);

  const formatWaitTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs} seconds`;
  }, []);

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

    if (rateLimited) {
      toast({
        title: "Please Wait",
        description: `You can request another magic link in ${formatWaitTime(waitSeconds)}.`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Use our custom edge function to generate magic link and send via EmailJS
      const { data, error } = await supabase.functions.invoke('generate-magic-link', {
        body: { email: email }
      });

      if (error) {
        console.error("Error invoking generate-magic-link:", error);
        
        // Check if this is a rate limit error by examining the error context
        // The Supabase client includes the response in the error context for FunctionsHttpError
        try {
          // Try to get the response body from the error context
          const errorContext = (error as any).context;
          if (errorContext) {
            // Parse the response if it contains rate limit info
            const responseText = await errorContext.text?.() || errorContext.body;
            if (responseText) {
              const parsedError = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
              if (parsedError?.rate_limited) {
                setRateLimited(true);
                setWaitSeconds(parsedError.wait_seconds || 300);
                toast({
                  title: "Too Many Requests",
                  description: `Please wait ${formatWaitTime(parsedError.wait_seconds || 300)} before requesting another magic link.`,
                  variant: "destructive"
                });
                return;
              }
            }
          }
        } catch (parseErr) {
          console.log("Could not parse error context:", parseErr);
        }

        // Check if error message contains rate limit info
        if (error.message?.includes("429") || error.message?.includes("Too many")) {
          setRateLimited(true);
          setWaitSeconds(300); // Default 5 minutes
          toast({
            title: "Too Many Requests",
            description: "Please wait 5 minutes before requesting another magic link.",
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Error",
          description: error.message || "Failed to send magic link. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Check for rate limiting response (successful response with rate_limited flag)
      if (data?.rate_limited) {
        setRateLimited(true);
        setWaitSeconds(data.wait_seconds || 300);
        toast({
          title: "Too Many Requests",
          description: `Please wait ${formatWaitTime(data.wait_seconds || 300)} before requesting another magic link.`,
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        setSubmitted(true);
        toast({
          title: "Magic Link Sent!",
          description: "Check your email for a secure login link that expires in 60 minutes.",
        });
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to send magic link. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error sending magic link:", error);
      
      // Final fallback - check if this might be a rate limit error
      if (error.message?.includes("429") || error.message?.includes("rate") || error.message?.includes("Too many")) {
        setRateLimited(true);
        setWaitSeconds(300);
        toast({
          title: "Too Many Requests",
          description: "Please wait 5 minutes before requesting another magic link.",
          variant: "destructive"
        });
        return;
      }
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
              <p className="font-bold text-foreground">• The email will appear from Notewell AI Login Service - please check your junk folder if it hasn't arrived in the next two minutes</p>
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
          <div className="text-sm text-muted-foreground text-center">
            Enter your NHS email address and we'll send you a secure magic link to sign in instantly.
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
            disabled={!isValid || loading || rateLimited}
            className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle"
          >
            {loading ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                Sending Magic Link...
              </>
            ) : rateLimited ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Wait {formatWaitTime(waitSeconds)}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Secure Magic Link
              </>
            )}
          </Button>

          {rateLimited && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-center">
              <p className="text-sm text-destructive font-medium">
                Too many requests. Please wait {formatWaitTime(waitSeconds)} before trying again.
              </p>
            </div>
          )}

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