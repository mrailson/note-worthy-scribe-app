import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Calendar, FileText, History, AlertCircle } from 'lucide-react';
import PolicyBadge, { PolicyStatus } from './PolicyBadge';

interface PolicyHit {
  name: string;
  status_enum: PolicyStatus;
  status_raw: string;
  bnf_chapter?: string;
  last_modified?: string;
  detail_url?: string;
  notes?: string;
  prior_approval_url?: string;
}

interface EvidenceDrawerProps {
  policyHit: PolicyHit;
  nationalRefs?: string[];
  changeLog?: Array<{
    date: string;
    change: string;
    reason?: string;
  }>;
  children: React.ReactNode;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  policyHit,
  nationalRefs = [],
  changeLog = [],
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);

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

  const getPolicyRule = (status: PolicyStatus) => {
    switch (status) {
      case 'DOUBLE_RED':
        return 'Hospital-only prescribing. Do not prescribe in primary care under any circumstances.';
      case 'RED':
        return 'Do not initiate in primary care. Requires specialist pathway or prior approval.';
      case 'SPECIALIST_INITIATED':
        return 'May continue in primary care if initiated by specialist. Check shared care agreement.';
      case 'SPECIALIST_RECOMMENDED':
        return 'Recommended option for consideration. Check local formulary guidance.';
      default:
        return 'Policy status not assessed locally. Consult Medicines Optimisation team.';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <PolicyBadge status={policyHit.status_enum} />
            <SheetTitle className="text-lg">{policyHit.name}</SheetTitle>
          </div>
          <SheetDescription>
            Local medicines policy guidance and evidence
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Tabs defaultValue="policy" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="policy">Policy</TabsTrigger>
              <TabsTrigger value="references">National Refs</TabsTrigger>
              <TabsTrigger value="history">Change Log</TabsTrigger>
            </TabsList>

            <TabsContent value="policy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Policy Rule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {getPolicyRule(policyHit.status_enum)}
                  </p>
                  
                  {policyHit.bnf_chapter && (
                    <div className="mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {policyHit.bnf_chapter}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Calendar className="w-3 h-3" />
                    <span>Last modified: {formatDate(policyHit.last_modified)}</span>
                  </div>

                  {policyHit.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800">{policyHit.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {policyHit.detail_url && (
                      <Button variant="outline" size="sm" asChild className="justify-start">
                        <a href={policyHit.detail_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Traffic-Light Database
                        </a>
                      </Button>
                    )}
                    
                    {policyHit.prior_approval_url && (
                      <Button variant="outline" size="sm" asChild className="justify-start">
                        <a href={policyHit.prior_approval_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Prior Approval
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="references" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">National References</CardTitle>
                  <CardDescription>
                    Official guidelines and references that inform this policy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {nationalRefs.length > 0 ? (
                    <div className="space-y-2">
                      {nationalRefs.map((ref, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <a 
                            href={ref} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                          >
                            {ref}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No national references available for this medicine.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Change History
                  </CardTitle>
                  <CardDescription>
                    Recent updates to this medicine's policy status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {changeLog.length > 0 ? (
                    <div className="space-y-4">
                      {changeLog.map((entry, index) => (
                        <div key={index} className="border-l-2 border-muted pl-4">
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatDate(entry.date)}
                          </div>
                          <div className="text-sm font-medium mb-1">{entry.change}</div>
                          {entry.reason && (
                            <div className="text-xs text-muted-foreground">{entry.reason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No change history available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EvidenceDrawer;