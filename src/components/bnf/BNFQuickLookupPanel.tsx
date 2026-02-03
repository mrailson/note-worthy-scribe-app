import React, { useState } from 'react';
import { ArrowLeft, Pill, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
            Type at least 2 characters to search 500+ drugs with traffic light status
          </p>
        </div>

        {/* Quick tips */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Traffic Light Guide</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span>GREEN - GP can prescribe</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span>AMBER - Shared care</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span>RED - Hospital only</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span>
              <span>SPECIALIST - Initiated by specialist</span>
            </div>
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
              ICB Traffic Light →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
