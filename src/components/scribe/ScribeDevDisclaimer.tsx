import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScribeDevDisclaimerProps {
  className?: string;
}

export const ScribeDevDisclaimer: React.FC<ScribeDevDisclaimerProps> = ({ className }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <Card className={`border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 ${className}`}>
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ DEVELOPMENT SYSTEM – FOR EVALUATION ONLY
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1 text-xs">
                  Notewell AI is registered with the MHRA as a Class I medical device. <strong>This version is a development build</strong> for controlled testing and evaluation only.
                </p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-4 text-xs text-amber-800 dark:text-amber-200">
            {/* Critical Warnings */}
            <div className="border-t border-amber-300 dark:border-amber-700 pt-3">
              <p className="font-semibold mb-2">⚠️ Critical Warnings</p>
              <div className="space-y-2 pl-4">
                <p>
                  <strong>AI LIMITATIONS</strong> – This system may <strong>hallucinate</strong> or <strong>misrepresent</strong> information. Outputs may be inaccurate, incomplete, or clinically inappropriate. No output should be trusted without independent verification.
                </p>
                <p>
                  <strong>DATA RELIABILITY</strong> – All outputs are for evaluation purposes only and <strong>cannot be relied upon</strong> for clinical decision-making.
                </p>
              </div>
            </div>

            {/* Tester Responsibilities */}
            <div className="border-t border-amber-300 dark:border-amber-700 pt-3">
              <p className="font-semibold mb-2">Tester Responsibilities</p>
              <p className="mb-2">By accessing this system, you acknowledge that:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>You will only use this system with patients who have given <strong>full, explicit, informed consent</strong> to participate in concept testing, understanding that AI may generate errors or fabrications</li>
                <li>You will <strong>not</strong> rely on any output for clinical decision-making</li>
                <li>You will <strong>not</strong> copy outputs into clinical records without full independent verification</li>
                <li>You will report all errors and issues to the development team</li>
              </ol>
            </div>

            {/* Footer */}
            <div className="border-t border-amber-300 dark:border-amber-700 pt-3 text-center">
              <p className="font-medium">
                If uncertain whether your intended use is appropriate, contact the development team.
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2">
                Development Build | © PCN Services Ltd
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
