import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "../InfoTooltip";
import { ConditionFilterType } from "@/types/complexCareTypes";
import { cn } from "@/lib/utils";

interface ComplexCareHeaderProps {
  selectedPractice: string;
  onPracticeChange: (practice: string) => void;
  selectedFilter: ConditionFilterType;
  onFilterChange: (filter: ConditionFilterType) => void;
  lastRefresh: Date;
}

export const ComplexCareHeader = ({
  selectedPractice,
  onPracticeChange,
  selectedFilter,
  onFilterChange,
  lastRefresh,
}: ComplexCareHeaderProps) => {
  const practices = [
    'All Practices',
    'Towcester MC',
    'Silverstone Surgery',
    'Brackley MC',
    'Greens Norton',
    'Deanshanger MC',
    'Bugbrooke',
    'Parks',
  ];

  const filters: { value: ConditionFilterType; label: string; count?: number }[] = [
    { value: 'all', label: 'All Conditions', count: 25 },
    { value: 'diabetes', label: 'Diabetes', count: 18 },
    { value: 'cvd', label: 'CVD', count: 12 },
    { value: 'respiratory', label: 'Respiratory', count: 9 },
    { value: 'renal', label: 'Renal', count: 11 },
  ];

  return (
    <div className="bg-card text-foreground border border-border rounded-lg p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Title Section */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl lg:text-3xl font-bold">
              Proactive Complex Care Dashboard
            </h1>
            <InfoTooltip 
              content="AI-powered dashboard ranking patients by risk score to enable proactive intervention before hospital admission. Updates in real-time with automatic prioritization."
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Rural East & South Neighbourhood Access Service
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>7 Practices</span>
            <span>•</span>
            <span>88,938 Patients</span>
            <span>•</span>
            <span>Dr Simon Ellis</span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Select value={selectedPractice} onValueChange={onPracticeChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {practices.map((practice) => (
                  <SelectItem key={practice} value={practice}>
                    {practice}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm">Live</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Last refresh: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={selectedFilter === filter.value ? 'secondary' : 'outline'}
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              "transition-all",
              selectedFilter === filter.value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                {filter.count}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};
