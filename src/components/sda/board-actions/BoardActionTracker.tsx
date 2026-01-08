import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Loader2 } from "lucide-react";
import { useNRESBoardActions } from "@/hooks/useNRESBoardActions";
import { useBoardActionDocuments } from "@/hooks/useBoardActionDocuments";
import { BoardActionForm } from "./BoardActionForm";
import { BoardActionsTable } from "./BoardActionsTable";
import type { NRESBoardAction, CreateBoardActionData } from "@/types/nresBoardActions";

export const BoardActionTracker = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<NRESBoardAction | null>(null);

  const {
    actions,
    isLoading,
    stats,
    createAction,
    updateAction,
    deleteAction,
  } = useNRESBoardActions();

  const { uploadDocument } = useBoardActionDocuments();

  const handleSubmit = async (data: CreateBoardActionData, files?: File[]) => {
    if (editingAction) {
      updateAction.mutate(
        { id: editingAction.id, ...data },
        {
          onSuccess: async () => {
            // Upload any pending files for existing action
            if (files && files.length > 0) {
              for (const file of files) {
                await uploadDocument.mutateAsync({ actionId: editingAction.id, file });
              }
            }
            setFormOpen(false);
            setEditingAction(null);
          },
        }
      );
    } else {
      createAction.mutate(data, {
        onSuccess: async (newAction) => {
          // Upload any pending files for new action
          if (files && files.length > 0 && newAction?.id) {
            for (const file of files) {
              await uploadDocument.mutateAsync({ actionId: newAction.id, file });
            }
          }
          setFormOpen(false);
        },
      });
    }
  };

  const handleEdit = (action: NRESBoardAction) => {
    setEditingAction(action);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this action?")) {
      deleteAction.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingAction(null);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#005EB8]" />
          <CardTitle className="text-lg font-semibold">NRES New Models Pilot Schedule</CardTitle>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Action
        </Button>
      </CardHeader>
      <CardContent>
        {/* Stats badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="py-1">
            Total: {stats.total}
          </Badge>
          <Badge variant="secondary" className="py-1">
            Pending: {stats.pending}
          </Badge>
          <Badge variant="default" className="py-1 bg-[#005EB8]">
            In Progress: {stats.inProgress}
          </Badge>
          <Badge variant="outline" className="py-1 border-green-500 text-green-700 dark:text-green-400">
            Completed: {stats.completed}
          </Badge>
          {stats.overdue > 0 && (
            <Badge variant="destructive" className="py-1">
              Overdue: {stats.overdue}
            </Badge>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <BoardActionsTable
            actions={actions}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {/* Form modal */}
        <BoardActionForm
          open={formOpen}
          onOpenChange={handleOpenChange}
          onSubmit={handleSubmit}
          editingAction={editingAction}
          isLoading={createAction.isPending || updateAction.isPending}
        />
      </CardContent>
    </Card>
  );
};
