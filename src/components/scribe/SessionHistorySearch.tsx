import { Search, X, Calendar, Stethoscope, Heart, HandHeart, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week';
export type CategoryFilter = 'all' | 'general' | 'agewell' | 'social_prescriber';

interface SessionHistorySearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
  resultCount: number;
  totalCount: number;
}

const dateFilters: { value: DateFilter; label: string; icon: typeof Calendar }[] = [
  { value: 'all', label: 'All Time', icon: Clock },
  { value: 'today', label: 'Today', icon: Calendar },
  { value: 'yesterday', label: 'Yesterday', icon: Calendar },
  { value: 'this_week', label: 'This Week', icon: Calendar },
];

const categoryFilters: { value: CategoryFilter; label: string; icon: typeof Stethoscope }[] = [
  { value: 'all', label: 'All Types', icon: Stethoscope },
  { value: 'general', label: 'General', icon: Stethoscope },
  { value: 'agewell', label: 'Age Well', icon: Heart },
  { value: 'social_prescriber', label: 'Social Prescriber', icon: HandHeart },
];

export const SessionHistorySearch = ({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  resultCount,
  totalCount,
}: SessionHistorySearchProps) => {
  const isMobile = useIsMobile();
  const hasActiveFilters = dateFilter !== 'all' || categoryFilter !== 'all' || searchTerm.length > 0;

  const clearAllFilters = () => {
    onSearchChange('');
    onDateFilterChange('all');
    onCategoryFilterChange('all');
  };

  // Mobile-friendly date filter labels
  const getDateLabel = (filter: typeof dateFilters[0]) => {
    if (!isMobile) return filter.label;
    switch (filter.value) {
      case 'all': return 'All';
      case 'today': return 'Today';
      case 'yesterday': return 'Yest';
      case 'this_week': return 'Week';
      default: return filter.label;
    }
  };

  // Mobile-friendly category filter labels
  const getCategoryLabel = (filter: typeof categoryFilters[0]) => {
    if (!isMobile) return filter.label;
    switch (filter.value) {
      case 'all': return 'All';
      case 'general': return 'GP';
      case 'agewell': return 'Age';
      case 'social_prescriber': return 'Social';
      default: return filter.label;
    }
  };

  return (
    <div className={`space-y-2 ${isMobile ? 'space-y-2' : 'space-y-3'}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isMobile ? "Search..." : "Search consultations..."}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`pl-9 pr-9 ${isMobile ? 'h-10' : ''}`}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Date Filters */}
      <div className={`flex flex-wrap ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
        {dateFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = dateFilter === filter.value;
          return (
            <Badge
              key={filter.value}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:scale-105 touch-manipulation",
                isActive && "bg-primary text-primary-foreground",
                isMobile && "text-xs px-2 py-1"
              )}
              onClick={() => onDateFilterChange(filter.value)}
            >
              <Icon className={`mr-1 ${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
              {getDateLabel(filter)}
            </Badge>
          );
        })}
      </div>

      {/* Category Filters */}
      <div className={`flex flex-wrap ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
        {categoryFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = categoryFilter === filter.value;
          return (
            <Badge
              key={filter.value}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all hover:scale-105 touch-manipulation",
                isActive && "bg-secondary text-secondary-foreground",
                isMobile && "text-xs px-2 py-1"
              )}
              onClick={() => onCategoryFilterChange(filter.value)}
            >
              <Icon className={`mr-1 ${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
              {getCategoryLabel(filter)}
            </Badge>
          );
        })}
      </div>

      {/* Results Count & Clear */}
      {hasActiveFilters && (
        <div className={`flex items-center justify-between text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
          <span>
            {isMobile ? `${resultCount}/${totalCount}` : `Showing ${resultCount} of ${totalCount} consultations`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className={`text-xs ${isMobile ? 'h-6 px-2' : 'h-7'}`}
          >
            <X className="h-3 w-3 mr-1" />
            {isMobile ? "Clear" : "Clear filters"}
          </Button>
        </div>
      )}
    </div>
  );
};
