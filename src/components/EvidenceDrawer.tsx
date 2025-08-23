import React, { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExternalLink, Calendar, FileText, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import PolicyBadge, { PolicyStatus } from './PolicyBadge';
import { useTrafficLightVocab } from '@/hooks/useTrafficLightVocab';

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
  policyHit?: PolicyHit;
  nationalRefs?: string[];
  changeLog?: Array<{
    date: string;
    change: string;
    reason?: string;
  }>;
  children?: React.ReactNode;
  onClose?: () => void;
  isOpen?: boolean;
  showListView?: boolean; // New prop to control list vs detail view
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  policyHit,
  nationalRefs = [],
  changeLog = [],
  children,
  onClose,
  isOpen: controlledIsOpen,
  showListView = false
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'detail'>(showListView ? 'list' : 'detail');
  const [selectedMedicine, setSelectedMedicine] = useState<any>(policyHit);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  
  // Get vocabulary data for list view
  const { vocab, isLoading: vocabLoading } = useTrafficLightVocab();
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledIsOpen !== undefined ? onClose || (() => {}) : setInternalIsOpen;

  // Auto-open when policyHit is provided and in controlled mode
  React.useEffect(() => {
    if (policyHit && onClose && controlledIsOpen === undefined) {
      setInternalIsOpen(true);
    }
  }, [policyHit, onClose, controlledIsOpen]);

  // Filter and sort medicines for list view
  const filteredMedicines = useMemo(() => {
    if (currentView !== 'list') return [];
    
    let filtered = vocab.filter(medicine => 
      medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (medicine.bnf_chapter && medicine.bnf_chapter.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    return filtered;
  }, [vocab, searchQuery, currentView]);

  // Pagination logic
  const totalPages = Math.ceil(filteredMedicines.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMedicines = filteredMedicines.slice(startIndex, startIndex + itemsPerPage);

  // Reset pagination when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleMedicineClick = (medicine: any) => {
    setSelectedMedicine(medicine);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedMedicine(null);
  };

  const handleClose = () => {
    if (controlledIsOpen !== undefined) {
      onClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

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

  const renderDetailView = (medicine: any) => {
    if (!medicine) return null;
    
    return (
      <div className="space-y-4">
        {currentView === 'detail' && showListView && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToList}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Policy Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {getPolicyRule(medicine.status_enum || medicine.status)}
            </p>
            
            {medicine.bnf_chapter && (
              <div className="mb-3">
                <Badge variant="secondary" className="text-xs">
                  {medicine.bnf_chapter}
                </Badge>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Calendar className="w-3 h-3" />
              <span>Last modified: {formatDate(medicine.last_modified)}</span>
            </div>

            {medicine.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">{medicine.notes}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild className="justify-start">
                <a href="https://www.icnorthamptonshire.org.uk/trafficlightdrugs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Traffic-Light Database - Northants ICB
                </a>
              </Button>
              
              {medicine.prior_approval_url && (
                <Button variant="outline" size="sm" asChild className="justify-start">
                  <a href={medicine.prior_approval_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Prior Approval
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-4">
        {/* Search and Show All */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Showing {paginatedMedicines.length} of {filteredMedicines.length} medicines
            </span>
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchQuery('')}
              >
                Show All
              </Button>
            )}
          </div>
        </div>

        {/* Medicine List */}
        {vocabLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading medicines...</p>
          </div>
        ) : paginatedMedicines.length > 0 ? (
          <div className="space-y-2">
            {paginatedMedicines.map((medicine, index) => (
              <Card 
                key={medicine.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleMedicineClick(medicine)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <PolicyBadge 
                      status={medicine.status_enum as PolicyStatus}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{medicine.name}</h4>
                      {medicine.bnf_chapter && (
                        <p className="text-xs text-muted-foreground truncate">
                          {medicine.bnf_chapter}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No medicines found matching your search.' : 'No medicines available.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      {children && (
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
      )}
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {currentView === 'detail' && selectedMedicine && (
              <PolicyBadge status={selectedMedicine.status_enum || selectedMedicine.status} />
            )}
            <SheetTitle className="text-lg">
              {currentView === 'list' 
                ? 'Traffic-Light Medicines' 
                : selectedMedicine?.name || 'Medicine Policy'}
            </SheetTitle>
          </div>
          <SheetDescription>
            {currentView === 'list' 
              ? 'Browse local medicines policies and guidance'
              : 'Local medicines policy guidance and evidence'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {currentView === 'list' ? renderListView() : renderDetailView(selectedMedicine)}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EvidenceDrawer;