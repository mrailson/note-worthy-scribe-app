import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Send, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

const RATE_LIMIT_STORAGE_KEY = "magic_link_rate_limit_expires";

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

  // Check localStorage for existing rate limit on mount
  useEffect(() => {
    const storedExpiry = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      const now = Date.now();
      if (expiryTime > now) {
        const remainingSeconds = Math.ceil((expiryTime - now) / 1000);
        setRateLimited(true);
        setWaitSeconds(remainingSeconds);
      } else {
        // Expired, clear it
        localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
      }
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (waitSeconds > 0) {
      const timer = setInterval(() => {
        setWaitSeconds((prev) => {
          if (prev <= 1) {
            setRateLimited(false);
            localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
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
        
        // Check if this is a FunctionsHttpError (non-2xx response)
        if (error instanceof FunctionsHttpError) {
          try {
            // Clone the response before reading to avoid stream consumption issues
            const response = error.context;
            const errorData = await response.json();
            console.log("Edge function error response:", errorData);
            
            if (errorData?.rate_limited) {
              const seconds = errorData.wait_seconds || 300;
              const expiryTime = Date.now() + (seconds * 1000);
              localStorage.setItem(RATE_LIMIT_STORAGE_KEY, expiryTime.toString());
              setRateLimited(true);
              setWaitSeconds(seconds);
              setLoading(false); // Ensure loading is cleared before return
              toast({
                title: "Too Many Requests",
                description: `Please wait ${formatWaitTime(seconds)} before requesting another magic link.`,
                variant: "destructive"
              });
              return;
            }
            
            // Show the specific error message from the function
            setLoading(false);
            toast({
              title: "Error",
              description: errorData?.error || "Failed to send magic link. Please try again.",
              variant: "destructive"
            });
            return;
          } catch (parseErr) {
            console.log("Could not parse error response:", parseErr);
          }
        }

        // Fallback for other error types
        setLoading(false);
        toast({
          title: "Error",
          description: error.message || "Failed to send magic link. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Check for rate limiting response (successful response with rate_limited flag)
      if (data?.rate_limited) {
        const seconds = data.wait_seconds || 300;
        const expiryTime = Date.now() + (seconds * 1000);
        localStorage.setItem(RATE_LIMIT_STORAGE_KEY, expiryTime.toString());
        setRateLimited(true);
        setWaitSeconds(seconds);
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
          title: "Request Received",
          description: "If your email is registered, you'll receive a login link shortly.",
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
        const expiryTime = Date.now() + (300 * 1000);
        localStorage.setItem(RATE_LIMIT_STORAGE_KEY, expiryTime.toString());
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
                If your email is registered, you'll receive a login link shortly.
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