import React from 'react';
import { FileText, Plus, Sparkles, Shield, Award, CheckCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const CallToActionSlide = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col justify-center space-y-8 p-8">
      <div className="text-center animate-fade-in">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Ready to Transform Your Complaints Management?
        </h1>
        <p className="text-2xl text-muted-foreground max-w-3xl mx-auto">
          Join NHS practices already using our system to handle complex, AI-generated complaints 
          with confidence and full regulatory compliance
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="text-center p-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Operational Excellence</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Reduce handling time by up to 70%</li>
            <li>• Consistent, professional responses</li>
            <li>• Automatic deadline tracking</li>
            <li>• Complete audit trails</li>
          </ul>
        </div>

        <div className="text-center p-6">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-secondary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Regulatory Compliance</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li>• NHS complaints procedure compliance</li>
            <li>• CQC inspection-ready documentation</li>
            <li>• Demonstrated learning & improvement</li>
            <li>• Risk management & trend analysis</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <div className="px-6 py-2 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Efficiency</span>
        </div>
        <div className="px-6 py-2 rounded-full bg-secondary/10 text-secondary font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>NHS Protocol Compliant</span>
        </div>
        <div className="px-6 py-2 rounded-full bg-accent/10 text-accent font-medium flex items-center gap-2">
          <Award className="w-4 h-4" />
          <span>CQC Ready Reporting</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <Button 
          onClick={() => navigate('/complaints')}
          size="lg"
          className="text-lg px-8 py-6 bg-primary hover:bg-primary/90"
        >
          <FileText className="h-6 w-6 mr-2" />
          Start Managing Complaints
        </Button>
        <Button 
          onClick={() => navigate('/complaints?tab=new')}
          variant="outline"
          size="lg"
          className="text-lg px-8 py-6"
        >
          <Plus className="h-6 w-6 mr-2" />
          Create New Complaint
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground pt-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
        Click either button to enter the live demonstration
      </p>
    </div>
  );
};
