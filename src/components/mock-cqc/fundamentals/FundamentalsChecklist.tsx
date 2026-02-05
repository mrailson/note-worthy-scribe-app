import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ClipboardCheck, 
  ChevronDown, 
  ChevronRight,
  Flame,
  Zap,
  Thermometer,
  Droplets,
  Users,
  Shield,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  FUNDAMENTALS_CATEGORIES, 
  FundamentalCategory, 
  InspectionType,
  getVisibleItems 
} from './fundamentalsConfig';
import { FundamentalItemCard } from './FundamentalItemCard';

export interface FundamentalRecord {
  id: string;
  session_id: string;
  category: string;
  item_key: string;
  item_name: string;
  status: string;
  notes: string | null;
  photo_url: string | null;
  photo_file_name: string | null;
  checked_at: string | null;
  assigned_to: string | null;
  fix_by_date: string | null;
  fix_by_preset: string | null;
}

export interface FundamentalsStats {
  total: number;
  verified: number;
  issuesFound: number;
  notApplicable: number;
  notChecked: number;
  percent: number;
  records?: FundamentalRecord[];
}

interface FundamentalsChecklistProps {
  sessionId: string;
  inspectionType: InspectionType;
  onStatsChange?: (stats: FundamentalsStats) => void;
}


const getCategoryIcon = (iconName: string) => {
  const icons: Record<string, React.ElementType> = {
    flame: Flame,
    zap: Zap,
    thermometer: Thermometer,
    droplets: Droplets,
    users: Users,
    shield: Shield,
    building: Building,
  };
  return icons[iconName] || ClipboardCheck;
};

export const FundamentalsChecklist = ({ sessionId, inspectionType, onStatsChange }: FundamentalsChecklistProps) => {
  const { toast } = useToast();
  const [isCardOpen, setIsCardOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<FundamentalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing records
  useEffect(() => {
    loadRecords();
  }, [sessionId]);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mock_inspection_fundamentals')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading fundamentals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize records for a category when first expanded
  const initializeCategoryRecords = async (category: FundamentalCategory) => {
    const visibleItems = getVisibleItems(category, inspectionType);
    const existingKeys = records.filter(r => r.category === category.key).map(r => r.item_key);
    const newItems = visibleItems.filter(item => !existingKeys.includes(item.key));

    if (newItems.length === 0) return;

    try {
      const recordsToInsert = newItems.map(item => ({
        session_id: sessionId,
        category: category.key,
        item_key: item.key,
        item_name: item.name,
        status: 'not_checked'
      }));

      const { data, error } = await supabase
        .from('mock_inspection_fundamentals')
        .insert(recordsToInsert)
        .select();

      if (error) throw error;
      setRecords(prev => [...prev, ...(data || [])]);
    } catch (error) {
      console.error('Error initializing records:', error);
    }
  };

  const toggleCategory = async (categoryKey: string) => {
    const category = FUNDAMENTALS_CATEGORIES.find(c => c.key === categoryKey);
    const newExpanded = new Set(expandedCategories);
    
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
      // Initialize records when expanding
      if (category) {
        await initializeCategoryRecords(category);
      }
    }
    
    setExpandedCategories(newExpanded);
  };

  const updateRecord = async (itemKey: string, updates: Partial<FundamentalRecord>) => {
    try {
      const { error } = await supabase
        .from('mock_inspection_fundamentals')
        .update({
          ...updates,
          checked_at: updates.status && updates.status !== 'not_checked' ? new Date().toISOString() : null
        })
        .eq('session_id', sessionId)
        .eq('item_key', itemKey);

      if (error) throw error;

      setRecords(prev => 
        prev.map(r => r.item_key === itemKey ? { ...r, ...updates } : r)
      );
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        title: "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  // Calculate progress for each category (only counting visible items)
  const getCategoryProgress = (categoryKey: string) => {
    const category = FUNDAMENTALS_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return { checked: 0, total: 0, percent: 0, verified: 0, issues: 0, notApplicable: 0 };

    const visibleItems = getVisibleItems(category, inspectionType);
    const visibleKeys = visibleItems.map(i => i.key);
    const categoryRecords = records.filter(r => r.category === categoryKey && visibleKeys.includes(r.item_key));

    const total = visibleItems.length;
    const checked = categoryRecords.filter(r => r.status !== 'not_checked').length;
    const verified = categoryRecords.filter(r => r.status === 'verified').length;
    const issues = categoryRecords.filter(r => r.status === 'issue_found').length;
    const notApplicable = categoryRecords.filter(r => r.status === 'not_applicable').length;
    return { checked, total, percent: total > 0 ? Math.round((checked / total) * 100) : 0, verified, issues, notApplicable };
  };

  // Calculate overall progress (only counting visible items)
  const getOverallProgress = () => {
    let totalItems = 0;
    let checkedItems = 0;

    FUNDAMENTALS_CATEGORIES.forEach(cat => {
      const visibleItems = getVisibleItems(cat, inspectionType);
      const visibleKeys = visibleItems.map(i => i.key);
      totalItems += visibleItems.length;
      checkedItems += records.filter(r => 
        r.category === cat.key && 
        visibleKeys.includes(r.item_key) && 
        r.status !== 'not_checked'
      ).length;
    });

    return { 
      checked: checkedItems, 
      total: totalItems, 
      percent: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0 
    };
  };

  // Calculate detailed stats for callback
  const getDetailedStats = (): FundamentalsStats => {
    let totalItems = 0;
    let verified = 0;
    let issuesFound = 0;
    let notApplicable = 0;
    let notChecked = 0;

    FUNDAMENTALS_CATEGORIES.forEach(cat => {
      const visibleItems = getVisibleItems(cat, inspectionType);
      const visibleKeys = visibleItems.map(i => i.key);
      totalItems += visibleItems.length;
      
      const categoryRecords = records.filter(r => 
        r.category === cat.key && 
        visibleKeys.includes(r.item_key)
      );

      categoryRecords.forEach(r => {
        if (r.status === 'verified') verified++;
        else if (r.status === 'issue_found') issuesFound++;
        else if (r.status === 'not_applicable') notApplicable++;
        else notChecked++;
      });

      // Count items without records as not checked
      notChecked += visibleItems.length - categoryRecords.length;
    });

    return { 
      total: totalItems, 
      verified,
      issuesFound,
      notApplicable,
      notChecked,
      percent: totalItems > 0 ? Math.round(((verified + issuesFound + notApplicable) / totalItems) * 100) : 0,
      records // Include the records for filtering
    };
  };

  const overall = getOverallProgress();
  const detailedStats = getDetailedStats();

  // Notify parent of stats changes
  useEffect(() => {
    if (onStatsChange && !isLoading) {
      onStatsChange(detailedStats);
    }
  }, [records, isLoading, inspectionType]);

  // Filter categories that have visible items
  const visibleCategories = FUNDAMENTALS_CATEGORIES.filter(cat => 
    getVisibleItems(cat, inspectionType).length > 0
  );

  return (
    <Collapsible open={isCardOpen} onOpenChange={setIsCardOpen}>
      <Card className="border-2 border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Fundamentals Checklist
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  !isCardOpen && "-rotate-90"
                )} />
              </CardTitle>
              <Badge variant={overall.percent === 100 ? "default" : "secondary"}>
                {overall.checked}/{overall.total} items
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Essential compliance evidence for your practice walkthrough
            </p>
            <Progress value={overall.percent} className="h-2 mt-3" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {visibleCategories.map((category) => {
              const Icon = getCategoryIcon(category.icon);
              const isExpanded = expandedCategories.has(category.key);
              const progress = getCategoryProgress(category.key);
              const categoryRecords = records.filter(r => r.category === category.key);
              const visibleItems = getVisibleItems(category, inspectionType);

              return (
                <div key={category.key} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted", category.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          ({progress.checked} items checked)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status badges with fixed widths for alignment */}
                      <div className="w-20 flex justify-end">
                        {progress.verified > 0 && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {progress.verified} Verified
                          </Badge>
                        )}
                      </div>
                      <div className="w-16 flex justify-end">
                        {progress.issues > 0 && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {progress.issues} Issues
                          </Badge>
                        )}
                      </div>
                      <div className="w-12 flex justify-end">
                        {progress.notApplicable > 0 && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                            {progress.notApplicable} N/A
                          </Badge>
                        )}
                      </div>
                      <div className="text-right ml-2 w-24">
                        <span className="text-sm font-medium">{progress.percent}%</span>
                        <Progress value={progress.percent} className="h-1.5 w-20 mt-1" />
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 p-4 space-y-3">
                      {visibleItems.map((item) => {
                        const record = categoryRecords.find(r => r.item_key === item.key);
                        return (
                          <FundamentalItemCard
                            key={item.key}
                            item={item}
                            record={record}
                            sessionId={sessionId}
                            categoryKey={category.key}
                            categoryName={category.name}
                            onUpdate={(updates) => updateRecord(item.key, updates)}
                            onRecordCreated={(newRecord) => setRecords(prev => [...prev, newRecord])}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
