import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ActionLogItem } from "@/data/nresBoardActionsData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface ActionLogTableProps {
  actions: ActionLogItem[];
}

type SortField = "actionId" | "dateRaised" | "owner" | "dueDate" | "priority" | "status";
type SortDirection = "asc" | "desc" | null;

interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

const priorityOrder = { High: 3, Medium: 2, Low: 1 };
const statusOrder = { Open: 2, Closed: 1 };

const getPriorityBadge = (priority: ActionLogItem['priority']) => {
  switch (priority) {
    case 'High':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">High</Badge>;
    case 'Medium':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Medium</Badge>;
    case 'Low':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
};

const getStatusBadge = (status: ActionLogItem['status']) => {
  switch (status) {
    case 'Open':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
    case 'Closed':
      return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Parse DD/MM/YYYY date string to Date object for comparison
const parseDate = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const ActionLogTable = ({ actions }: ActionLogTableProps) => {
  const [sort, setSort] = useState<SortState>({ field: null, direction: null });

  const handleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        if (prev.direction === "asc") return { field, direction: "desc" };
        if (prev.direction === "desc") return { field: null, direction: null };
        return { field, direction: "asc" };
      }
      return { field, direction: "asc" };
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    if (sort.direction === "asc") return <ArrowUp className="h-3 w-3" />;
    return <ArrowDown className="h-3 w-3" />;
  };

  const sortedActions = useMemo(() => {
    if (!sort.field || !sort.direction) return actions;

    return [...actions].sort((a, b) => {
      const multiplier = sort.direction === "asc" ? 1 : -1;

      switch (sort.field) {
        case "actionId":
          return multiplier * a.actionId.localeCompare(b.actionId);
        case "dateRaised":
          return multiplier * (parseDate(a.dateRaised).getTime() - parseDate(b.dateRaised).getTime());
        case "owner":
          return multiplier * a.owner.localeCompare(b.owner);
        case "dueDate":
          return multiplier * (parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());
        case "priority":
          return multiplier * (priorityOrder[a.priority] - priorityOrder[b.priority]);
        case "status":
          return multiplier * (statusOrder[a.status] - statusOrder[b.status]);
        default:
          return 0;
      }
    });
  }, [actions, sort]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead 
              className="font-semibold text-slate-700 w-[60px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("actionId")}
            >
              <div className="flex items-center gap-1">
                ID
                {getSortIcon("actionId")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[90px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("dateRaised")}
            >
              <div className="flex items-center gap-1">
                Date
                {getSortIcon("dateRaised")}
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[200px]">Description</TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[60px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("owner")}
            >
              <div className="flex items-center gap-1">
                Owner
                {getSortIcon("owner")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[90px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("dueDate")}
            >
              <div className="flex items-center gap-1">
                Due Date
                {getSortIcon("dueDate")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("priority")}
            >
              <div className="flex items-center gap-1">
                Priority
                {getSortIcon("priority")}
              </div>
            </TableHead>
            <TableHead 
              className="font-semibold text-slate-700 w-[70px] cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center gap-1">
                Status
                {getSortIcon("status")}
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[150px]">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActions.map((action, index) => (
            <TableRow 
              key={action.actionId}
              className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
            >
              <TableCell className="font-mono text-sm text-slate-600">{action.actionId}</TableCell>
              <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dateRaised}</TableCell>
              <TableCell className="text-sm text-slate-900">{action.description}</TableCell>
              <TableCell className="text-sm font-medium text-slate-700">{action.owner}</TableCell>
              <TableCell className="text-sm text-slate-600 whitespace-nowrap">{action.dueDate}</TableCell>
              <TableCell>{getPriorityBadge(action.priority)}</TableCell>
              <TableCell>{getStatusBadge(action.status)}</TableCell>
              <TableCell className="text-sm text-slate-500">{action.notes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
