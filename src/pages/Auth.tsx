import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { showShadcnToast } from '@/utils/toastWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityValidation } from '@/hooks/useSecurityValidation';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { validateInput, validateEmail, checkRateLimit } = useSecurityValidation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  // Form states
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  
  const [signupForm, setSignupForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Handle magic link tokens and redirect if already logged in
  useEffect(() => {
    const handleMagicLink = async () => {
      // Check for hash parameters from magic link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      // If we have tokens from a magic link, set the session
      if (accessToken && refreshToken && type === 'magiclink') {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Magic link session error:', error);
            showShadcnToast({
              title: "Login Failed",
              description: "The magic link has expired or is invalid. Please request a new one.",
              variant: "destructive",
              section: 'security',
            });
          } else {
            // Clear the hash from URL and redirect
            window.history.replaceState(null, '', window.location.pathname);
            showShadcnToast({
              title: "Welcome!",
              description: "You have successfully logged in.",
              section: 'security',
            });
            navigate('/');
            return;
          }
        } catch (err) {
          console.error('Magic link error:', err);
        }
      }
      
      // If already logged in (and not processing magic link), redirect
      if (user) {
        navigate('/');
      }
    };
    
    handleMagicLink();
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!checkRateLimit(`login_${loginForm.email}`)) {
      return;
    }
    
    // Input validation
    if (!validateEmail(loginForm.email)) {
      return;
    }
    
    if (!validateInput(loginForm.password, 'login_password')) {
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) {
        setLoginAttempts(prev => prev + 1);
        
        // Log security event for failed login
        await supabase.functions.invoke('log-security-event', {
          body: {
            eventType: 'failed_login_attempt',
            severity: loginAttempts >= 3 ? 'high' : 'medium',
            eventDetails: {
              email: loginForm.email,
              attempts: loginAttempts + 1,
              timestamp: new Date().toISOString()
            }
          }
        });

        if (error.message.includes('Invalid login credentials')) {
          showShadcnToast({
            title: "Login Failed",
            description: "Invalid email or password. Please check your credentials and try again.",
            variant: "destructive",
            section: 'security',
          });
        } else {
          showShadcnToast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
            section: 'security',
          });
        }
      } else {
        // Reset login attempts on successful login
        setLoginAttempts(0);
        
        // Log successful login
        await supabase.functions.invoke('log-security-event', {
          body: {
            eventType: 'successful_login',
            severity: 'low',
            eventDetails: {
              email: loginForm.email,
              timestamp: new Date().toISOString()
            }
          }
        });

        showShadcnToast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
          section: 'security',
        });
        navigate('/');
      }
    } catch (error) {
      showShadcnToast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
        section: 'security',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!checkRateLimit(`signup_${signupForm.email}`)) {
      return;
    }
    
    // Input validation
    if (!validateEmail(signupForm.email)) {
      return;
    }
    
    if (!validateInput(signupForm.password, 'signup_password')) {
      return;
    }
    
    if (signupForm.password !== signupForm.confirmPassword) {
      showShadcnToast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please check and try again.",
        variant: "destructive",
        section: 'security',
      });
      return;
    }

    if (signupForm.password.length < 8) {
      showShadcnToast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.",
        variant: "destructive",
        section: 'security',
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        // Log security event for failed signup
        await supabase.functions.invoke('log-security-event', {
          body: {
            eventType: 'failed_signup_attempt',
            severity: 'medium',
            eventDetails: {
              email: signupForm.email,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }
        });

        if (error.message.includes('User already registered')) {
          showShadcnToast({
            title: "Account Exists",
            description: "An account with this email already exists. Please try logging in instead.",
            variant: "destructive",
            section: 'security',
          });
        } else {
          showShadcnToast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive",
            section: 'security',
          });
        }
      } else {
        // Log successful signup
        await supabase.functions.invoke('log-security-event', {
          body: {
            eventType: 'successful_signup',
            severity: 'low',
            eventDetails: {
              email: signupForm.email,
              timestamp: new Date().toISOString()
            }
          }
        });

        showShadcnToast({
          title: "Registration Successful!",
          description: "Please check your email for a confirmation link to complete your registration.",
          section: 'security',
        });
        // Clear the form
        setSignupForm({ email: '', password: '', confirmPassword: '' });
      }
    } catch (error) {
      showShadcnToast({
        title: "Registration Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
        section: 'security',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              NoteWell AI
            </h1>
          </div>
          <p className="text-muted-foreground">
            Secure NHS-compliant practice management platform
          </p>
        </div>

        {/* Auth Tabs */}
        <Card>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            {/* Login Tab */}
            <TabsContent value="login">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Welcome Back
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your.email@nhs.uk"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10"
                        required
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
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
            
            {/* Signup Tab */}
            <TabsContent value="signup">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Create Account
                </CardTitle>
                <CardDescription>
                  Register for secure access to NoteWell AI services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your.email@nhs.uk"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a secure password"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10"
                        required
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
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Secure • NHS-Compliant • GDPR Protected</p>
        </div>
      </div>
    </div>
  );
}