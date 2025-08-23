import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, MessageSquare, Loader2 } from 'lucide-react';
import { useTrafficLightResolver } from '@/hooks/useTrafficLightResolver';
import PolicyBadge, { PolicyStatus } from './PolicyBadge';
import EvidenceDrawer from './EvidenceDrawer';

interface TrafficLightQuickPickProps {
  onInsertIntoChat?: (message: string) => void;
  children: React.ReactNode;
}

export const TrafficLightQuickPick: React.FC<TrafficLightQuickPickProps> = ({
  onInsertIntoChat,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const { lookupMedicine, isLoading, fallbackMedicines } = useTrafficLightResolver();

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }

    const result = await lookupMedicine(query);
    setSearchResult(result);
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const insertIntoChat = (medicine: any) => {
    if (!onInsertIntoChat) return;

    const statusText = {
      'DOUBLE_RED': 'DOUBLE RED - not for GP prescribing',
      'RED': 'RED - do not initiate in primary care, specialist pathway or PA required',
      'SPECIALIST_INITIATED': 'SPECIALIST-INITIATED - may continue if started by specialist',
      'SPECIALIST_RECOMMENDED': 'SPECIALIST-RECOMMENDED - consider as recommended option',
      'GREY': 'UNKNOWN status locally',
      'UNKNOWN': 'UNKNOWN status locally'
    }[medicine.status_enum] || 'status unknown';

    const message = `Local policy check for ${medicine.name}: ${statusText}.`;
    onInsertIntoChat(message);
    setIsOpen(false);
  };

  const getStatusDescription = (status: PolicyStatus) => {
    switch (status) {
      case 'DOUBLE_RED':
        return 'Hospital-only prescribing. Not available in primary care.';
      case 'RED':
        return 'Requires specialist initiation or prior approval.';
      case 'SPECIALIST_INITIATED':
        return 'Primary care may continue if started by specialist.';
      case 'SPECIALIST_RECOMMENDED':
        return 'Recommended option - check local formulary.';
      default:
        return 'Status not assessed locally.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Traffic-Light Medicine Checker
          </DialogTitle>
          <DialogDescription>
            Search for local medicines policy guidance. Enter a medicine name to check its traffic-light status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter medicine name (e.g., Acarizax, Adalimumab, Apixaban...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleInputChange(e.target.value);
              }}
              className="flex-1"
            />
            <Button 
              onClick={() => handleSearch(searchQuery)}
              disabled={isLoading || !searchQuery.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Quick suggestions */}
          {!searchQuery && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Try searching for:</p>
              <div className="flex flex-wrap gap-2">
                {fallbackMedicines.slice(0, 5).map((medicine) => (
                  <Button
                    key={medicine}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery(medicine);
                      handleSearch(medicine);
                    }}
                  >
                    {medicine}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {searchResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{searchResult.name}</CardTitle>
                  <PolicyBadge status={searchResult.status_enum} />
                </div>
                <CardDescription>{getStatusDescription(searchResult.status_enum)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {searchResult.bnf_chapter && (
                  <Badge variant="secondary">{searchResult.bnf_chapter}</Badge>
                )}
                
                {searchResult.notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">{searchResult.notes}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {searchResult.detail_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={searchResult.detail_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Traffic-Light Database
                        </a>
                      </Button>
                    )}
                    
                    {searchResult.prior_approval_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={searchResult.prior_approval_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Prior Approval
                        </a>
                      </Button>
                    )}

                    <EvidenceDrawer policyHit={searchResult}>
                      <Button variant="outline" size="sm">
                        <Search className="w-4 h-4 mr-2" />
                        View Evidence
                      </Button>
                    </EvidenceDrawer>
                  </div>

                  {onInsertIntoChat && (
                    <Button 
                      onClick={() => insertIntoChat(searchResult)}
                      className="w-full"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Insert into Chat
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {searchQuery && !searchResult && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No local match found for "{searchQuery}"</p>
                  <p className="text-xs mt-1">Try the generic name or check spelling</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrafficLightQuickPick;