import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  onEdit?: () => void;
  onDelete?: () => void;
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
  onEdit,
  onDelete,
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

  const getSectionBg = () => {
    if (level === "task") return { bg: "bg-background", text: "text-foreground" };
    if (rowId && sectionColorMap[rowId]) return sectionColorMap[rowId];
    return { bg: "bg-[#BDD7EE]", text: "text-foreground" };
  };

  const sectionStyle = getSectionBg();

  const getStatusBadge = () => {
    if (level !== "task") return null;
    if (progress === 100) return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#4EA72E] hover:bg-[#4EA72E] text-white border-0">Done</Badge>;
    if (progress > 0) return <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#7B7BC7] hover:bg-[#7B7BC7] text-white border-0">Active</Badge>;
    return <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Pending</Badge>;
  };

  return (
    <div
      className={cn(
        "flex items-center border-b border-border/50 group",
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
      
      <div className="flex-1 min-w-0 pr-1">
        <div className={cn("truncate", fontClass)}>{name}</div>
        {assignedTo && level === "task" && (
          <div className="text-[10px] text-muted-foreground truncate">
            {assignedTo}
          </div>
        )}
      </div>

      {level === "task" && (
        <div className="flex items-center gap-1 mr-1">
          {getStatusBadge()}
          <span className="w-8 text-right text-[10px] opacity-70">{progress}%</span>
          <button
            onClick={onEdit}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
            title="Edit task"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-opacity"
            title="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {level === "section" && (
        <div className="flex items-center gap-1 mr-1">
          <span className="w-8 text-right text-xs opacity-80">{progress}%</span>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-opacity"
              title="Delete section"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {level === "phase" && (
        <div className="w-12 text-right pr-2 text-xs opacity-80">
          {progress}%
        </div>
      )}
    </div>
  );
};

// Compact add button for inserting tasks/sections
export const AddItemButton: React.FC<{ label: string; onClick: () => void; indent?: string }> = ({ label, onClick, indent = "pl-10" }) => (
  <div className={cn("flex items-center h-7 border-b border-border/30 border-dashed", indent)}>
    <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground" onClick={onClick}>
      <Plus className="h-3 w-3" /> {label}
    </Button>
  </div>
);
