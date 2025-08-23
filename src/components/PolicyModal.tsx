import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, AlertTriangle, CheckCircle, Clock, ShoppingCart, Info, Pill } from 'lucide-react';
import { PolicyBadge, type PolicyStatus } from './PolicyBadge';

interface PolicyModalProps {
  policyData: {
    drug: {
      name: string;
      searched_term?: string;
    };
    traffic_light: {
      status: string;
      detail_url?: string;
      last_modified?: string;
      bnf_chapter?: string;
      notes?: string;
    } | null;
    prior_approval: {
      status: string;
      criteria?: string;
      source_url?: string;
      last_updated?: string;
    } | null;
    formulary: {
      bnf_chapter?: string;
      section?: string;
      preferred: Array<{
        item_name: string;
        rank: number;
        notes?: string;
        otc?: boolean;
      }>;
      page_url: string;
      last_published?: string;
      found_exact_match: boolean;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onInsertIntoChat?: (message: string) => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  policyData,
  isOpen,
  onClose,
  onInsertIntoChat
}) => {
  if (!policyData) return null;

  const getInitiationAnswer = () => {
    const tlStatus = policyData?.traffic_light?.status;
    const paStatus = policyData?.prior_approval?.status;
    
    switch (tlStatus) {
      case 'DOUBLE_RED':
        return { text: 'Do not initiate', color: 'destructive', detail: 'Hospital-only. Follow specialist pathway. Prior Approval/IFR may be required.' };
      case 'RED':
        return { text: 'Do not initiate', color: 'destructive', detail: 'Specialist service only. Often Blueteq prior approval required.' };
      case 'SPECIALIST_INITIATED':
        return { text: 'Do not initiate', color: 'destructive', detail: 'Continue only after specialist start when responsibilities agreed.' };
      case 'SPECIALIST_RECOMMENDED':
        return { text: 'Yes - when specialist recommends', color: 'warning', detail: 'Primary care may prescribe when recommended by specialist and criteria met.' };
      case 'AMBER_2':
        return { text: 'Yes - with shared care', color: 'warning', detail: 'Shared-care required. Ensure SCP in place before transfer.' };
      case 'AMBER_1':
        return { text: 'Yes - following specialist advice', color: 'warning', detail: 'Primary care prescribing following specialist advice.' };
      case 'GREEN':
        return { text: 'Yes', color: 'success', detail: 'Suitable for primary-care prescribing per local formulary.' };
      case 'GREY':
        return { text: 'Check with Medicines Optimisation', color: 'secondary', detail: 'Not routinely commissioned or not assessed.' };
      case 'UNKNOWN':
      default:
        return { text: 'Check ICB site / Medicines Optimisation', color: 'secondary', detail: 'Local status not found. Verify on ICB site.' };
    }
  };

  const initiationAnswer = getInitiationAnswer();

  const generateChatMessage = () => {
    const drug = policyData?.drug;
    const tlData = policyData?.traffic_light;
    const formulary = policyData?.formulary;
    
    if (!drug) return '';
    
    let message = `**${drug.name}**\n\n`;
    
    // GP initiation status
    message += `**Can GP initiate?** ${initiationAnswer.text}\n\n`;
    
    // Traffic light status
    if (tlData) {
      message += `**Traffic Light:** ${tlData.status}`;
      if (tlData.bnf_chapter) {
        message += ` (${tlData.bnf_chapter})`;
      }
      message += '\n';
    }
    
    // Prior approval
    if (policyData?.prior_approval) {
      message += `**Prior Approval:** ${policyData.prior_approval.status}\n`;
    }
    
    // Formulary information
    if (formulary && formulary.preferred?.length > 0) {
      message += `\n**Local Formulary (${formulary.bnf_chapter || 'ICN'}):**\n`;
      if (formulary.section) {
        message += `*Section: ${formulary.section}*\n`;
      }
      
      const preferredItems = formulary.preferred.slice(0, 3);
      preferredItems.forEach((item, index) => {
        message += `${index + 1}. ${item.item_name}`;
        if (item.notes) message += ` (${item.notes})`;
        if (item.otc) message += ` [OTC]`;
        message += '\n';
      });
      
      if (formulary.last_published) {
        message += `\n*Last updated: ${formulary.last_published}*\n`;
      }
    }
    
    // Links
    if (tlData?.detail_url) {
      message += `\n[Traffic Light Details](${tlData.detail_url})`;
    }
    if (formulary?.page_url) {
      message += `\n[ICN Formulary](${formulary.page_url})`;
    }
    
    return message;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            {policyData?.drug?.name || 'Medicine Information'}
            {policyData?.traffic_light && (
              <PolicyBadge 
                status={policyData.traffic_light.status as PolicyStatus} 
                className="ml-2"
              />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Can GP Initiate - Main Question */}
          <div className={`p-4 rounded-lg border-2 ${
            initiationAnswer.color === 'destructive' 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : initiationAnswer.color === 'warning'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              : 'bg-muted/50 border-dashed'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold">Can GP initiate?</h3>
            </div>
            <Badge 
              variant={
                initiationAnswer.color === 'success' ? 'default' : 
                initiationAnswer.color === 'warning' ? 'secondary' : 
                'destructive'
              }
              className="text-sm px-3 py-1 mb-2"
            >
              {initiationAnswer.text}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {initiationAnswer.detail}
            </p>
          </div>

          {/* Traffic Light Information */}
          {policyData?.traffic_light && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-semibold">Traffic Light Status</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PolicyBadge status={policyData.traffic_light.status as PolicyStatus} />
                  <span className="font-medium">{policyData.traffic_light.status}</span>
                </div>
                {policyData.traffic_light.bnf_chapter && (
                  <p className="text-sm text-muted-foreground">
                    BNF: {policyData.traffic_light.bnf_chapter}
                  </p>
                )}
                {policyData.traffic_light.notes && (
                  <p className="text-sm bg-muted/30 p-2 rounded">
                    {policyData.traffic_light.notes}
                  </p>
                )}
                {policyData.traffic_light.detail_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(policyData.traffic_light!.detail_url, '_blank')}
                    className="w-fit"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Traffic Light Details
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Formulary Information */}
          {policyData?.formulary && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold">ICN Formulary - Local Preferred Choices</h3>
                {!policyData.formulary.found_exact_match && (
                  <Badge variant="outline" className="text-xs">
                    Section matches
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                {policyData.formulary.bnf_chapter && policyData.formulary.section && (
                  <div className="text-sm text-muted-foreground">
                    <strong>{policyData.formulary.bnf_chapter}</strong> → {policyData.formulary.section}
                  </div>
                )}
                
                {policyData.formulary.preferred && policyData.formulary.preferred.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Preferred Choices (in order):</h4>
                    {policyData.formulary.preferred.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500">
                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900">
                          {item.rank === 1 ? '1st Line' : item.rank === 2 ? '2nd Line' : `${item.rank}th Line`}
                        </Badge>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.item_name}</span>
                            {item.otc && (
                              <Badge variant="secondary" className="text-xs">OTC</Badge>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(policyData.formulary!.page_url, '_blank')}
                    className="w-fit"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open ICN Formulary
                  </Button>
                  {policyData.formulary.last_published && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Updated: {policyData.formulary.last_published}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Prior Approval Information */}
          {policyData?.prior_approval && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4" />
                <h3 className="font-semibold">Prior Approval</h3>
              </div>
              <div className="space-y-2">
                <Badge variant="outline">{policyData.prior_approval.status}</Badge>
                {policyData.prior_approval.criteria && (
                  <p className="text-sm bg-muted/30 p-2 rounded">
                    <strong>Criteria:</strong> {policyData.prior_approval.criteria}
                  </p>
                )}
                {policyData.prior_approval.source_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(policyData.prior_approval!.source_url, '_blank')}
                    className="w-fit"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View PA Details
                  </Button>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {onInsertIntoChat && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onInsertIntoChat(generateChatMessage());
                  onClose();
                }}
              >
                Insert into Chat
              </Button>
            )}
            <Button
              variant="outline" 
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};