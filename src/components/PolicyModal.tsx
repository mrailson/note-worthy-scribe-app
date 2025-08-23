import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Calendar, FileText, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { PolicyBadge, type PolicyStatus } from './PolicyBadge';
import { useToast } from '@/hooks/use-toast';

interface PolicyData {
  drug: {
    name: string;
    tl_status: PolicyStatus;
    bnf_chapter?: string;
    tl_url?: string;
    last_modified?: string;
    notes?: string;
  };
  prior_approval?: {
    status: string;
    route: string;
    criteria: string[];
    link?: string;
    notes?: string;
  } | null;
  can_gp_initiate: string;
  fuzzy_match?: number | null;
}

interface PolicyModalProps {
  policyData: PolicyData | null;
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
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!policyData) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (canInitiate: string) => {
    if (canInitiate.toLowerCase().includes('yes')) return 'text-green-700 bg-green-50 border-green-200';
    if (canInitiate.toLowerCase().includes('no')) return 'text-red-700 bg-red-50 border-red-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const copyToNotes = () => {
    const summary = generateSummaryText();
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "Policy summary has been copied to your clipboard.",
    });
  };

  const insertIntoChat = () => {
    if (onInsertIntoChat) {
      const message = generateSummaryText();
      onInsertIntoChat(message);
      onClose();
    }
  };

  const generateSummaryText = () => {
    const { drug, prior_approval, can_gp_initiate } = policyData;
    
    let summary = `**${drug.name}**\n`;
    summary += `• Can GP initiate? ${can_gp_initiate}\n`;
    summary += `• Status: ${drug.tl_status.replace('_', ' ')}\n`;
    
    if (drug.bnf_chapter) {
      summary += `• BNF: ${drug.bnf_chapter}\n`;
    }
    
    if (prior_approval) {
      summary += `• ${prior_approval.route}: ${prior_approval.status}\n`;
    }
    
    if (drug.last_modified) {
      summary += `• Updated: ${formatDate(drug.last_modified)}\n`;
    }
    
    return summary;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <PolicyBadge status={policyData.drug.tl_status} />
            <div>
              <DialogTitle className="text-xl">{policyData.drug.name}</DialogTitle>
              <DialogDescription>
                Local medicines policy guidance and evidence
                {policyData.fuzzy_match && policyData.fuzzy_match < 0.8 && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    Fuzzy match - verify name
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Can GP Initiate - Big Answer */}
          <Card className={`border-2 ${getStatusColor(policyData.can_gp_initiate)}`}>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Can GP initiate?</h3>
                <p className="text-xl font-bold">{policyData.can_gp_initiate}</p>
              </div>
            </CardContent>
          </Card>

          {/* Traffic Light Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Traffic Light Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <PolicyBadge status={policyData.drug.tl_status} />
                <span className="font-medium">
                  {policyData.drug.tl_status.replace('_', ' ')}
                </span>
              </div>
              
              {policyData.drug.bnf_chapter && (
                <div>
                  <Badge variant="secondary" className="text-xs">
                    {policyData.drug.bnf_chapter}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Last modified: {formatDate(policyData.drug.last_modified)}</span>
              </div>

              {policyData.drug.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">{policyData.drug.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prior Approval Section */}
          {policyData.prior_approval && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Prior Approval Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={policyData.prior_approval.status === 'DOUBLE_RED' ? 'destructive' : 'secondary'}>
                    {policyData.prior_approval.route}
                  </Badge>
                  <span className="text-sm font-medium">
                    {policyData.prior_approval.status.replace('_', ' ')}
                  </span>
                </div>

                {policyData.prior_approval.criteria.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Criteria:</h4>
                    <ul className="space-y-1">
                      {policyData.prior_approval.criteria.map((criterion, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1 h-1 bg-muted-foreground rounded-full mt-2 flex-shrink-0" />
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {policyData.prior_approval.notes && (
                  <p className="text-sm text-muted-foreground">
                    {policyData.prior_approval.notes}
                  </p>
                )}

                {policyData.prior_approval.link && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={policyData.prior_approval.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Form/Policy
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Formulary Alternative - Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formulary Alternative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Alternative recommendations will be available in a future update. 
                Consult your local formulary or Medicines Optimisation team.
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Provenance */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Provenance</h3>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={policyData.drug.tl_url || "https://www.icnorthamptonshire.org.uk/trafficlightdrugs"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="justify-start"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  ICN Traffic Light Database
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Last updated: {formatDate(policyData.drug.last_modified)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyToNotes} className="flex-1">
              {copied ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? 'Copied!' : 'Copy to Notes'}
            </Button>
            
            {onInsertIntoChat && (
              <Button onClick={insertIntoChat} className="flex-1">
                Insert into Chat
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};