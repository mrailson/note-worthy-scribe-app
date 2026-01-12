import React, { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sdaProgrammePlan } from "@/data/sdaProgrammePlanData";
import { ProgrammePlanRow } from "./ProgrammePlanRow";
import { ProgrammePlanLegend } from "./ProgrammePlanLegend";
import { cn } from "@/lib/utils";
import { format, eachDayOfInterval, isWeekend, startOfWeek, addDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, eachMonthOfInterval, eachQuarterOfInterval } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays, CalendarRange, Calendar, FileSpreadsheet } from "lucide-react";

type TimeView = "weeks" | "months" | "quarters";

const ROW_HEIGHT_PHASE = 48;
const ROW_HEIGHT_SECTION = 40;
const ROW_HEIGHT_TASK = 36;

// Parse DD/MM/YY format
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    // Handle both DD/MM/YY and DD/MM/YYYY formats
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    
    let year = parseInt(parts[2]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
  } catch {
    return null;
  }
};

// Calculate the date range for the entire plan
const calculateDateRange = () => {
  const startDate = new Date(2025, 10, 1); // 1 Nov 2025
  const endDate = new Date(2026, 3, 5); // 5 Apr 2026 (with padding)
  return { startDate, endDate };
};

interface FlatRow {
  id: string;
  name: string;
  assignedTo?: string;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
  level: "phase" | "section" | "task";
  parentId?: string;
  hasChildren: boolean;
}

export const ProgrammePlanGantt: React.FC = () => {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["discovery-setup"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(
    sdaProgrammePlan.phases[0]?.sections?.map(s => s.id) || []
  ));
  const [timeView, setTimeView] = useState<TimeView>("weeks");
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const { startDate, endDate } = useMemo(() => calculateDateRange(), []);
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  const today = new Date();
  
  // Calculate unit width based on view
  const unitWidth = useMemo(() => {
    switch (timeView) {
      case "weeks": return 20; // per day
      case "months": return 8; // per day (more compact)
      case "quarters": return 4; // per day (most compact)
    }
  }, [timeView]);
  
  // Generate time period headers based on view
  const timePeriods = useMemo(() => {
    switch (timeView) {
      case "weeks": {
        const result: { date: Date; label: string; width: number }[] = [];
        let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
        
        while (currentWeekStart <= endDate) {
          result.push({
            date: currentWeekStart,
            label: format(currentWeekStart, "d MMM"),
            width: 7 * unitWidth,
          });
          currentWeekStart = addDays(currentWeekStart, 7);
        }
        return result;
      }
      case "months": {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        return months.map(month => {
          const monthEnd = endOfMonth(month);
          const daysInMonth = monthEnd.getDate();
          return {
            date: month,
            label: format(month, "MMM yyyy"),
            width: daysInMonth * unitWidth,
          };
        });
      }
      case "quarters": {
        const quarters = eachQuarterOfInterval({ start: startDate, end: endDate });
        return quarters.map(quarter => {
          const qStart = startOfQuarter(quarter);
          const qEnd = endOfQuarter(quarter);
          const daysInQuarter = Math.ceil((qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return {
            date: quarter,
            label: `Q${Math.ceil((quarter.getMonth() + 1) / 3)} ${format(quarter, "yyyy")}`,
            width: daysInQuarter * unitWidth,
          };
        });
      }
    }
  }, [startDate, endDate, timeView, unitWidth]);
  
  // Flatten the hierarchy for rendering
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    
    sdaProgrammePlan.phases.forEach((phase) => {
      const hasPhaseTasks = (phase.tasks?.length || 0) > 0;
      const hasSections = (phase.sections?.length || 0) > 0;
      
      rows.push({
        id: phase.id,
        name: phase.name,
        progress: 0,
        startDate: null,
        endDate: null,
        level: "phase",
        hasChildren: hasPhaseTasks || hasSections,
      });
      
      if (expandedPhases.has(phase.id)) {
        // Add phase-level tasks
        phase.tasks?.forEach((task) => {
          rows.push({
            id: task.id,
            name: task.name,
            assignedTo: task.assignedTo,
            progress: task.progress,
            startDate: parseDate(task.startDate || ""),
            endDate: parseDate(task.endDate || ""),
            level: "task",
            parentId: phase.id,
            hasChildren: false,
          });
        });
        
        // Add sections
        phase.sections?.forEach((section) => {
          rows.push({
            id: section.id,
            name: section.name,
            progress: 0,
            startDate: null,
            endDate: null,
            level: "section",
            parentId: phase.id,
            hasChildren: section.tasks.length > 0,
          });
          
          if (expandedSections.has(section.id)) {
            section.tasks.forEach((task) => {
              rows.push({
                id: task.id,
                name: task.name,
                assignedTo: task.assignedTo,
                progress: task.progress,
                startDate: parseDate(task.startDate || ""),
                endDate: parseDate(task.endDate || ""),
                level: "task",
                parentId: section.id,
                hasChildren: false,
              });
            });
          }
        });
      }
    });
    
    return rows;
  }, [expandedPhases, expandedSections]);
  
  // Sync scroll between panels
  const handleScroll = (source: "left" | "timeline") => {
    if (source === "left" && leftPanelRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = leftPanelRef.current.scrollTop;
    } else if (source === "timeline" && timelineRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  };
  
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  
  const getRowHeight = (level: FlatRow["level"]) => {
    switch (level) {
      case "phase": return ROW_HEIGHT_PHASE;
      case "section": return ROW_HEIGHT_SECTION;
      case "task": return ROW_HEIGHT_TASK;
    }
  };
  
  const getBarColor = (progress: number) => {
    if (progress === 100) return "bg-[#4EA72E]"; // Vertex green - completed
    if (progress > 0) return "bg-[#5B9BD5]";     // Soft blue - in progress
    return "bg-[#BDD7EE]";                        // Light blue - not started
  };
  
  const calculateBarPosition = (row: FlatRow) => {
    if (!row.startDate || !row.endDate) return null;
    
    const startDayIndex = Math.max(0, Math.floor((row.startDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const endDayIndex = Math.floor((row.endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const left = startDayIndex * unitWidth;
    const width = Math.max(unitWidth, (endDayIndex - startDayIndex + 1) * unitWidth);
    
    return { left, width };
  };
  
  const todayPosition = useMemo(() => {
    const dayIndex = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (dayIndex < 0 || dayIndex > days.length) return null;
    return dayIndex * unitWidth + unitWidth / 2;
  }, [today, startDate, days.length, unitWidth]);
  
  const totalTimelineWidth = days.length * unitWidth;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{sdaProgrammePlan.title}</span>
          <div className="flex items-center gap-3">
            <ToggleGroup 
              type="single" 
              value={timeView} 
              onValueChange={(value) => value && setTimeView(value as TimeView)}
              className="bg-muted/50 rounded-lg p-0.5"
            >
              <ToggleGroupItem 
                value="weeks" 
                aria-label="View by weeks"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Weeks</span>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="months" 
                aria-label="View by months"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Months</span>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="quarters" 
                aria-label="View by quarters"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quarters</span>
              </ToggleGroupItem>
            </ToggleGroup>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 gap-1.5"
                    asChild
                  >
                    <a 
                      href="/downloads/Same_Day_Access_Innovator_-_Project_Plan.xlsx" 
                      download="Same_Day_Access_Innovator_-_Project_Plan.xlsx"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <span className="hidden sm:inline text-xs">Excel</span>
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download Programme Plan (Excel)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <span className="text-sm font-normal text-muted-foreground">
              {sdaProgrammePlan.company}
            </span>
          </div>
        </CardTitle>
        <ProgrammePlanLegend />
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-t">
          {/* Left Panel - Task List */}
          <div className="w-80 flex-shrink-0 border-r">
            {/* Header */}
            <div className="h-12 border-b bg-muted/50 flex items-center px-3 text-sm font-semibold">
              Task Name
            </div>
            
            {/* Rows */}
            <div
              ref={leftPanelRef}
              className="overflow-y-auto max-h-[500px]"
              onScroll={() => handleScroll("left")}
            >
              {flatRows.map((row) => (
                <ProgrammePlanRow
                  key={row.id}
                  name={row.name}
                  assignedTo={row.assignedTo}
                  progress={row.progress}
                  level={row.level}
                  isExpanded={
                    row.level === "phase"
                      ? expandedPhases.has(row.id)
                      : row.level === "section"
                      ? expandedSections.has(row.id)
                      : undefined
                  }
                  onToggle={
                    row.hasChildren
                      ? () => {
                          if (row.level === "phase") togglePhase(row.id);
                          else if (row.level === "section") toggleSection(row.id);
                        }
                      : undefined
                  }
                  hasChildren={row.hasChildren}
                />
              ))}
            </div>
          </div>
          
          {/* Right Panel - Timeline */}
          <div className="flex-1 overflow-hidden">
            {/* Time Period Headers */}
            <div className="h-12 border-b bg-muted/50 overflow-x-auto">
              <div
                className="flex h-full"
                style={{ width: totalTimelineWidth }}
              >
                {timePeriods.map((period, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 border-r border-border/50 flex items-center justify-center text-xs font-medium"
                    style={{ width: period.width }}
                  >
                    {period.label}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Timeline Grid */}
            <div
              ref={timelineRef}
              className="overflow-auto max-h-[500px]"
              onScroll={() => handleScroll("timeline")}
            >
              <div
                className="relative"
                style={{ width: totalTimelineWidth }}
              >
                {/* Day columns */}
                <div className="absolute inset-0 flex">
                  {days.map((day, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex-shrink-0 border-r border-border/20",
                        isWeekend(day) && timeView === "weeks" && "bg-muted/30"
                      )}
                      style={{ width: unitWidth }}
                    />
                  ))}
                </div>
                
                {/* Today marker */}
                {todayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#AD3815] z-20"
                    style={{ left: todayPosition }}
                  />
                )}
                
                {/* Task bars */}
                {flatRows.map((row) => {
                  const barPos = calculateBarPosition(row);
                  const rowHeight = getRowHeight(row.level);
                  
                  return (
                    <div
                      key={row.id}
                      className="relative border-b border-border/50"
                      style={{ height: rowHeight }}
                    >
                      {barPos && row.level === "task" && (
                        <div
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-5 rounded-sm shadow-sm",
                            getBarColor(row.progress)
                          )}
                          style={{
                            left: barPos.left,
                            width: barPos.width,
                          }}
                        >
                          {/* Progress fill for partial completion */}
                          {row.progress > 0 && row.progress < 100 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-[#4EA72E]/60 rounded-l-sm"
                              style={{ width: `${row.progress}%` }}
                            />
                          )}
                          
                          {/* Progress text */}
                          {barPos.width > 40 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium">
                              {row.progress}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
