import React from 'react';
import { Award, Shield, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CQC_STANDARDS = [
  "Person-centred care", "Dignity and respect", "Consent",
  "Safety", "Safeguarding", "Food and drink",
  "Premises and equipment", "Complaints", "Good governance",
  "Staffing", "Fit and proper persons", "Registered manager",
  "Need for registration", "Display of ratings", "Notifications"
];

export const CQCStandardsSlide = () => {
  return (
    <div className="h-full flex flex-col justify-center space-y-8 p-8">
      <div className="text-center mb-4 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Award className="w-12 h-12 text-orange-600 dark:text-orange-400" />
          <h1 className="text-5xl font-bold text-foreground">CQC 15 Fundamental Standards</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Every complaint is automatically analysed against all 15 CQC fundamental standards, 
          ensuring comprehensive compliance reporting for inspections
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3 max-w-6xl mx-auto w-full">
        {CQC_STANDARDS.map((standard, index) => (
          <div
            key={index}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <Badge 
              variant="outline" 
              className="w-full h-full p-4 text-sm font-medium border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 hover:border-orange-400 dark:hover:border-orange-600 transition-colors flex flex-col items-center justify-center text-center gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <span className="text-orange-600 dark:text-orange-400 font-bold text-xs">{index + 1}</span>
              </div>
              <span className="text-foreground leading-tight">{standard}</span>
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full pt-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">Automatic Mapping</h3>
          <p className="text-sm text-muted-foreground">
            Every complaint mapped to relevant standards
          </p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-secondary" />
          </div>
          <h3 className="font-semibold mb-1">Comprehensive Coverage</h3>
          <p className="text-sm text-muted-foreground">
            All 15 standards tracked and reported
          </p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <Award className="w-6 h-6 text-accent" />
          </div>
          <h3 className="font-semibold mb-1">Inspection Ready</h3>
          <p className="text-sm text-muted-foreground">
            Complete compliance documentation
          </p>
        </div>
      </div>
    </div>
  );
};
