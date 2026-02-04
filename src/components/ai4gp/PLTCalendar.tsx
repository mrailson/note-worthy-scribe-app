import React, { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PLTDate {
  date: string;
  day: number;
  month: string;
  type: 'countywide' | 'practice-pcn';
  year: number;
}

const PLT_DATES_2026_27: PLTDate[] = [
  { date: '2026-02-25', day: 25, month: 'Feb', type: 'countywide', year: 2026 },
  { date: '2026-03-18', day: 18, month: 'Mar', type: 'countywide', year: 2026 },
  { date: '2026-04-15', day: 15, month: 'Apr', type: 'practice-pcn', year: 2026 },
  { date: '2026-05-13', day: 13, month: 'May', type: 'countywide', year: 2026 },
  { date: '2026-06-10', day: 10, month: 'Jun', type: 'practice-pcn', year: 2026 },
  { date: '2026-07-08', day: 8, month: 'Jul', type: 'countywide', year: 2026 },
  { date: '2026-09-09', day: 9, month: 'Sep', type: 'practice-pcn', year: 2026 },
  { date: '2026-10-07', day: 7, month: 'Oct', type: 'countywide', year: 2026 },
  { date: '2026-11-11', day: 11, month: 'Nov', type: 'practice-pcn', year: 2026 },
  { date: '2027-01-13', day: 13, month: 'Jan', type: 'countywide', year: 2027 },
  { date: '2027-02-10', day: 10, month: 'Feb', type: 'practice-pcn', year: 2027 },
  { date: '2027-03-10', day: 10, month: 'Mar', type: 'countywide', year: 2027 },
];

interface PLTCalendarProps {
  compact?: boolean;
  defaultOpen?: boolean;
  onDateClick?: (date: PLTDate) => void;
}

export const PLTCalendar: React.FC<PLTCalendarProps> = ({ 
  compact = false, 
  defaultOpen = false,
  onDateClick 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const today = new Date();
  
  const isUpcoming = (pltDate: PLTDate) => {
    const dateObj = new Date(pltDate.date);
    return dateObj >= today;
  };

  const isPast = (pltDate: PLTDate) => {
    const dateObj = new Date(pltDate.date);
    return dateObj < today;
  };

  let lastDisplayedYear: number | null = null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        compact ? "text-sm" : ""
      )}>
        {/* Header - Clickable to toggle */}
        <CollapsibleTrigger asChild>
          <button className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-3 flex items-center justify-between gap-2 hover:from-pink-600 hover:to-fuchsia-700 transition-colors">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">2026/27 PLT Calendar</h3>
            </div>
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-white/80" />
            ) : (
              <ChevronRight className="w-5 h-5 text-white/80" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Date List - Collapsible */}
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {PLT_DATES_2026_27.map((pltDate, index) => {
              const showYearMarker = lastDisplayedYear !== pltDate.year;
              lastDisplayedYear = pltDate.year;
              const upcoming = isUpcoming(pltDate);
              const past = isPast(pltDate);

              return (
                <div
                  key={pltDate.date}
                  onClick={() => onDateClick?.(pltDate)}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 transition-colors",
                    onDateClick && "cursor-pointer hover:bg-accent/50",
                    past && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Date badge */}
                    <div className={cn(
                      "flex items-center justify-center min-w-[60px] px-2 py-1 rounded-md font-medium text-sm",
                      upcoming 
                        ? "bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {pltDate.day} {pltDate.month}
                    </div>

                    {/* Type badge */}
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-xs font-normal",
                        pltDate.type === 'countywide' 
                          ? "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300"
                          : "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-700 dark:bg-pink-950 dark:text-pink-300"
                      )}
                    >
                      {pltDate.type === 'countywide' ? 'Countywide' : 'Practice/PCN'}
                    </Badge>
                  </div>

                  {/* Year marker */}
                  {showYearMarker && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {pltDate.year}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export { PLT_DATES_2026_27 };
export type { PLTDate };
