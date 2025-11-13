import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { useState, useEffect } from "react";

interface DashboardHeaderProps {
  selectedPractice: string;
  onPracticeChange: (practice: string) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
  onManualRefresh: () => void;
}

export const DashboardHeader = ({
  selectedPractice,
  onPracticeChange,
  dateRange,
  onDateRangeChange,
  autoRefresh,
  onAutoRefreshToggle,
  onManualRefresh
}: DashboardHeaderProps) => {
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onManualRefresh();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, onManualRefresh]);

  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(300);
    }
  }, [autoRefresh]);

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
    <div className="bg-[#005EB8] text-white p-6 rounded-t-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">NRES Dashboard</h1>
          <InfoTooltip 
            content="Real-time visibility of all hub consultation results across Rural East & South Neighbourhood practices. This dashboard ensures complete accountability and zero lost results." 
            className="text-white/70 hover:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedPractice} onValueChange={onPracticeChange}>
            <SelectTrigger className="w-[180px] bg-white text-[#003087]">
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
            <SelectTrigger className="w-[150px] bg-white text-[#003087]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={autoRefresh ? "secondary" : "outline"}
            size="sm"
            onClick={onAutoRefreshToggle}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh && `(${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')})`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onManualRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <p className="text-sm text-white/80 mt-2">
        Rural East & South Neighbourhood Results Management System
      </p>
    </div>
  );
};
