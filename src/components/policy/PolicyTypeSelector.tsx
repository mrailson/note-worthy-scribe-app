import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { usePolicyReferenceLibrary, PolicyReference } from "@/hooks/usePolicyReferenceLibrary";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface PolicyTypeSelectorProps {
  selectedPolicy: PolicyReference | null;
  onSelect: (policy: PolicyReference) => void;
}

const categoryOrder = [
  'Clinical',
  'Information Governance',
  'Health & Safety',
  'HR',
  'Patient Services',
  'Business Continuity',
];

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

export const PolicyTypeSelector = ({ selectedPolicy, onSelect }: PolicyTypeSelectorProps) => {
  const { policies, isLoading } = usePolicyReferenceLibrary();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(categoryOrder);

  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const query = searchQuery.toLowerCase();
    return policies.filter(p =>
      p.policy_name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  }, [policies, searchQuery]);

  const groupedPolicies = useMemo(() => {
    return categoryOrder.reduce((acc, category) => {
      acc[category] = filteredPolicies.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PolicyReference[]>);
  }, [filteredPolicies]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading policies...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search policies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredPolicies.length} {filteredPolicies.length === 1 ? 'policy' : 'policies'} found
      </p>

      {/* Policy Categories */}
      <RadioGroup
        value={selectedPolicy?.id || ""}
        onValueChange={(value) => {
          const policy = policies.find(p => p.id === value);
          if (policy) onSelect(policy);
        }}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {categoryOrder.map(category => {
            const categoryPolicies = groupedPolicies[category] || [];
            if (categoryPolicies.length === 0) return null;

            const isExpanded = expandedCategories.includes(category);

            return (
              <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 bg-muted rounded-md hover:bg-muted/80 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{category}</span>
                  <Badge variant="secondary" className="ml-auto">{categoryPolicies.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1 pl-4">
                  {categoryPolicies.map(policy => (
                    <div
                      key={policy.id}
                      className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedPolicy?.id === policy.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted'
                      }`}
                      onClick={() => onSelect(policy)}
                    >
                      <RadioGroupItem value={policy.id} id={policy.id} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={policy.id}
                          className="font-medium text-sm cursor-pointer"
                        >
                          {policy.policy_name}
                        </Label>
                        {policy.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {policy.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className={`text-xs ${kloeColors[policy.cqc_kloe] || ''}`}>
                            {policy.cqc_kloe}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${priorityColors[policy.priority] || ''}`}>
                            {policy.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </RadioGroup>

      {/* Empty State */}
      {filteredPolicies.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No policies found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};
