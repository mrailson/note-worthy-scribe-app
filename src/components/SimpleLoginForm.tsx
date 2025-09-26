import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Eye, EyeOff, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { VpnTroubleshootingGuide } from "./VpnTroubleshootingGuide";
import { NetworkDiagnostics } from "./NetworkDiagnostics";

export const SimpleLoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showVpnGuide, setShowVpnGuide] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [loginError, setLoginError] = useState<any>(null);
  
  const { signIn } = useAuth();

  const validateNHSEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nhsDomains = ['nhs.net', 'nhs.uk'];
    
    if (!emailRegex.test(email)) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return nhsDomains.includes(domain);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValid(validateNHSEmail(newEmail));
    setError('');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!isValid) {
      setError('Please use a valid NHS email address (@nhs.net or @nhs.uk)');
      return;
    }

    setLoading(true);
    setError('');
    setLoginError(null);

    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        let errorMessage = signInError.message || 'Login failed';
        setLoginError(signInError);
        
        // Check for VPN-related issues and make error more explicit
        const isVpnRelated = signInError.isVpnRelated || 
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('connection') ||
          errorMessage.toLowerCase().includes('fetch') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('cors') ||
          errorMessage.toLowerCase().includes('blocked') ||
          errorMessage.toLowerCase().includes('corporate');
          
        if (isVpnRelated) {
          // Make VPN-related errors more explicit for IT troubleshooting
          errorMessage = `🔒 VPN/Network Issue Detected: ${errorMessage}. If you're using a corporate VPN, try turning it off temporarily. Click "VPN Help" below for more details.`;
          setTimeout(() => setShowVpnGuide(true), 1000);
        }
        
        setError(errorMessage);
      }
    } catch (error: any) {
      let errorMessage = error.message || 'An unexpected error occurred';
      setLoginError(error);
      
      // Check for VPN issues in catch block as well
      const isVpnRelated = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('cors') ||
        errorMessage.toLowerCase().includes('blocked');
        
      if (isVpnRelated) {
        errorMessage = `🔒 Network/VPN Issue: ${errorMessage}. Try disabling your VPN temporarily and retry login.`;
        setTimeout(() => setShowVpnGuide(true), 1000);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
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
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleLogin}
            disabled={loading || !email || !password || !isValid}
            className="w-full"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

          <div className="text-center space-y-2">
            <Link 
              to="/reset-password" 
              className="text-sm text-primary hover:underline"
            >
              Forgot your password?
            </Link>
            
            {/* VPN Help and Diagnostics Buttons */}
            <div className="pt-2 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVpnGuide(true)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <HelpCircle className="h-3 w-3" />
                Having trouble logging in? (VPN Help)
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiagnostics(true)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <HelpCircle className="h-3 w-3" />
                Run Network Diagnostics (For IT)
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* VPN Troubleshooting Guide */}
      <VpnTroubleshootingGuide 
        isVisible={showVpnGuide}
        onClose={() => setShowVpnGuide(false)}
        loginError={loginError}
      />
      
      {/* Network Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Network Diagnostics</h2>
                <Button variant="outline" onClick={() => setShowDiagnostics(false)}>
                  Close
                </Button>
              </div>
              <NetworkDiagnostics />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};