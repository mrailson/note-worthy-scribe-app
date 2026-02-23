import React, { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sdaProgrammePlan } from "@/data/sdaProgrammePlanData";
import { ProgrammePlanRow, AddItemButton } from "./ProgrammePlanRow";
import { ProgrammePlanLegend } from "./ProgrammePlanLegend";
import { TaskEditDialog } from "./TaskEditDialog";
import { ProgrammeAuditLogDialog, AuditEntry } from "./ProgrammeAuditLogDialog";
import { cn } from "@/lib/utils";
import { format, eachDayOfInterval, isWeekend, startOfWeek, addDays, endOfMonth, startOfQuarter, endOfQuarter, eachMonthOfInterval, eachQuarterOfInterval, subDays } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays, CalendarRange, Calendar, FileSpreadsheet, Mail, ClipboardList } from "lucide-react";
import { ProgrammePlan, ProgrammeTask, ProgrammeSection } from "@/types/sdaProgrammePlan";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type TimeView = "weeks" | "months" | "quarters";

const ROW_HEIGHT_PHASE = 48;
const ROW_HEIGHT_SECTION = 40;
const ROW_HEIGHT_TASK = 36;

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    let year = parseInt(parts[2]);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
  } catch {
    return null;
  }
};

const formatDDMMYY = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr = String(d.getFullYear() % 100).padStart(2, "0");
  return `${day}/${mon}/${yr}`;
};

const collectAllDates = (plan: ProgrammePlan): Date[] => {
  const dates: Date[] = [];
  plan.phases.forEach((phase) => {
    phase.tasks?.forEach((t) => {
      const s = parseDate(t.startDate || "");
      const e = parseDate(t.endDate || "");
      if (s) dates.push(s);
      if (e) dates.push(e);
    });
    phase.sections?.forEach((sec) => {
      sec.tasks.forEach((t) => {
        const s = parseDate(t.startDate || "");
        const e = parseDate(t.endDate || "");
        if (s) dates.push(s);
        if (e) dates.push(e);
      });
    });
  });
  return dates;
};

const avgProgress = (tasks: ProgrammeTask[]): number => {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length);
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
  phaseId?: string;
  sectionId?: string;
}

export const ProgrammePlanGantt: React.FC = () => {
  const { user } = useAuth();
  const userEmail = user?.email || "Unknown";

  const [planData, setPlanData] = useState<ProgrammePlan>(() => JSON.parse(JSON.stringify(sdaProgrammePlan)));
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["discovery-setup"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(
    sdaProgrammePlan.phases[0]?.sections?.map(s => s.id) || []
  ));
  const [timeView, setTimeView] = useState<TimeView>("weeks");
  const [editingTask, setEditingTask] = useState<ProgrammeTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContext, setEditContext] = useState<{ phaseId: string; sectionId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "task" | "section"; id: string; name: string; phaseId: string; sectionId?: string } | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Audit helper
  const addAuditEntry = useCallback((action: string, itemName: string, field?: string, oldValue?: string, newValue?: string) => {
    setAuditLog(prev => [{
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      userEmail,
      action,
      itemName,
      field,
      oldValue,
      newValue,
    }, ...prev]);
  }, [userEmail]);

  // Dynamic date range
  const { startDate, endDate } = useMemo(() => {
    const allDates = collectAllDates(planData);
    if (allDates.length === 0) {
      return { startDate: new Date(2025, 10, 1), endDate: new Date(2026, 3, 5) };
    }
    const minTime = Math.min(...allDates.map(d => d.getTime()));
    const maxTime = Math.max(...allDates.map(d => d.getTime()));
    return {
      startDate: subDays(new Date(minTime), 14),
      endDate: addDays(new Date(maxTime), 14),
    };
  }, [planData]);

  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  const today = new Date();
  
  const unitWidth = useMemo(() => {
    switch (timeView) {
      case "weeks": return 20;
      case "months": return 8;
      case "quarters": return 4;
    }
  }, [timeView]);
  
  const timePeriods = useMemo(() => {
    switch (timeView) {
      case "weeks": {
        const result: { date: Date; label: string; width: number }[] = [];
        let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
        while (currentWeekStart <= endDate) {
          result.push({ date: currentWeekStart, label: format(currentWeekStart, "d MMM"), width: 7 * unitWidth });
          currentWeekStart = addDays(currentWeekStart, 7);
        }
        return result;
      }
      case "months": {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        return months.map(month => ({
          date: month,
          label: format(month, "MMM yyyy"),
          width: endOfMonth(month).getDate() * unitWidth,
        }));
      }
      case "quarters": {
        const quarters = eachQuarterOfInterval({ start: startDate, end: endDate });
        return quarters.map(quarter => {
          const qEnd = endOfQuarter(quarter);
          const daysInQ = Math.ceil((qEnd.getTime() - startOfQuarter(quarter).getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return {
            date: quarter,
            label: `Q${Math.ceil((quarter.getMonth() + 1) / 3)} ${format(quarter, "yyyy")}`,
            width: daysInQ * unitWidth,
          };
        });
      }
    }
  }, [startDate, endDate, timeView, unitWidth]);
  
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    planData.phases.forEach((phase) => {
      const allPhaseTasks: ProgrammeTask[] = [
        ...(phase.tasks || []),
        ...(phase.sections?.flatMap(s => s.tasks) || []),
      ];
      const phaseProgress = avgProgress(allPhaseTasks);
      const hasPhaseTasks = (phase.tasks?.length || 0) > 0;
      const hasSections = (phase.sections?.length || 0) > 0;
      
      rows.push({
        id: phase.id, name: phase.name, progress: phaseProgress,
        startDate: null, endDate: null, level: "phase",
        hasChildren: hasPhaseTasks || hasSections, phaseId: phase.id,
      });
      
      if (expandedPhases.has(phase.id)) {
        phase.tasks?.forEach((task) => {
          rows.push({
            id: task.id, name: task.name, assignedTo: task.assignedTo,
            progress: task.progress, startDate: parseDate(task.startDate || ""),
            endDate: parseDate(task.endDate || ""), level: "task",
            parentId: phase.id, hasChildren: false, phaseId: phase.id,
          });
        });
        
        phase.sections?.forEach((section) => {
          const secProgress = avgProgress(section.tasks);
          rows.push({
            id: section.id, name: section.name, progress: secProgress,
            startDate: null, endDate: null, level: "section",
            parentId: phase.id, hasChildren: section.tasks.length > 0,
            phaseId: phase.id, sectionId: section.id,
          });
          
          if (expandedSections.has(section.id)) {
            section.tasks.forEach((task) => {
              rows.push({
                id: task.id, name: task.name, assignedTo: task.assignedTo,
                progress: task.progress, startDate: parseDate(task.startDate || ""),
                endDate: parseDate(task.endDate || ""), level: "task",
                parentId: section.id, hasChildren: false,
                phaseId: phase.id, sectionId: section.id,
              });
            });
          }
        });
      }
    });
    return rows;
  }, [planData, expandedPhases, expandedSections]);
  
  // ---- Mutation handlers ----
  const handleEditTask = useCallback((taskId: string, phaseId: string, sectionId?: string) => {
    const phase = planData.phases.find(p => p.id === phaseId);
    if (!phase) return;
    let task: ProgrammeTask | undefined;
    if (sectionId) {
      task = phase.sections?.find(s => s.id === sectionId)?.tasks.find(t => t.id === taskId);
    } else {
      task = phase.tasks?.find(t => t.id === taskId);
    }
    if (task) {
      setEditingTask({ ...task });
      setEditContext({ phaseId, sectionId });
      setEditDialogOpen(true);
    }
  }, [planData]);

  const handleSaveTask = useCallback((updated: ProgrammeTask) => {
    if (!editContext) return;
    // Find the original task for diffing
    const phase = planData.phases.find(p => p.id === editContext.phaseId);
    let original: ProgrammeTask | undefined;
    if (phase) {
      if (editContext.sectionId) {
        original = phase.sections?.find(s => s.id === editContext.sectionId)?.tasks.find(t => t.id === updated.id);
      } else {
        original = phase.tasks?.find(t => t.id === updated.id);
      }
    }

    // Record field-level changes
    if (original) {
      const fields: { key: keyof ProgrammeTask; label: string }[] = [
        { key: "name", label: "Name" },
        { key: "assignedTo", label: "Assigned To" },
        { key: "startDate", label: "Start Date" },
        { key: "endDate", label: "End Date" },
        { key: "progress", label: "Progress" },
        { key: "notes", label: "Notes" },
      ];
      fields.forEach(({ key, label }) => {
        const oldVal = String(original![key] ?? "");
        const newVal = String(updated[key] ?? "");
        if (oldVal !== newVal) {
          addAuditEntry("Edited", updated.name, label, oldVal || "—", newVal || "—");
        }
      });
    } else {
      addAuditEntry("Added", updated.name);
    }

    setPlanData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ProgrammePlan;
      const ph = next.phases.find(p => p.id === editContext.phaseId);
      if (!ph) return prev;
      if (editContext.sectionId) {
        const sec = ph.sections?.find(s => s.id === editContext.sectionId);
        if (sec) {
          const idx = sec.tasks.findIndex(t => t.id === updated.id);
          if (idx >= 0) sec.tasks[idx] = updated;
        }
      } else {
        if (ph.tasks) {
          const idx = ph.tasks.findIndex(t => t.id === updated.id);
          if (idx >= 0) ph.tasks[idx] = updated;
        }
      }
      return next;
    });
    toast.success("Task updated");
  }, [editContext, planData, addAuditEntry]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "task") {
      addAuditEntry("Deleted", deleteTarget.name, "Task");
      setPlanData(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as ProgrammePlan;
        const phase = next.phases.find(p => p.id === deleteTarget.phaseId);
        if (!phase) return prev;
        if (deleteTarget.sectionId) {
          const sec = phase.sections?.find(s => s.id === deleteTarget.sectionId);
          if (sec) sec.tasks = sec.tasks.filter(t => t.id !== deleteTarget.id);
        } else {
          if (phase.tasks) phase.tasks = phase.tasks.filter(t => t.id !== deleteTarget.id);
        }
        return next;
      });
    } else {
      // Delete section
      addAuditEntry("Deleted", deleteTarget.name, "Section");
      setPlanData(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as ProgrammePlan;
        const phase = next.phases.find(p => p.id === deleteTarget.phaseId);
        if (!phase || !phase.sections) return prev;
        phase.sections = phase.sections.filter(s => s.id !== deleteTarget.id);
        return next;
      });
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    }
    toast.success(`"${deleteTarget.name}" removed`);
    setDeleteTarget(null);
  }, [deleteTarget, addAuditEntry]);

  const handleAddTask = useCallback((phaseId: string, sectionId?: string) => {
    const now = new Date();
    const end = addDays(now, 14);
    const newTask: ProgrammeTask = {
      id: `task-${Date.now()}`,
      name: "New Task",
      assignedTo: "",
      progress: 0,
      startDate: formatDDMMYY(now),
      endDate: formatDDMMYY(end),
    };
    setPlanData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ProgrammePlan;
      const phase = next.phases.find(p => p.id === phaseId);
      if (!phase) return prev;
      if (sectionId) {
        const sec = phase.sections?.find(s => s.id === sectionId);
        if (sec) sec.tasks.push(newTask);
      } else {
        if (!phase.tasks) phase.tasks = [];
        phase.tasks.push(newTask);
      }
      return next;
    });
    addAuditEntry("Added", "New Task", "Task");
    setEditingTask({ ...newTask });
    setEditContext({ phaseId, sectionId });
    setEditDialogOpen(true);
  }, [addAuditEntry]);

  const handleAddSection = useCallback((phaseId: string) => {
    const newSection: ProgrammeSection = {
      id: `section-${Date.now()}`,
      name: "New Section",
      tasks: [],
    };
    setPlanData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ProgrammePlan;
      const phase = next.phases.find(p => p.id === phaseId);
      if (!phase) return prev;
      if (!phase.sections) phase.sections = [];
      phase.sections.push(newSection);
      return next;
    });
    setExpandedSections(prev => new Set([...prev, newSection.id]));
    addAuditEntry("Added", "New Section", "Section");
    toast.success("Section added");
  }, [addAuditEntry]);

  // ---- Scroll sync ----
  const handleScroll = (source: "left" | "timeline") => {
    if (source === "left" && leftPanelRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = leftPanelRef.current.scrollTop;
    } else if (source === "timeline" && timelineRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineRef.current.scrollTop;
      if (headerRef.current) headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
    }
  };
  
  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
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
    if (progress === 100) return "bg-[#4EA72E]";
    if (progress > 0) return "bg-[#7B7BC7]";
    return "bg-[#BDD7EE]";
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
  
  React.useEffect(() => {
    if (timelineRef.current && todayPosition !== null) {
      const oneWeekPrior = 7 * unitWidth;
      const scrollTo = Math.max(0, todayPosition - oneWeekPrior);
      timelineRef.current.scrollLeft = scrollTo;
      if (headerRef.current) headerRef.current.scrollLeft = scrollTo;
    }
  }, [todayPosition, unitWidth]);
  
  const totalTimelineWidth = days.length * unitWidth;

  // Build left panel rows
  const renderLeftPanel = () => {
    const elements: React.ReactNode[] = [];

    planData.phases.forEach((phase) => {
      const allPhaseTasks: ProgrammeTask[] = [...(phase.tasks || []), ...(phase.sections?.flatMap(s => s.tasks) || [])];
      const phaseProgress = avgProgress(allPhaseTasks);
      const hasPhaseTasks = (phase.tasks?.length || 0) > 0;
      const hasSections = (phase.sections?.length || 0) > 0;

      elements.push(
        <ProgrammePlanRow
          key={phase.id}
          rowId={phase.id}
          name={phase.name}
          progress={phaseProgress}
          level="phase"
          isExpanded={expandedPhases.has(phase.id)}
          onToggle={() => togglePhase(phase.id)}
          hasChildren={hasPhaseTasks || hasSections}
        />
      );

      if (expandedPhases.has(phase.id)) {
        phase.tasks?.forEach((task) => {
          elements.push(
            <ProgrammePlanRow
              key={task.id}
              rowId={task.id}
              name={task.name}
              assignedTo={task.assignedTo}
              progress={task.progress}
              level="task"
              hasChildren={false}
              onEdit={() => handleEditTask(task.id, phase.id)}
              onDelete={() => setDeleteTarget({ type: "task", id: task.id, name: task.name, phaseId: phase.id })}
            />
          );
        });
        elements.push(<AddItemButton key={`add-task-${phase.id}`} label="Add Task" onClick={() => handleAddTask(phase.id)} />);

        phase.sections?.forEach((section) => {
          const secProgress = avgProgress(section.tasks);
          elements.push(
            <ProgrammePlanRow
              key={section.id}
              rowId={section.id}
              name={section.name}
              progress={secProgress}
              level="section"
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              hasChildren={section.tasks.length > 0}
              onDelete={() => setDeleteTarget({ type: "section", id: section.id, name: section.name, phaseId: phase.id })}
            />
          );

          if (expandedSections.has(section.id)) {
            section.tasks.forEach((task) => {
              elements.push(
                <ProgrammePlanRow
                  key={task.id}
                  rowId={task.id}
                  name={task.name}
                  assignedTo={task.assignedTo}
                  progress={task.progress}
                  level="task"
                  hasChildren={false}
                  onEdit={() => handleEditTask(task.id, phase.id, section.id)}
                  onDelete={() => setDeleteTarget({ type: "task", id: task.id, name: task.name, phaseId: phase.id, sectionId: section.id })}
                />
              );
            });
            elements.push(<AddItemButton key={`add-task-${section.id}`} label="Add Task" onClick={() => handleAddTask(phase.id, section.id)} />);
          }
        });

        elements.push(<AddItemButton key={`add-section-${phase.id}`} label="Add Section" onClick={() => handleAddSection(phase.id)} indent="pl-6" />);
      }
    });

    return elements;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{planData.title}</span>
          <div className="flex items-center gap-3">
            <ToggleGroup 
              type="single" 
              value={timeView} 
              onValueChange={(value) => value && setTimeView(value as TimeView)}
              className="bg-muted/50 rounded-lg p-0.5"
            >
              <ToggleGroupItem value="weeks" aria-label="View by weeks" className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Weeks</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="months" aria-label="View by months" className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Months</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="quarters" aria-label="View by quarters" className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-2.5 py-1.5 text-xs gap-1.5">
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
                    className="h-8 px-2.5 gap-1.5 relative"
                    onClick={() => setShowAuditLog(true)}
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Audit</span>
                    {auditLog.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {auditLog.length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>View audit log ({auditLog.length} entries)</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5" asChild>
                    <a href="/downloads/Same_Day_Access_Innovator_-_Project_Plan.xlsx" download="Same_Day_Access_Innovator_-_Project_Plan.xlsx">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <span className="hidden sm:inline text-xs">Excel</span>
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Download Programme Plan (Excel)</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <span className="text-sm font-normal text-muted-foreground">{planData.company}</span>
          </div>
        </CardTitle>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <ProgrammePlanLegend />
          <div className="text-xs text-muted-foreground border-l pl-3 ml-2">
            <span className="font-medium text-foreground">Maintained by:</span>{" "}
            <span>Anshal Pratyush, Principal Medical Limited (PML)</span>
            <span className="mx-2">•</span>
            <a href="mailto:a.pratyush@nhs.net" className="inline-flex items-center gap-1 hover:text-primary">
              <Mail className="h-3 w-3" />
              a.pratyush@nhs.net
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-t">
          {/* Left Panel */}
          <div className="w-80 flex-shrink-0 border-r">
            <div className="h-12 border-b bg-muted/50 flex items-center px-3 text-sm font-semibold">
              Task Name
            </div>
            <div ref={leftPanelRef} className="overflow-y-auto max-h-[500px]" onScroll={() => handleScroll("left")}>
              {renderLeftPanel()}
            </div>
          </div>
          
          {/* Right Panel - Timeline */}
          <div className="flex-1 overflow-hidden">
            <div ref={headerRef} className="h-12 border-b bg-muted/50 overflow-x-hidden">
              <div className="flex h-full" style={{ width: totalTimelineWidth }}>
                {timePeriods.map((period, idx) => (
                  <div key={idx} className="flex-shrink-0 border-r border-border/50 flex items-center justify-center text-xs font-medium" style={{ width: period.width }}>
                    {period.label}
                  </div>
                ))}
              </div>
            </div>
            
            <div ref={timelineRef} className="overflow-auto max-h-[500px]" onScroll={() => handleScroll("timeline")}>
              <div className="relative" style={{ width: totalTimelineWidth }}>
                <div className="absolute inset-0 flex">
                  {days.map((day, idx) => (
                    <div key={idx} className={cn("flex-shrink-0 border-r border-border/20", isWeekend(day) && timeView === "weeks" && "bg-muted/30")} style={{ width: unitWidth }} />
                  ))}
                </div>
                
                {todayPosition !== null && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-[#AD3815] z-20" style={{ left: todayPosition }} />
                )}
                
                {flatRows.map((row) => {
                  const barPos = calculateBarPosition(row);
                  const rowHeight = getRowHeight(row.level);
                  return (
                    <div key={row.id} className="relative border-b border-border/50" style={{ height: rowHeight }}>
                      {barPos && row.level === "task" && (
                        <div
                          className={cn("absolute top-1/2 -translate-y-1/2 h-5 rounded-sm shadow-sm", getBarColor(row.progress))}
                          style={{ left: barPos.left, width: barPos.width }}
                        >
                          {row.progress > 0 && row.progress < 100 && (
                            <div className="absolute inset-y-0 left-0 bg-[#4EA72E]/60 rounded-l-sm" style={{ width: `${row.progress}%` }} />
                          )}
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

                {planData.phases.map((phase) => {
                  if (!expandedPhases.has(phase.id)) return null;
                  const addRows: React.ReactNode[] = [];
                  addRows.push(<div key={`add-row-${phase.id}`} className="border-b border-border/30 border-dashed" style={{ height: 28 }} />);
                  phase.sections?.forEach((section) => {
                    if (expandedSections.has(section.id)) {
                      addRows.push(<div key={`add-row-${section.id}`} className="border-b border-border/30 border-dashed" style={{ height: 28 }} />);
                    }
                  });
                  addRows.push(<div key={`add-sec-row-${phase.id}`} className="border-b border-border/30 border-dashed" style={{ height: 28 }} />);
                  return addRows;
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <TaskEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={editingTask}
        onSave={handleSaveTask}
      />

      <ProgrammeAuditLogDialog
        open={showAuditLog}
        onOpenChange={setShowAuditLog}
        entries={auditLog}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "section" ? "Section" : "Task"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteTarget?.name}"?
              {deleteTarget?.type === "section" && " All tasks within this section will also be removed."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
