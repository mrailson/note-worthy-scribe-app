import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { formatDistanceToNow } from "date-fns";
import { 
  Folder, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  File,
  Download,
  Trash2,
  Share,
  Edit,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SharedDriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  path: string;
}

interface SharedDriveFile {
  id: string;
  name: string;
  original_name: string;
  folder_id: string | null;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  mime_type: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface SharedDriveContentViewProps {
  folders: SharedDriveFolder[];
  files: SharedDriveFile[];
  selectedItems: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onNavigate: (folderId: string | null) => void;
  viewMode: "list" | "grid";
  isLoading: boolean;
  onRefresh: () => void;
}

export function SharedDriveContentView({
  folders,
  files,
  selectedItems,
  onSelectionChange,
  onNavigate,
  viewMode,
  isLoading,
  onRefresh
}: SharedDriveContentViewProps) {
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Get file icon based on type
  const getFileIcon = (fileType: string | null, mimeType: string | null) => {
    if (!fileType && !mimeType) return File;
    
    const type = (mimeType || fileType || "").toLowerCase();
    
    if (type.includes("image")) return FileImage;
    if (type.includes("video")) return FileVideo;
    if (type.includes("audio")) return FileAudio;
    if (type.includes("text") || type.includes("document")) return FileText;
    
    return File;
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Handle item selection
  const toggleSelection = (id: string, type: "folder" | "file") => {
    const itemId = `${type}-${id}`;
    const newSelected = new Set(selectedItems);
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    
    onSelectionChange(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    const allItems = new Set<string>();
    folders.forEach(folder => allItems.add(`folder-${folder.id}`));
    files.forEach(file => allItems.add(`file-${file.id}`));
    
    if (selectedItems.size === allItems.size) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(allItems);
    }
  };

  // Context menu actions
  const handleDownload = (file: SharedDriveFile) => {
    // Implementation for downloading file
    console.log("Download:", file);
  };

  const handleShare = (item: SharedDriveFolder | SharedDriveFile) => {
    // Implementation for sharing item
    console.log("Share:", item);
  };

  const handleRename = (item: SharedDriveFolder | SharedDriveFile) => {
    // Implementation for renaming item
    console.log("Rename:", item);
  };

  const handleDelete = (item: SharedDriveFolder | SharedDriveFile) => {
    // Implementation for deleting item
    console.log("Delete:", item);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-96">
        <div className="text-center">
          <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">This folder is empty</h3>
          <p className="text-muted-foreground mb-4">Start by uploading files or creating folders</p>
          <Button onClick={onRefresh} variant="outline">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="flex-1 p-4">
        <div className="grid grid-cols-6 gap-4">
          {folders.map((folder) => {
            const itemId = `folder-${folder.id}`;
            const isSelected = selectedItems.has(itemId);
            
            return (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "group relative p-4 rounded-lg border hover:bg-accent/50 cursor-pointer",
                      isSelected && "bg-accent border-primary"
                    )}
                    onClick={() => onNavigate(folder.id)}
                  >
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(folder.id, "folder")}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="text-center">
                      <Folder className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(folder.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleShare(folder)}>
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleRename(folder)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleDelete(folder)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          
          {files.map((file) => {
            const itemId = `file-${file.id}`;
            const isSelected = selectedItems.has(itemId);
            const FileIcon = getFileIcon(file.file_type, file.mime_type);
            
            return (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "group relative p-4 rounded-lg border hover:bg-accent/50 cursor-pointer",
                      isSelected && "bg-accent border-primary"
                    )}
                  >
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(file.id, "file")}
                      />
                    </div>
                    <div className="text-center">
                      <FileIcon className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleDownload(file)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleShare(file)}>
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleRename(file)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleDelete(file)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex-1">
      {/* Header */}
      <div className="border-b p-4">
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
          <div className="col-span-1 flex items-center">
            <Checkbox
              checked={selectedItems.size === folders.length + files.length && selectedItems.size > 0}
              onCheckedChange={handleSelectAll}
            />
          </div>
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Date Modified</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1">Size</div>
          <div className="col-span-1"></div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {folders.map((folder) => {
          const itemId = `folder-${folder.id}`;
          const isSelected = selectedItems.has(itemId);
          
          return (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    "grid grid-cols-12 gap-4 p-4 hover:bg-accent/50 cursor-pointer",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => onNavigate(folder.id)}
                >
                  <div className="col-span-1 flex items-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(folder.id, "folder")}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span className="truncate font-medium">{folder.name}</span>
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(folder.updated_at), { addSuffix: true })}
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                    Folder
                  </div>
                  <div className="col-span-1 flex items-center text-sm text-muted-foreground">
                    -
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleShare(folder)}>
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleRename(folder)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(folder)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {files.map((file) => {
          const itemId = `file-${file.id}`;
          const isSelected = selectedItems.has(itemId);
          const FileIcon = getFileIcon(file.file_type, file.mime_type);
          
          return (
            <ContextMenu key={file.id}>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    "grid grid-cols-12 gap-4 p-4 hover:bg-accent/50 cursor-pointer",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="col-span-1 flex items-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(file.id, "file")}
                    />
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })}
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                    {file.file_type?.toUpperCase() || "File"}
                  </div>
                  <div className="col-span-1 flex items-center text-sm text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleDownload(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleShare(file)}>
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleRename(file)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(file)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
}