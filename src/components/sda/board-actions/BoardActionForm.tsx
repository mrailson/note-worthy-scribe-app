import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, User, Calendar, FileText, Upload } from "lucide-react";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { BoardMemberSelect } from "./BoardMemberSelect";
import { BoardActionDocuments } from "./BoardActionDocuments";
import { useBoardActionDocuments } from "@/hooks/useBoardActionDocuments";
import type { NRESBoardAction, CreateBoardActionData, BoardActionStatus, BoardActionPriority } from "@/types/nresBoardActions";

interface BoardActionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateBoardActionData, files?: File[]) => void;
  editingAction?: NRESBoardAction | null;
  isLoading?: boolean;
}

export const BoardActionForm = ({
  open,
  onOpenChange,
  onSubmit,
  editingAction,
  isLoading,
}: BoardActionFormProps) => {
  const [formData, setFormData] = useState<CreateBoardActionData>({
    action_title: "",
    description: "",
    responsible_person: "",
    meeting_date: new Date().toISOString().split("T")[0],
    due_date: "",
    status: "pending",
    priority: "medium",
    notes: "",
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (editingAction) {
      setFormData({
        action_title: editingAction.action_title,
        description: editingAction.description || "",
        responsible_person: editingAction.responsible_person,
        meeting_date: editingAction.meeting_date,
        due_date: editingAction.due_date || "",
        status: editingAction.status,
        priority: editingAction.priority,
        notes: editingAction.notes || "",
      });
    } else {
      setFormData({
        action_title: "",
        description: "",
        responsible_person: "",
        meeting_date: new Date().toISOString().split("T")[0],
        due_date: "",
        status: "pending",
        priority: "medium",
        notes: "",
      });
    }
    setPendingFiles([]);
  }, [editingAction, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, pendingFiles);
  };

  const handleFileUpload = (files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl">
            {editingAction ? "Edit Board Action" : "Add Board Action"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Action Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              <span>ACTION DETAILS</span>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action_title">Action Title *</Label>
                <Input
                  id="action_title"
                  value={formData.action_title}
                  onChange={(e) => setFormData({ ...formData, action_title: e.target.value })}
                  placeholder="Enter action title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the action"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Assignment Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              <span>ASSIGNMENT</span>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="responsible_person">Responsible Person *</Label>
                <BoardMemberSelect
                  value={formData.responsible_person}
                  onChange={(value) => setFormData({ ...formData, responsible_person: value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meeting_date">Meeting Date *</Label>
                  <Input
                    id="meeting_date"
                    type="date"
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Select
                    value={formData.due_date === 'Ongoing' || formData.due_date === 'TBC' ? formData.due_date : 'specific'}
                    onValueChange={(value) => {
                      if (value === 'Ongoing' || value === 'TBC') {
                        setFormData({ ...formData, due_date: value });
                      } else {
                        setFormData({ ...formData, due_date: '' });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select deadline type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="specific">Specific Date</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                      <SelectItem value="TBC">TBC</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.due_date !== 'Ongoing' && formData.due_date !== 'TBC' && (
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="mt-2"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Status & Priority Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>STATUS & PRIORITY</span>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: BoardActionStatus) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: BoardActionPriority) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes & Documentation Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>NOTES & DOCUMENTATION</span>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or updates"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Supporting Documents</Label>
                <SimpleFileUpload
                  onFileUpload={handleFileUpload}
                  maxSize={10}
                  multiple
                  className="min-h-[100px]"
                />
                <BoardActionDocuments
                  actionId={editingAction?.id}
                  pendingFiles={pendingFiles}
                  onRemovePendingFile={handleRemovePendingFile}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : editingAction ? "Update Action" : "Add Action"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
