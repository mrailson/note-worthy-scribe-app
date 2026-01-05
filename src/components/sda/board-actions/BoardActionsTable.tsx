import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import type { NRESBoardAction, BoardActionStatus, BoardActionPriority } from "@/types/nresBoardActions";

interface BoardActionsTableProps {
  actions: NRESBoardAction[];
  onEdit: (action: NRESBoardAction) => void;
  onDelete: (id: string) => void;
}

const getStatusBadgeVariant = (status: BoardActionStatus) => {
  switch (status) {
    case "pending":
      return "secondary";
    case "in-progress":
      return "default";
    case "completed":
      return "outline";
    case "overdue":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: BoardActionStatus) => {
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

const getPriorityBadgeClass = (priority: BoardActionPriority) => {
  switch (priority) {
    case "low":
      return "bg-muted text-muted-foreground";
    case "medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "high":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const BoardActionsTable = ({ actions, onEdit, onDelete }: BoardActionsTableProps) => {
  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No board actions recorded yet. Click "Add Action" to create one.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Action</TableHead>
            <TableHead className="min-w-[120px]">Responsible</TableHead>
            <TableHead className="min-w-[100px]">Meeting Date</TableHead>
            <TableHead className="min-w-[100px]">Due Date</TableHead>
            <TableHead className="min-w-[100px]">Status</TableHead>
            <TableHead className="min-w-[80px]">Priority</TableHead>
            <TableHead className="min-w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => (
            <TableRow key={action.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{action.action_title}</p>
                  {action.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                      {action.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>{action.responsible_person}</TableCell>
              <TableCell>
                {format(new Date(action.meeting_date), "dd/MM/yyyy")}
              </TableCell>
              <TableCell>
                {action.due_date
                  ? format(new Date(action.due_date), "dd/MM/yyyy")
                  : "-"}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(action.status)}>
                  {getStatusLabel(action.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(action.priority)}`}>
                  {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(action)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(action.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
