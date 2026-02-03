import React, { useState } from 'react';
import { ArrowLeft, Pill, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TopPrescribedDrugs } from './TopPrescribedDrugs';
import { BNFTypeaheadSearch } from './BNFTypeaheadSearch';
import { BNFDrugDetailPage } from './BNFDrugDetailPage';
import { TLVocabItem } from '@/hooks/useTrafficLightVocab';

interface BNFQuickLookupPanelProps {
  onBack: () => void;
  onInsertToChat?: (text: string) => void;
}

type ViewState = 
  | { type: 'search' }
  | { type: 'detail'; drugName: string; trafficLightItem?: TLVocabItem };

export const BNFQuickLookupPanel: React.FC<BNFQuickLookupPanelProps> = ({ 
  onBack,
  onInsertToChat,
}) => {
  const [view, setView] = useState<ViewState>({ type: 'search' });

  const handleDrugSelect = (drugName: string, trafficLightItem?: TLVocabItem) => {
    setView({ type: 'detail', drugName, trafficLightItem });
  };

  const handleBackToSearch = () => {
    setView({ type: 'search' });
  };

  if (view.type === 'detail') {
    return (
      <BNFDrugDetailPage
        drugName={view.drugName}
        trafficLightItem={view.trafficLightItem}
        onBack={handleBackToSearch}
        onInsertToChat={onInsertToChat}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-gradient-to-br from-green-500 to-green-600"
          )}>
            <Pill className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">BNF Quick Lookup</h1>
            <p className="text-xs text-muted-foreground">Comprehensive drug reference</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Safety notice */}
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>NHS Clinical Reference:</strong> Information is AI-generated from BNF guidelines. 
            Always verify with the official BNF before prescribing. Use clinical judgement.
          </AlertDescription>
        </Alert>

        {/* Top 10 NHS Prescribed */}
        <TopPrescribedDrugs onDrugSelect={handleDrugSelect} />

        <Separator />

        {/* Search */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Search All Drugs</h3>
          <BNFTypeaheadSearch onDrugSelect={handleDrugSelect} />
          <p className="text-xs text-muted-foreground">
            Type at least 2 characters to search all 261 Northants ICB Traffic Light drugs
          </p>
        </div>

        {/* Quick tips */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground">Northants ICB Traffic Light</h4>
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-sm bg-popover text-popover-foreground border shadow-md">
                  <p className="font-medium mb-1">Northamptonshire ICB Traffic Light System</p>
                  <p className="text-muted-foreground">Data sourced from the Northamptonshire Integrated Care Board (ICB) prescribing formulary. Updated regularly by the Medicines Optimisation Team.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#C62828] shrink-0"></span>
                <span>DOUBLE RED</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Hospital-only. Do not prescribe in primary care. Follow specialist pathway. Prior Approval/IFR may be required.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#E53935] shrink-0"></span>
                <span>RED</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Specialist service only. Do not initiate in primary care. Often Blueteq prior approval applies.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF6C00] shrink-0"></span>
                <span>AMBER</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Shared-care required. Ensure SCP in place and monitoring responsibilities agreed before transfer.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2E7D32] shrink-0"></span>
                <span>GREEN</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Suitable for primary-care prescribing per local formulary. GP can prescribe.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#6A1B9A] shrink-0"></span>
                <span>SPECIALIST</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Continue only after specialist start and when responsibilities are agreed. Do not initiate in primary care.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#546E7A] shrink-0"></span>
                <span>GREY</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p>Not routinely commissioned / not assessed. Check with Medicines Optimisation.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* External links */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Official Resources</h4>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://bnf.nice.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              BNF Online →
            </a>
            <a
              href="https://www.nice.org.uk/guidance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              NICE Guidelines →
            </a>
            <a
              href="https://www.icnorthamptonshire.org.uk/trafficlightdrugs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Northants ICB Traffic Light →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
