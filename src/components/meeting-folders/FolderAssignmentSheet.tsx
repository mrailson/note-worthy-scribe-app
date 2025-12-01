import { Folder } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MeetingFolder {
  id: string;
  name: string;
  colour: string;
}

interface FolderAssignmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: MeetingFolder[];
  currentFolderId?: string | null;
  onAssign: (folderId: string | null) => void;
}

export function FolderAssignmentSheet({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onAssign,
}: FolderAssignmentSheetProps) {
  const handleAssign = (folderId: string | null) => {
    onAssign(folderId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>Assign to Folder</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100%-4rem)] mt-4">
          <div className="space-y-2 pb-4">
            <Button
              variant={!currentFolderId ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleAssign(null)}
            >
              <Folder className="h-4 w-4 mr-2" />
              None (Unfiled)
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant={currentFolderId === folder.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleAssign(folder.id)}
              >
                <Folder
                  className="h-4 w-4 mr-2"
                  style={{ color: folder.colour }}
                />
                {folder.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
