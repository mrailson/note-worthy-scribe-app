import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSecurityValidation } from "@/hooks/useSecurityValidation";
import { ForgotPassword } from "./ForgotPassword";
import { MagicLinkRequest } from "./MagicLinkRequest";
import { ServiceOverview } from "./ServiceOverview";

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    // Rate limiting check
    if (!checkRateLimit(`login_${email}`)) {
      return;
    }
    
    // Security validation
    if (!validateNHSEmail(email) || !password) return;
    
    if (!validateInput(password, 'login_password')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    
    if (error) {
      setError("Invalid email or password. Please check your credentials and try again.");
    }
    
    setLoading(false);
  };



  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Service Overview - Takes up 2/3 of the screen on large devices */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <ServiceOverview />
          </div>
          
          {/* Login Form - Takes up 1/3 of the screen on large devices */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-8">
            <Card className="w-full shadow-strong">
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
                          // Clear error when user starts typing
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

                  {/* Error Message Display */}
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

                  <div className="text-center space-y-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-primary hover:text-primary-hover text-sm"
                    >
                      Forgot your password?
                    </Button>
                    
                    <div className="text-xs text-muted-foreground">or</div>
                    
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowMagicLink(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      eMail me a login link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};