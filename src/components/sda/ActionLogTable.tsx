import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import * as XLSX from "xlsx-js-style";
import { ActionLogItem } from "@/data/nresBoardActionsData";

interface ActionLogMetadata {
  sourceMeeting: string;
  nextMeeting: string;
}

interface ActionLogTableProps {
  actions: ActionLogItem[];
  metadata?: ActionLogMetadata;
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

export const ActionLogTable = ({ actions, metadata }: ActionLogTableProps) => {
  const [sort, setSort] = useState<SortState>({ field: null, direction: null });
  const [showOpenOnly, setShowOpenOnly] = useState(false);

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

  const filteredAndSortedActions = useMemo(() => {
    let result = showOpenOnly ? actions.filter(a => a.status === 'Open') : actions;
    
    if (!sort.field || !sort.direction) return result;

    return [...result].sort((a, b) => {
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
  }, [actions, sort, showOpenOnly]);

  const openCount = actions.filter(a => a.status === 'Open').length;

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];
    
    // Title rows
    rows.push(["NRES Programme Board - Action Log"]);
    rows.push(["Rural East & South Neighbourhood Access Service"]);
    rows.push([]);
    
    // Headers
    rows.push(["Action ID", "Date Raised", "Action Description", "Owner", "Due Date", "Priority", "Status", "Notes/Update"]);
    
    // Data rows
    filteredAndSortedActions.forEach(action => {
      rows.push([
        action.actionId,
        action.dateRaised,
        action.description,
        action.owner,
        action.dueDate,
        action.priority,
        action.status,
        action.notes || ""
      ]);
    });
    
    // Legend
    rows.push([]);
    rows.push(["Priority:", "High", "Medium", "Low", "", "Status:", "Open", "Closed"]);
    
    // Source and next meeting
    if (metadata) {
      rows.push([]);
      rows.push([`Source Meeting: ${metadata.sourceMeeting}`]);
      rows.push([`Next Meeting: ${metadata.nextMeeting}`]);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }
    ];
    
    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }
    ];
    
    // Style header row
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E0E0E0" } },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };
    
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    cols.forEach(col => {
      const cell = ws[`${col}4`];
      if (cell) cell.s = headerStyle;
    });
    
    // Style data cells
    const dataStyle = {
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      },
      alignment: { wrapText: true, vertical: 'top' }
    };
    
    for (let i = 0; i < filteredAndSortedActions.length; i++) {
      const rowNum = 5 + i;
      cols.forEach(col => {
        const cell = ws[`${col}${rowNum}`];
        if (cell) cell.s = dataStyle;
      });
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "Action Log");
    const dateStr = format(new Date(), "yyyy-MM-dd");
    XLSX.writeFile(wb, `NRES_Programme_Board_Action_Log_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-3">
      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Switch 
            id="show-open-only" 
            checked={showOpenOnly} 
            onCheckedChange={setShowOpenOnly}
          />
          <Label htmlFor="show-open-only" className="text-sm text-slate-600 cursor-pointer">
            Open Action Items ({openCount})
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <span className="text-xs text-slate-500">
            Last updated: {format(new Date(), "d MMMM yyyy")}
          </span>
        </div>
      </div>

      {/* Table */}
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
            {filteredAndSortedActions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  No open actions
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedActions.map((action, index) => (
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
