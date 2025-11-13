import { RefreshCw, Download, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "@/components/nres/InfoTooltip";
import { practiceOptions } from "@/data/commsStrategyMockData";

interface CommsStrategyHeaderProps {
  selectedPractice: string;
  onPracticeChange: (practice: string) => void;
  selectedDateRange: string;
  onDateRangeChange: (range: string) => void;
  onRefresh: () => void;
  onAddPlan: () => void;
  onExport: () => void;
  onViewReference: () => void;
}

export const CommsStrategyHeader = ({
  selectedPractice,
  onPracticeChange,
  selectedDateRange,
  onDateRangeChange,
  onRefresh,
  onAddPlan,
  onExport,
  onViewReference,
}: CommsStrategyHeaderProps) => {
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
  ];

  return (
    <div className="bg-white border-b border-border p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#003087]">NRES Comms Strategy</h1>
          <InfoTooltip content="Track and manage all communication initiatives and plans across Rural East & South Neighbourhood practices. Monitor status with RAG indicators and record events for complete audit trail." />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedPractice} onValueChange={onPracticeChange}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Select practice" />
            </SelectTrigger>
            <SelectContent>
              {practiceOptions.map((practice) => (
                <SelectItem key={practice} value={practice}>
                  {practice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={onAddPlan}
            className="bg-[#005EB8] hover:bg-[#003087] text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New Plan
          </Button>

          <Button
            onClick={onViewReference}
            variant="outline"
            className="gap-2 border-[#005EB8] text-[#005EB8] hover:bg-[#005EB8] hover:text-white"
          >
            <Copy className="h-4 w-4" />
            Copy Reference
          </Button>

          <Button
            onClick={onRefresh}
            variant="ghost"
            className="text-[#003087] hover:text-[#005EB8] gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          <Button
            onClick={onExport}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};
