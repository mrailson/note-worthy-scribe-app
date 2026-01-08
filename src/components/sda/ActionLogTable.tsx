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

interface ActionLogTableProps {
  actions: ActionLogItem[];
}

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

export const ActionLogTable = ({ actions }: ActionLogTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold text-slate-700 w-[60px]">ID</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[90px]">Date</TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[200px]">Description</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[60px]">Owner</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[90px]">Due Date</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[80px]">Priority</TableHead>
            <TableHead className="font-semibold text-slate-700 w-[70px]">Status</TableHead>
            <TableHead className="font-semibold text-slate-700 min-w-[150px]">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action, index) => (
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
