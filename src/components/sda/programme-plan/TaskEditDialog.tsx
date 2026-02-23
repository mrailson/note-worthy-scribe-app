import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ProgrammeTask } from "@/types/sdaProgrammePlan";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProgrammeTask | null;
  onSave: (task: ProgrammeTask) => void;
}

const parseDDMMYY = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return undefined;
  let year = parseInt(parts[2]);
  if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
  return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
};

const formatDDMMYY = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear() % 100).padStart(2, "0");
  return `${d}/${m}/${y}`;
};

type TaskStatus = "pending" | "in-progress" | "done";

const getStatusFromProgress = (progress: number): TaskStatus => {
  if (progress === 100) return "done";
  if (progress > 0) return "in-progress";
  return "pending";
};

const getProgressFromStatus = (status: TaskStatus): number => {
  switch (status) {
    case "done": return 100;
    case "in-progress": return 50;
    case "pending": return 0;
  }
};

export const TaskEditDialog: React.FC<TaskEditDialogProps> = ({
  open,
  onOpenChange,
  task,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setName(task.name);
      setAssignedTo(task.assignedTo || "");
      setStartDate(parseDDMMYY(task.startDate));
      setEndDate(parseDDMMYY(task.endDate));
      setProgress(task.progress);
      setStatus(getStatusFromProgress(task.progress));
      setNotes(task.notes || "");
    }
  }, [task]);

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    setProgress(getProgressFromStatus(newStatus));
  };

  const handleProgressChange = (value: number) => {
    setProgress(value);
    setStatus(getStatusFromProgress(value));
  };

  const handleSave = () => {
    if (!task) return;
    onSave({
      ...task,
      name,
      assignedTo: assignedTo || undefined,
      startDate: startDate ? formatDDMMYY(startDate) : undefined,
      endDate: endDate ? formatDDMMYY(endDate) : undefined,
      progress,
      notes: notes || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[calc(100vh-8rem)] overflow-y-auto bg-white border shadow-xl rounded-xl">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 px-8 sm:px-10">
          <div className="grid gap-1.5">
            <Label htmlFor="task-name">Task Name</Label>
            <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="assigned-to">Assigned To</Label>
            <Input id="assigned-to" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal h-10", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal h-10", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Progress: {progress}%</Label>
              <Slider value={[progress]} onValueChange={(v) => handleProgressChange(v[0])} max={100} step={5} className="mt-2" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="px-8 sm:px-10 pb-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
