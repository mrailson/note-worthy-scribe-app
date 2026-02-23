import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { ActionLogItem } from "@/data/nresBoardActionsData";
import { PersonSelect } from "./PersonSelect";

interface ActionLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ActionLogItem | null; // null = adding new
  nextId: string;
  onSave: (item: ActionLogItem) => void;
}

const parseDDMMYYYY = (str: string): Date | undefined => {
  try {
    return parse(str, "dd/MM/yyyy", new Date());
  } catch {
    return undefined;
  }
};

const formatDDMMYYYY = (date: Date): string => format(date, "dd/MM/yyyy");

export const ActionLogEditDialog: React.FC<ActionLogEditDialogProps> = ({
  open,
  onOpenChange,
  item,
  nextId,
  onSave,
}) => {
  const isEditing = !!item;

  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [dateRaised, setDateRaised] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<ActionLogItem["priority"]>("Medium");
  const [status, setStatus] = useState<ActionLogItem["status"]>("Open");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (item) {
        setDescription(item.description);
        setOwner(item.owner);
        setDateRaised(parseDDMMYYYY(item.dateRaised));
        setDueDate(parseDDMMYYYY(item.dueDate));
        setPriority(item.priority);
        setStatus(item.status);
        setNotes(item.notes);
      } else {
        setDescription("");
        setOwner("");
        setDateRaised(new Date());
        setDueDate(undefined);
        setPriority("Medium");
        setStatus("Open");
        setNotes("");
      }
    }
  }, [open, item]);

  const handleSave = () => {
    if (!description.trim()) return;
    onSave({
      actionId: item?.actionId ?? nextId,
      description: description.trim(),
      owner: owner.trim(),
      dateRaised: dateRaised ? formatDDMMYYYY(dateRaised) : format(new Date(), "dd/MM/yyyy"),
      dueDate: dueDate ? formatDDMMYYYY(dueDate) : "",
      priority,
      status,
      notes: notes.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[calc(100vh-8rem)] bg-white overflow-y-auto border shadow-xl rounded-xl">
        <DialogHeader className="px-8 sm:px-10 pt-2">
          <DialogTitle>{isEditing ? `Edit Action ${item.actionId}` : "Add New Action"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the action item details below." : `This will be assigned Action ID ${nextId}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 sm:px-10 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <PersonSelect value={owner} onChange={setOwner} placeholder="Select owner" />
            </div>
            <div className="space-y-1.5">
              <Label>Date Raised</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dateRaised && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRaised ? format(dateRaised, "dd/MM/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateRaised} onSelect={setDateRaised} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ActionLogItem["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ActionLogItem["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or updates"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="px-8 sm:px-10 pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!description.trim()}>
            {isEditing ? "Save Changes" : "Add Action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
