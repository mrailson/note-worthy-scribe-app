import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";

interface DashboardHeaderProps {
  selectedPractice: string;
  onPracticeChange: (practice: string) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onManualRefresh: () => void;
  isIPhone?: boolean;
}

export const DashboardHeader = ({
  selectedPractice,
  onPracticeChange,
  dateRange,
  onDateRangeChange,
  onManualRefresh,
  isIPhone = false
}: DashboardHeaderProps) => {

  const practices = [
    'All Practices',
    'Towcester MC',
    'Brackley MC',
    'Bugbrooke',
    'Denton',
    'Parks MC',
    'Brook',
    'Springfield'
  ];

  return (
    <div className={`bg-[#005EB8] text-white rounded-t-lg ${isIPhone ? 'p-3' : 'p-6'}`}>
      <div className={`flex flex-col ${isIPhone ? 'gap-3' : 'lg:flex-row items-start lg:items-center justify-between gap-4'}`}>
        <div className="flex items-center gap-2">
          <h1 className={`font-bold ${isIPhone ? 'text-lg' : 'text-3xl'}`}>NRES Results Dashboard</h1>
          <InfoTooltip 
            content="Real-time visibility of all hub consultation results across Rural East & South Neighbourhood practices. This dashboard ensures complete accountability and zero lost results." 
            className="text-white/70 hover:text-white"
          />
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${isIPhone ? 'w-full' : 'gap-3'}`}>
          <Select value={selectedPractice} onValueChange={onPracticeChange}>
            <SelectTrigger className={`bg-white text-[#003087] ${isIPhone ? 'flex-1 min-w-0' : 'w-[180px]'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {practices.map(practice => (
                <SelectItem key={practice} value={practice}>
                  {practice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className={`bg-white text-[#003087] ${isIPhone ? 'flex-1 min-w-0' : 'w-[150px]'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {isIPhone ? (
            <div className="flex gap-2 w-full mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onManualRefresh}
                className="flex-1 gap-1 text-gray-600 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1 text-gray-600 text-xs"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onManualRefresh}
                className="gap-2 text-gray-600"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Now
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-gray-600"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      <p className={`text-white/80 mt-2 ${isIPhone ? 'text-xs' : 'text-sm'}`}>
        Rural East & South Neighbourhood Results Management System
      </p>
    </div>
  );
};
