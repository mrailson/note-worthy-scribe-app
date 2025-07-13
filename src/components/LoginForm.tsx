import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoginFormProps {
  onLogin: (email: string) => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();

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
  };

  const handleLogin = () => {
    if (validateEmail(email)) {
      onLogin(email);
      toast({
        title: "Login Successful",
        description: "Welcome to Notewell AI Meeting Notes Service",
      });
    } else {
      toast({
        title: "Invalid Email",
        description: "Please use a valid NHS email address",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Card className="w-full max-w-md shadow-strong">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            NHS Staff Login
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.name@nhs.net or name@nhft.nhs.uk"
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
            <p className="text-sm text-muted-foreground">
              Please use a valid @nhs.net, @nhs.uk, or @nhft.nhs.uk email address
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
            <Lightbulb className="h-4 w-4 text-warning mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your email will be remembered for next time
            </p>
          </div>

          <Button 
            onClick={handleLogin}
            disabled={!isValid}
            className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle disabled:opacity-50"
          >
            Login
          </Button>

          {/* Valid domains display */}
          <div className="flex flex-wrap gap-1 justify-center">
            <Badge variant="outline" className="text-xs">@nhs.net</Badge>
            <Badge variant="outline" className="text-xs">@nhs.uk</Badge>
            <Badge variant="outline" className="text-xs">@nhft.nhs.uk</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};