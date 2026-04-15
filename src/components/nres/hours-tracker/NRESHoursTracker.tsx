import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { BuyBackClaimsTab } from './BuyBackClaimsTab';
import { BuyBackAccessSettingsModal } from './BuyBackAccessSettingsModal';
import { ClaimsUserGuide } from './ClaimsUserGuide';
import { useNRESSystemRoles } from '@/hooks/useNRESSystemRoles';
import { useNRESBuyBackAccess } from '@/hooks/useNRESBuyBackAccess';
import { useNRESBuyBackRateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, HelpCircle } from 'lucide-react';

interface NRESHoursTrackerProps {
  hideEvidenceLibrary?: boolean;
  hideBoardLeadership?: boolean;
  customInsuranceChecklist?: Array<{ practice: string; insurances: Array<{ confirmed: boolean; amount: string; type: string }> }>;
  customInsuranceCheckedBy?: string;
  customInsuranceUpdatedDate?: string;
  neighbourhoodName?: 'NRES' | 'ENN';
  interactiveInsurance?: boolean;
}

export function NRESHoursTracker({ neighbourhoodName = 'NRES' }: NRESHoursTrackerProps = {}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const { admin, hasAccess, grantAccess, revokeByKey } = useNRESBuyBackAccess();
  const { staffRoles, settings: rateSettings, onCostMultiplier } = useNRESBuyBackRateSettings();
  const { isSuperAdmin, isManagementLead } = useNRESSystemRoles();
  const isENN = neighbourhoodName === 'ENN';
  const showSettings = !!(admin || isSuperAdmin || isManagementLead);

  return (
    <div className="space-y-4">
      {/* Claims User Guide Modal */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Claims Scheme Guide
            </DialogTitle>
          </DialogHeader>
          <ClaimsUserGuide
            neighbourhoodName={isENN ? 'ENN' : 'NRES'}
            rateSettings={rateSettings}
            onCostMultiplier={onCostMultiplier}
            staffRoles={staffRoles}
            isENN={isENN}
          />
        </DialogContent>
      </Dialog>

      {/* Buy-Back Claims */}
      <BuyBackClaimsTab
        neighbourhoodName={neighbourhoodName}
        onGuideOpen={() => setGuideOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        showSettings={showSettings}
      />

      {/* Access Settings Modal */}
      <BuyBackAccessSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        hasAccess={hasAccess}
        grantAccess={grantAccess}
        revokeByKey={revokeByKey}
      />
    </div>
  );
}
