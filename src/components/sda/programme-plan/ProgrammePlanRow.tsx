import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ProgrammePlanRowProps {
  name: string;
  assignedTo?: string;
  progress: number;
  level: "phase" | "section" | "task";
  isExpanded?: boolean;
  onToggle?: () => void;
  hasChildren?: boolean;
}

export const ProgrammePlanRow: React.FC<ProgrammePlanRowProps> = ({
  name,
  assignedTo,
  progress,
  level,
  isExpanded,
  onToggle,
  hasChildren = false,
}) => {
  const indentClass = {
    phase: "pl-2",
    section: "pl-6",
    task: "pl-10",
  }[level];

  const fontClass = {
    phase: "font-bold text-sm",
    section: "font-semibold text-sm",
    task: "font-normal text-xs",
  }[level];

  const heightClass = {
    phase: "h-12",
    section: "h-10",
    task: "h-9",
  }[level];

  // Excel-matched colours: navy for phases, slightly lighter for sections
  const bgClass = {
    phase: "bg-[#4472C4] text-white",
    section: "bg-[#5B9BD5] text-white",
    task: "bg-background",
  }[level];

  return (
    <div
      className={cn(
        "flex items-center border-b border-border/50",
        heightClass,
        bgClass,
        indentClass
      )}
    >
      {hasChildren && onToggle ? (
        <button
          onClick={onToggle}
          className={cn(
            "mr-1 p-0.5 rounded",
            level === "task" ? "hover:bg-muted" : "hover:bg-white/20"
          )}
        >
          {isExpanded ? (
            <ChevronDown className={cn("h-3.5 w-3.5", level === "task" ? "text-muted-foreground" : "text-white/80")} />
          ) : (
            <ChevronRight className={cn("h-3.5 w-3.5", level === "task" ? "text-muted-foreground" : "text-white/80")} />
          )}
        </button>
      ) : (
        <div className="w-5" />
      )}
      
      <div className="flex-1 min-w-0 pr-2">
        <div className={cn("truncate", fontClass)}>{name}</div>
        {assignedTo && level === "task" && (
          <div className="text-[10px] text-muted-foreground truncate">
            {assignedTo}
          </div>
        )}
      </div>
      
      <div className={cn(
        "w-12 text-right pr-2 text-xs",
        level === "task" ? "text-muted-foreground" : "text-white/80"
      )}>
        {progress}%
      </div>
    </div>
  );
};
