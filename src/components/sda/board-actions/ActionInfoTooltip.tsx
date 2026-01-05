import { Info } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import type { NRESBoardAction, BoardActionStatus } from "@/types/nresBoardActions";

interface ActionInfoTooltipProps {
  action: NRESBoardAction;
}

const getStatusLabel = (status: BoardActionStatus | null | undefined) => {
  if (!status) return "-";
  switch (status) {
    case "pending":
      return "Pending";
    case "in-progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    default:
      return status;
  }
};

const formatDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  try {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm");
  } catch {
    return "-";
  }
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  try {
    return format(new Date(dateString), "dd/MM/yyyy");
  } catch {
    return "-";
  }
};

export const ActionInfoTooltip = ({ action }: ActionInfoTooltipProps) => {
  const now = new Date();
  const createdAt = new Date(action.created_at);
  const daysOpen = differenceInDays(now, createdAt);
  
  let daysUntilDue: number | null = null;
  if (action.due_date) {
    const dueDate = new Date(action.due_date);
    daysUntilDue = differenceInDays(dueDate, now);
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
          aria-label="View action details"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="start" side="left" sideOffset={5}>
        <div className="p-3 bg-muted/50 border-b">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Action Details
          </h4>
        </div>
        <div className="p-3 space-y-3 text-sm">
          {/* Reference */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference:</span>
            <span className="font-mono text-xs">{action.reference_number || "-"}</span>
          </div>

          <Separator />

          {/* Creation Info */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDateTime(action.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created By:</span>
              <span className="truncate max-w-[150px]" title={action.created_by_email || undefined}>
                {action.created_by_email || "-"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Update Info */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span>{formatDateTime(action.updated_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated By:</span>
              <span className="truncate max-w-[150px]" title={action.updated_by_email || undefined}>
                {action.updated_by_email || "-"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Status Info */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Status:</span>
              <span>{getStatusLabel(action.original_status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status Set:</span>
              <span>{formatDateTime(action.original_status_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Status:</span>
              <span className="font-medium">{getStatusLabel(action.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status Changed:</span>
              <span>{formatDateTime(action.status_changed_at)}</span>
            </div>
          </div>

          <Separator />

          {/* Tracking Metrics */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Days Open:</span>
              <span className={daysOpen > 30 ? "text-amber-600 font-medium" : ""}>
                {daysOpen} {daysOpen === 1 ? "day" : "days"}
              </span>
            </div>
            {action.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>{formatDate(action.due_date)}</span>
              </div>
            )}
            {daysUntilDue !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {daysUntilDue >= 0 ? "Days Until Due:" : "Days Overdue:"}
                </span>
                <span className={daysUntilDue < 0 ? "text-destructive font-medium" : daysUntilDue <= 7 ? "text-amber-600 font-medium" : ""}>
                  {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}
                </span>
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
