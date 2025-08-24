import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, FileText, CheckCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface MicroBannerProps {
  className?: string;
}

export const MicroBanner: React.FC<MicroBannerProps> = ({ className }) => (
  <div className={`bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 ${className}`}>
    <div className="flex items-center space-x-2">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span>
        <strong>Clinical decision-support only.</strong> Do not rely on this output in isolation. Use your own clinical judgement and local policies; check original sources before acting.
      </span>
    </div>
  </div>
);

interface ShortCardProps {
  className?: string;
}

export const ShortCard: React.FC<ShortCardProps> = ({ className }) => (
  <Card className={`border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30 ${className}`}>
    <CardContent className="p-4">
      <div className="flex items-start space-x-3">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-2">
            Disclaimer
          </p>
          <p className="mb-2">
            This service provides NHS primary-care decision-support (NICE, BNF, MHRA, NHS.uk, local ICB). 
            Outputs may be incomplete or inaccurate. You remain responsible for all clinical decisions, 
            prescribing and documentation. Verify against the cited source material and your local 
            formulary before acting.
          </p>
          <p>
            GP Portal: <a 
              href="https://www.icnorthamptonshire.org.uk/primarycareportal/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Northamptonshire ICB Primary Care Portal
            </a>
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

interface FullModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDoNotShowAgain: () => void;
}

export const FullModal: React.FC<FullModalProps> = ({ 
  open, 
  onOpenChange, 
  onAccept, 
  onDoNotShowAgain 
}) => {
  const [doNotShow, setDoNotShow] = React.useState(false);

  const handleAccept = () => {
    if (doNotShow) {
      onDoNotShowAgain();
    }
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>AI4GP Clinical Decision Support - Terms of Use</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 text-sm pr-2">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
              Clinical decision-support, not a substitute for professional judgement.
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Check original sources (NICE/BNF/MHRA/NHS.uk/local ICB) before prescribing or advising.</p>
            </div>
            
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Consider patient-specific factors: diagnosis, comorbidities, pregnancy/breastfeeding, allergies, renal/hepatic function, interactions and local formulary restrictions.</p>
            </div>
            
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Do not use this tool as the sole basis for urgent, emergency or time-critical decisions; follow local emergency pathways.</p>
            </div>
            
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>You are responsible for the care you provide, your records, and any actions taken.</p>
            </div>
            
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>If real patient data are entered, you must have organisational approval (DPIA/DSA) and follow IG policies.</p>
            </div>
            
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Report any safety concerns via your local incident reporting process (e.g., Datix).</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              By continuing, you confirm you understand and accept these conditions.
            </p>
          </div>
        </div>
        
        <div className="flex-shrink-0 space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="do-not-show" 
              checked={doNotShow}
              onCheckedChange={(checked) => setDoNotShow(checked === true)}
            />
            <label 
              htmlFor="do-not-show" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Do not show this again
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAccept}>
              I Understand and Accept
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const getAuditLine = () => {
  return "Clinical decision-support (AI 4 GP) consulted; advice cross-checked with NICE/BNF/local guidance. Management/prescribing decision made by clinician.";
};