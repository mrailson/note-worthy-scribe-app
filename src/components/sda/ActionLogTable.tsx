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
    
    // Style definitions
    const titleStyle = {
      font: { bold: true, sz: 16, name: 'Calibri', color: { rgb: "1E3A5F" } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    
    const subtitleStyle = {
      font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: "2E5B8C" } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };

    const brandingStyle = {
      font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const headerStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "D9E2EC" } },
      border: {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };

    const cellStyle = {
      font: { sz: 10, name: 'Calibri' },
      border: {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      },
      alignment: { vertical: 'center', wrapText: true }
    };

    // Priority colour styles
    const priorityStyles: Record<string, any> = {
      High: { ...cellStyle, fill: { fgColor: { rgb: "FF6B6B" } }, font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: 'center', vertical: 'center' } },
      Medium: { ...cellStyle, fill: { fgColor: { rgb: "FFB84D" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
      Low: { ...cellStyle, fill: { fgColor: { rgb: "90EE90" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
    };

    // Status colour styles
    const statusStyles: Record<string, any> = {
      Open: { ...cellStyle, fill: { fgColor: { rgb: "ADD8E6" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
      Closed: { ...cellStyle, fill: { fgColor: { rgb: "B8B8B8" } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
    };

    // Legend styles
    const legendLabelStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'right', vertical: 'center' }
    };

    const legendHighStyle = {
      font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "FF6B6B" } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const legendMediumStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "FFB84D" } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const legendLowStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "90EE90" } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const legendOpenStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "ADD8E6" } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const legendClosedStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: "B8B8B8" } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Row 1: Branding and Title
    rows.push(['NRES', '', '', 'NRES Programme Board - Action Log', '', '', '', 'DocMed']);
    
    // Row 2: Subtitle
    rows.push(['', '', '', 'Rural East & South Neighbourhood Access Service', '', '', '', '']);
    
    // Row 3: Empty spacer
    rows.push([]);
    
    // Row 4: Headers
    rows.push(['Action ID', 'Date Raised', 'Action Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Notes/Update']);
    
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
    
    // Empty row before legend
    rows.push([]);
    
    // Legend row
    rows.push(['', 'Priority:', 'High', 'Medium', 'Low', '', 'Status:', 'Open', 'Closed']);
    
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
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 10 }
    ];
    
    // Merge cells for title and subtitle
    ws['!merges'] = [
      { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } },  // Title merge
      { s: { r: 1, c: 3 }, e: { r: 1, c: 6 } },  // Subtitle merge
    ];
    
    // Set row heights
    ws['!rows'] = [
      { hpt: 30 },  // Title row
      { hpt: 22 },  // Subtitle row
      { hpt: 15 },  // Spacer
      { hpt: 25 },  // Header row
    ];
    
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    
    // Apply branding and title styles
    if (ws['A1']) ws['A1'].s = brandingStyle;
    if (ws['H1']) ws['H1'].s = brandingStyle;
    if (ws['D1']) ws['D1'].s = titleStyle;
    if (ws['D2']) ws['D2'].s = subtitleStyle;
    
    // Apply header styles
    cols.slice(0, 8).forEach(col => {
      const cell = ws[`${col}4`];
      if (cell) cell.s = headerStyle;
    });
    
    // Apply data row styles with colour-coded Priority and Status
    for (let i = 0; i < filteredAndSortedActions.length; i++) {
      const rowNum = 5 + i;
      const action = filteredAndSortedActions[i];
      
      cols.slice(0, 8).forEach(col => {
        const cell = ws[`${col}${rowNum}`];
        if (cell) {
          if (col === 'F') {
            // Priority column - colour coded
            cell.s = priorityStyles[action.priority] || cellStyle;
          } else if (col === 'G') {
            // Status column - colour coded
            cell.s = statusStyles[action.status] || cellStyle;
          } else {
            cell.s = cellStyle;
          }
        }
      });
    }
    
    // Apply legend styles
    const legendRowNum = 5 + filteredAndSortedActions.length + 1;
    if (ws[`B${legendRowNum}`]) ws[`B${legendRowNum}`].s = legendLabelStyle;
    if (ws[`C${legendRowNum}`]) ws[`C${legendRowNum}`].s = legendHighStyle;
    if (ws[`D${legendRowNum}`]) ws[`D${legendRowNum}`].s = legendMediumStyle;
    if (ws[`E${legendRowNum}`]) ws[`E${legendRowNum}`].s = legendLowStyle;
    if (ws[`G${legendRowNum}`]) ws[`G${legendRowNum}`].s = legendLabelStyle;
    if (ws[`H${legendRowNum}`]) ws[`H${legendRowNum}`].s = legendOpenStyle;
    if (ws[`I${legendRowNum}`]) ws[`I${legendRowNum}`].s = legendClosedStyle;
    
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
