import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, EyeOff, HelpCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSecurityValidation } from "@/hooks/useSecurityValidation";
import { ForgotPassword } from "./ForgotPassword";
import { MagicLinkRequest } from "./MagicLinkRequest";
import { VpnTroubleshootingGuide } from "./VpnTroubleshootingGuide";

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVpnGuide, setShowVpnGuide] = useState(false);
  const [loginError, setLoginError] = useState<any>(null);
  const { signIn } = useAuth();
  const { validateInput, validateEmail, checkRateLimit } = useSecurityValidation();

  if (showForgotPassword) {
    return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;
  }

  if (showMagicLink) {
    return <MagicLinkRequest onBackToLogin={() => setShowMagicLink(false)} />;
  }

  const validateNHSEmail = (email: string) => {
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
    validateNHSEmail(newEmail);
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleLogin = async () => {
    // Rate limiting check with VPN awareness
    const userAgent = navigator.userAgent;
    if (!checkRateLimit(`login_${email}`, userAgent)) {
      return;
    }
    
    // Security validation
    if (!validateNHSEmail(email) || !password) return;
    
    if (!validateInput(password, 'login_password')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setLoginError(null);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        const errorMessage = error.message || "Invalid email or password. Please check your credentials and try again.";
        setError(errorMessage);
        setLoginError(error);
        
        // Automatically show VPN guide for VPN-related errors or network issues
        const isVpnRelated = error.isVpnRelated || 
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('corporate');
          
        if (isVpnRelated) {
          // Delay showing guide slightly to let error message display first
          setTimeout(() => setShowVpnGuide(true), 1500);
        }
        
        // Log VPN-related errors for monitoring
        if (error.isVpnRelated) {
          console.log('VPN-related login error detected:', error.diagnostic);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred during login.";
      setError(errorMessage);
      setLoginError(error);
    } finally {
      setLoading(false);
    }
  };



  return (
    <Card className="w-full max-w-md mx-auto shadow-xl mobile-container animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-primary">
          <Mail className="h-5 w-5" />
          NHS Staff Access
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email Address</Label>
            <Input
              id="signin-email"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <div className="relative">
              <Input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
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

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button 
            onClick={handleLogin}
            disabled={!isValid || !password || loading}
            className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>

          {/* Password Help Section */}
          <div className="border-t border-border pt-4 mt-2 space-y-3">
            <div className="bg-accent/50 rounded-lg p-4 border border-accent">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Don't know your password?</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                New user or forgotten your password? Request secure access via a time-limited magic link sent to your NHS email.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMagicLink(true)}
                className="w-full border-primary/30 hover:bg-primary/10 hover:border-primary"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Me a Magic Link
              </Button>
            </div>
            
            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowForgotPassword(true)}
                className="text-muted-foreground hover:text-primary text-xs"
              >
                Or Forgotten Password/Reset Password
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};