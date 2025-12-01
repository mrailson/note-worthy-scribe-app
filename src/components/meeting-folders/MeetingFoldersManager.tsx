import { useState } from "react";
import { useMeetingFolders, MeetingFolder } from "@/hooks/useMeetingFolders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, Plus, Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MeetingFoldersManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MeetingFoldersManager = ({ open, onOpenChange }: MeetingFoldersManagerProps) => {
  const { folders, loading, createFolder, updateFolder, deleteFolder } = useMeetingFolders();
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MeetingFolder | null>(null);
  
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColour, setFolderColour] = useState("#3b82f6");
  const [nameError, setNameError] = useState("");

  const predefinedColours = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#10b981" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Orange", value: "#f97316" },
    { name: "Pink", value: "#ec4899" },
    { name: "Red", value: "#ef4444" },
    { name: "Yellow", value: "#eab308" },
    { name: "Teal", value: "#14b8a6" },
  ];

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    
    // Check for duplicate name
    const duplicate = folders.find(f => f.name.toLowerCase() === folderName.trim().toLowerCase());
    if (duplicate) {
      setNameError("A folder with this name already exists");
      return;
    }
    
    const result = await createFolder(folderName, folderDescription, folderColour);
    if (result) {
      resetForm();
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderName.trim()) return;
    
    // Check for duplicate name (excluding current folder)
    const duplicate = folders.find(f => 
      f.id !== editingFolder.id && f.name.toLowerCase() === folderName.trim().toLowerCase()
    );
    if (duplicate) {
      setNameError("A folder with this name already exists");
      return;
    }
    
    const result = await updateFolder(editingFolder.id, {
      name: folderName,
      description: folderDescription,
      colour: folderColour,
    });
    
    if (result) {
      resetForm();
    }
  };

  const handleDeleteFolder = async (folder: MeetingFolder) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${folder.name}"? Meetings in this folder will not be deleted, just unfiled.`
    );
    if (!confirmed) return;

    await deleteFolder(folder.id);
  };

  const startEditing = (folder: MeetingFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || "");
    setFolderColour(folder.colour);
    setIsCreating(true);
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingFolder(null);
    setFolderName("");
    setFolderDescription("");
    setFolderColour("#3b82f6");
    setNameError("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Manage Folders</DialogTitle>
            <DialogDescription>
              Create and organise folders to categorise your meetings
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] pr-4">
            {!isCreating ? (
              <div className="space-y-4">
                <Button
                  onClick={() => setIsCreating(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Folder
                </Button>

                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading folders...</div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No folders yet. Create your first folder to organise meetings.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Folder
                            className="h-5 w-5"
                            style={{ color: folder.colour }}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{folder.name}</div>
                            {folder.description && (
                              <div className="text-sm text-muted-foreground">{folder.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(folder)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFolder(folder)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="folder-name">Folder Name</Label>
                  <Input
                    id="folder-name"
                    placeholder="e.g., PCN Board Meetings"
                    value={folderName}
                    onChange={(e) => {
                      setFolderName(e.target.value);
                      setNameError("");
                    }}
                    className={nameError ? "border-destructive" : ""}
                  />
                  {nameError && (
                    <p className="text-sm text-destructive">{nameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="folder-description">Description (Optional)</Label>
                  <Textarea
                    id="folder-description"
                    placeholder="Brief description of this folder..."
                    value={folderDescription}
                    onChange={(e) => setFolderDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Folder Colour</Label>
                  <div className="flex gap-2 flex-wrap">
                    {predefinedColours.map((colour) => (
                      <button
                        key={colour.value}
                        type="button"
                        className={`w-10 h-10 rounded-md border-2 transition-all ${
                          folderColour === colour.value
                            ? "border-foreground scale-110"
                            : "border-border hover:scale-105"
                        }`}
                        style={{ backgroundColor: colour.value }}
                        onClick={() => setFolderColour(colour.value)}
                        title={colour.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                    className="flex-1"
                    disabled={!folderName.trim()}
                  >
                    {editingFolder ? "Update" : "Create"} Folder
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </>
  );
};
