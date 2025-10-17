import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, X, Filter, Calendar, Clock, MapPin, Users, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SearchFilters {
  searchQuery: string;
  filterType: string;
  dateFrom: string;
  dateTo: string;
  durationMin: string;
  durationMax: string;
  location: string;
  format: string;
}

interface MeetingSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultsCount: number;
  filterType?: string;
  onFilterChange?: (filterType: string) => void;
  onAdvancedFiltersChange?: (filters: Partial<SearchFilters>) => void;
  advancedFilters?: Partial<SearchFilters>;
}

export const MeetingSearchBar = ({ 
  searchQuery, 
  onSearchChange, 
  resultsCount,
  filterType = "all",
  onFilterChange,
  onAdvancedFiltersChange,
  advancedFilters = {}
}: MeetingSearchBarProps) => {
  const [localFilterType, setLocalFilterType] = useState<string>(filterType);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [localAdvancedFilters, setLocalAdvancedFilters] = useState({
    dateFrom: advancedFilters.dateFrom || "",
    dateTo: advancedFilters.dateTo || "",
    durationMin: advancedFilters.durationMin || "",
    durationMax: advancedFilters.durationMax || "",
    location: advancedFilters.location || "",
    format: advancedFilters.format || "all"
  });

  const handleClearSearch = () => {
    onSearchChange("");
    const newFilterType = "all";
    setLocalFilterType(newFilterType);
    onFilterChange?.(newFilterType);
    
    const resetAdvancedFilters = {
      dateFrom: "",
      dateTo: "",
      durationMin: "",
      durationMax: "",
      location: "",
      format: "all"
    };
    setLocalAdvancedFilters(resetAdvancedFilters);
    onAdvancedFiltersChange?.(resetAdvancedFilters);
  };

  const handleFilterChange = (value: string) => {
    setLocalFilterType(value);
    onFilterChange?.(value);
  };

  const handleAdvancedFilterChange = (key: string, value: string) => {
    const newFilters = { ...localAdvancedFilters, [key]: value };
    setLocalAdvancedFilters(newFilters);
    onAdvancedFiltersChange?.(newFilters);
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

  const formatOptions = [
    { value: "all", label: "All Formats" },
    { value: "face-to-face", label: "Face to Face" },
    { value: "online", label: "Teams/Online" },
  ];

  const currentFilter = filters.find(f => f.value === localFilterType);
  const currentFormat = formatOptions.find(f => f.value === localAdvancedFilters.format);

  const hasActiveAdvancedFilters = Object.values(localAdvancedFilters).some(value => 
    value !== "" && value !== "all"
  );

  return (
    <div className="space-y-4">
      {/* Main Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings by title, description, or type..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 bg-white dark:bg-white dark:text-foreground border-border shadow-sm font-inter"
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

        {/* Meeting Type Filter */}
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

        {/* Advanced Filters Toggle */}
        <Button
          variant={showAdvancedFilters || hasActiveAdvancedFilters ? "default" : "outline"}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced
          {hasActiveAdvancedFilters && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              !
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
        <CollapsibleContent className="space-y-4">
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Advanced Search Filters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date Range
                </Label>
                <div className="space-y-2">
                  <Input
                    type="date"
                    placeholder="From date"
                    value={localAdvancedFilters.dateFrom}
                    onChange={(e) => handleAdvancedFilterChange("dateFrom", e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    type="date"
                    placeholder="To date"
                    value={localAdvancedFilters.dateTo}
                    onChange={(e) => handleAdvancedFilterChange("dateTo", e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Duration Range */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Duration (minutes)
                </Label>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Min duration"
                    value={localAdvancedFilters.durationMin}
                    onChange={(e) => handleAdvancedFilterChange("durationMin", e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max duration"
                    value={localAdvancedFilters.durationMax}
                    onChange={(e) => handleAdvancedFilterChange("durationMax", e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </Label>
                <Input
                  placeholder="Search by location"
                  value={localAdvancedFilters.location}
                  onChange={(e) => handleAdvancedFilterChange("location", e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Meeting Format */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Meeting Format
                </Label>
                <Select 
                  value={localAdvancedFilters.format} 
                  onValueChange={(value) => handleAdvancedFilterChange("format", value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <div className="flex items-center gap-2">
                          {format.value === "face-to-face" && <Users className="h-3 w-3" />}
                          {format.value === "online" && <Monitor className="h-3 w-3" />}
                          {format.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Advanced Filters */}
            <div className="flex justify-end mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const resetFilters = {
                    dateFrom: "",
                    dateTo: "",
                    durationMin: "",
                    durationMax: "",
                    location: "",
                    format: "all"
                  };
                  setLocalAdvancedFilters(resetFilters);
                  onAdvancedFiltersChange?.(resetFilters);
                }}
                className="text-xs"
              >
                Clear Advanced Filters
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Search Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
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

          {localAdvancedFilters.dateFrom && (
            <Badge variant="outline">
              From: {localAdvancedFilters.dateFrom}
            </Badge>
          )}

          {localAdvancedFilters.dateTo && (
            <Badge variant="outline">
              To: {localAdvancedFilters.dateTo}
            </Badge>
          )}

          {localAdvancedFilters.durationMin && (
            <Badge variant="outline">
              Min: {localAdvancedFilters.durationMin}m
            </Badge>
          )}

          {localAdvancedFilters.durationMax && (
            <Badge variant="outline">
              Max: {localAdvancedFilters.durationMax}m
            </Badge>
          )}

          {localAdvancedFilters.location && (
            <Badge variant="outline">
              📍 {localAdvancedFilters.location}
            </Badge>
          )}

          {localAdvancedFilters.format !== "all" && (
            <Badge variant="outline">
              {currentFormat?.label}
            </Badge>
          )}
        </div>

        {(searchQuery || localFilterType !== "all" || hasActiveAdvancedFilters) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearSearch}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all filters
          </Button>
        )}
      </div>
    </div>
  );
};