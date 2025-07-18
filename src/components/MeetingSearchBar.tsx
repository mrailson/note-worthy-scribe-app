import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MeetingSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultsCount: number;
  filterType?: string;
  onFilterChange?: (filterType: string) => void;
}

export const MeetingSearchBar = ({ 
  searchQuery, 
  onSearchChange, 
  resultsCount,
  filterType = "all",
  onFilterChange
}: MeetingSearchBarProps) => {
  const [localFilterType, setLocalFilterType] = useState<string>(filterType);

  const handleClearSearch = () => {
    onSearchChange("");
    const newFilterType = "all";
    setLocalFilterType(newFilterType);
    onFilterChange?.(newFilterType);
  };

  const handleFilterChange = (value: string) => {
    setLocalFilterType(value);
    onFilterChange?.(value);
  };

  const filters = [
    { value: "all", label: "All Meetings" },
    { value: "clinical-review", label: "Clinical Review" },
    { value: "federation", label: "Federation" },
    { value: "general", label: "General Meeting" },
    { value: "gp-partners", label: "GP Partners Meeting" },
    { value: "icb-meeting", label: "ICB Meeting" },
    { value: "lmc", label: "LMC" },
    { value: "locality", label: "Locality" },
    { value: "neighbourhood-meeting", label: "Neighbourhood Meeting" },
    { value: "patient-consultation", label: "Patient Meeting" },
    { value: "pcn-meeting", label: "PCN Meeting" },
    { value: "team-meeting", label: "Team Meeting" },
    { value: "training", label: "Training Session" },
  ];

  const currentFilter = filters.find(f => f.value === localFilterType);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings by title, description, or type..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {currentFilter?.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filters.map((filter) => (
              <DropdownMenuItem
                key={filter.value}
                onClick={() => handleFilterChange(filter.value)}
                className={localFilterType === filter.value ? "bg-accent" : ""}
              >
                {filter.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {resultsCount} meeting{resultsCount !== 1 ? 's' : ''} found
          </Badge>
          
          {searchQuery && (
            <Badge variant="outline">
              "{searchQuery}"
            </Badge>
          )}
          
          {localFilterType !== "all" && (
            <Badge variant="outline">
              {currentFilter?.label}
            </Badge>
          )}
        </div>

        {(searchQuery || localFilterType !== "all") && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearSearch}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
};