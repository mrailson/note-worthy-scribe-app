import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Download, FileText, ChevronDown, ChevronRight, Loader2, Plus, Filter, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePolicyReferenceLibrary } from "@/hooks/usePolicyReferenceLibrary";
import { usePolicyCompletions, PolicyCompletion } from "@/hooks/usePolicyCompletions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generatePolicyDocx } from "@/utils/generatePolicyDocx";
import { toast } from "sonner";

const categoryOrder = [
  'Clinical',
  'Information Governance',
  'Health & Safety',
  'HR',
  'Patient Services',
  'Business Continuity',
];

const kloeOptions = ['All', 'Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'] as const;
const priorityOptions = ['All', 'Essential', 'Service-specific', 'Recommended'] as const;
const statusOptions = ['All', 'Completed', 'Not Started'] as const;

const kloeColors: Record<string, string> = {
  'Safe': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Effective': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Caring': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'Responsive': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Well-led': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const priorityColors: Record<string, string> = {
  'Essential': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Recommended': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Service-specific': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const PolicyServiceChecklist = () => {
  const navigate = useNavigate();
  const { policies, isLoading } = usePolicyReferenceLibrary();
  const { completions, isPolicyCompleted, getCompletionByPolicyId, getDaysUntilReview } = usePolicyCompletions();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(categoryOrder);
  const [kloeFilter, setKloeFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (completion: PolicyCompletion) => {
    setDownloadingId(completion.id);
    try {
      const metadata = completion.metadata as {
        title: string;
        version: string;
        effective_date: string;
        review_date: string;
        references: string[];
      };
      
      await generatePolicyDocx(
        completion.policy_content,
        metadata,
        completion.policy_title,
        {}
      );
      toast.success("Policy downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download policy");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      const matchesSearch = p.policy_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesKloe = kloeFilter === "All" || p.cqc_kloe === kloeFilter;
      const matchesPriority = priorityFilter === "All" || p.priority === priorityFilter;
      
      // Status filter
      const isCompleted = isPolicyCompleted(p.id);
      const matchesStatus = statusFilter === "All" || 
        (statusFilter === "Completed" && isCompleted) ||
        (statusFilter === "Not Started" && !isCompleted);
      
      return matchesSearch && matchesKloe && matchesPriority && matchesStatus;
    });
  }, [policies, searchQuery, kloeFilter, priorityFilter, statusFilter, isPolicyCompleted]);

  const groupedPolicies = useMemo(() => {
    return categoryOrder.reduce((acc, category) => {
      acc[category] = filteredPolicies.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, typeof policies>);
  }, [filteredPolicies]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleCreatePolicy = (policyId: string) => {
    navigate(`/policy-service/create?policyId=${policyId}`);
  };

  const essentialCount = policies.filter(p => p.priority === 'Essential').length;
  const recommendedCount = policies.filter(p => p.priority === 'Recommended').length;
  const completedCount = completions.length;

  const getStatusIndicator = (policyId: string) => {
    const completion = getCompletionByPolicyId(policyId);
    if (!completion) return null;

    const days = getDaysUntilReview(completion.review_date);
    
    if (days < 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Review overdue by {Math.abs(days)} days</p>
              <p className="text-xs text-muted-foreground">Review date: {completion.review_date}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else if (days <= 30) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {days}d
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Review due in {days} days</p>
              <p className="text-xs text-muted-foreground">Review date: {completion.review_date}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1 shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                Done
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Policy completed</p>
              <p className="text-xs text-muted-foreground">Review in {days} days ({completion.review_date})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/policy-service')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice Policies
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Policy Checklist</h1>
              <p className="text-muted-foreground">
                {policies.length} policies across {categoryOrder.length} categories
              </p>
            </div>
          </div>
          <Button variant="outline" className="hidden sm:flex">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-primary">{essentialCount}</div>
              <div className="text-xs text-muted-foreground">Essential</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-primary">{recommendedCount}</div>
              <div className="text-xs text-muted-foreground">Recommended</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-muted-foreground">{policies.length - completedCount}</div>
              <div className="text-xs text-muted-foreground">Not Started</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* View Type Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by:</span>
            </div>
            
            <Select value={kloeFilter} onValueChange={setKloeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="CQC KLOE" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {kloeOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {option === 'All' ? 'All KLOEs' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {priorityOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {option === 'All' ? 'All Priorities' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {(kloeFilter !== 'All' || priorityFilter !== 'All') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setKloeFilter('All');
                  setPriorityFilter('All');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
            )}
            
            {/* Active filter count indicator */}
            {filteredPolicies.length !== policies.length && (
              <Badge variant="secondary" className="ml-auto">
                Showing {filteredPolicies.length} of {policies.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Policy Categories */}
        {!isLoading && (
          <div className="space-y-4">
            {categoryOrder.map(category => {
              const categoryPolicies = groupedPolicies[category] || [];
              if (categoryPolicies.length === 0 && searchQuery) return null;
              
              const isExpanded = expandedCategories.includes(category);
              
              return (
                <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <CardTitle className="text-lg">{category}</CardTitle>
                            <Badge variant="secondary">{categoryPolicies.length}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="divide-y">
                          {categoryPolicies.map(policy => {
                            const completion = getCompletionByPolicyId(policy.id);
                            const isCompleted = !!completion;
                            
                            // Format date for display (ISO to UK format)
                            const formatDate = (dateStr: string) => {
                              const date = new Date(dateStr);
                              return date.toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                              });
                            };
                            
                            return (
                              <div
                                key={policy.id}
                                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className="font-medium text-sm">{policy.policy_name}</div>
                                  {isCompleted && completion ? (
                                    <div className="text-xs text-muted-foreground">
                                      Created: {formatDate(completion.created_at)} • Version {completion.version}
                                    </div>
                                  ) : policy.description ? (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {policy.description}
                                    </div>
                                  ) : null}
                                  <div className="flex gap-2 mt-1">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${kloeColors[policy.cqc_kloe] || ''}`}
                                    >
                                      {policy.cqc_kloe}
                                    </Badge>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${priorityColors[policy.priority] || ''}`}
                                    >
                                      {policy.priority}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {getStatusIndicator(policy.id)}
                                  {isCompleted && completion ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownload(completion)}
                                        disabled={downloadingId === completion.id}
                                      >
                                        {downloadingId === completion.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Download className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled
                                        className="opacity-50 cursor-not-allowed"
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Created
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCreatePolicy(policy.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Create
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPolicies.length === 0 && searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No policies found matching "{searchQuery}"</p>
              <Button variant="link" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PolicyServiceChecklist;
