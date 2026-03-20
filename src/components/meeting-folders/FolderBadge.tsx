import { memo } from "react";
import { Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FolderBadgeProps {
  folderName: string;
  folderColour: string;
  onClick?: () => void;
}

export const FolderBadge = memo(({ folderName, folderColour, onClick }: FolderBadgeProps) => {
  return (
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-accent transition-colors"
      style={{
        borderColor: folderColour,
        color: folderColour,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Folder className="h-3 w-3 mr-1" />
      {folderName}
    </Badge>
  );
});

FolderBadge.displayName = "FolderBadge";
