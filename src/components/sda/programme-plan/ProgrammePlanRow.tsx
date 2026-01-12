import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

// Excel-matched section colours
const sectionColorMap: Record<string, { bg: string; text: string }> = {
  "discovery-setup": { bg: "bg-[#BDD7EE]", text: "text-foreground" },
  "key-components": { bg: "bg-[#FFE699]", text: "text-foreground" },
  "estates-digital": { bg: "bg-[#F8CBAD]", text: "text-foreground" },
  "appointments": { bg: "bg-[#F8CBAD]", text: "text-foreground" },
  "recruitment": { bg: "bg-[#F8CBAD]", text: "text-foreground" },
  "financial-governance": { bg: "bg-[#ED7D31]", text: "text-white" },
  "contract-variation": { bg: "bg-[#C9A86C]", text: "text-white" },
  "risk-governance": { bg: "bg-[#A9D18E]", text: "text-foreground" },
  "communication": { bg: "bg-[#70AD47]", text: "text-white" },
  "innovation": { bg: "bg-[#548235]", text: "text-white" },
};

interface ProgrammePlanRowProps {
  name: string;
  assignedTo?: string;
  progress: number;
  level: "phase" | "section" | "task";
  isExpanded?: boolean;
  onToggle?: () => void;
  hasChildren?: boolean;
  rowId?: string;
}

export const ProgrammePlanRow: React.FC<ProgrammePlanRowProps> = ({
  name,
  assignedTo,
  progress,
  level,
  isExpanded,
  onToggle,
  hasChildren = false,
  rowId,
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

  // Get section-specific colour or default
  const getSectionBg = () => {
    if (level === "task") return { bg: "bg-background", text: "text-foreground" };
    if (rowId && sectionColorMap[rowId]) {
      return sectionColorMap[rowId];
    }
    // Default light blue for phases
    return { bg: "bg-[#BDD7EE]", text: "text-foreground" };
  };

  const sectionStyle = getSectionBg();

  return (
    <div
      className={cn(
        "flex items-center border-b border-border/50",
        heightClass,
        sectionStyle.bg,
        sectionStyle.text,
        indentClass
      )}
    >
      {hasChildren && onToggle ? (
        <button
          onClick={onToggle}
          className={cn(
            "mr-1 p-0.5 rounded",
            level === "task" ? "hover:bg-muted" : "hover:bg-black/10"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
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
        "w-12 text-right pr-2 text-xs opacity-80"
      )}>
        {progress}%
      </div>
    </div>
  );
};
