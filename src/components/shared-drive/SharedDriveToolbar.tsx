import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FolderPlus, Upload, UploadCloud, Search, List, Grid, Download, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

interface SharedDriveToolbarProps {
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: FileList) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  selectedCount: number;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
}

export function SharedDriveToolbar({
  onCreateFolder,
  onUploadFiles,
  onSearch,
  searchQuery,
  viewMode,
  onViewModeChange,
  selectedCount,
  onDownloadSelected,
  onDeleteSelected
}: SharedDriveToolbarProps) {
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const fileList = new DataTransfer();
      acceptedFiles.forEach(file => fileList.items.add(file));
      onUploadFiles(fileList.files);
    },
    noClick: true,
    multiple: true
  });

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName("");
      setIsCreateFolderOpen(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onUploadFiles(event.target.files);
    }
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-b p-4 bg-muted/50",
        isDragActive && "bg-primary/10 border-primary/50"
      )}
    >
      <input {...getInputProps()} />
      
      {isDragActive && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <UploadCloud className="h-12 w-12 text-primary mx-auto mb-2" />
            <p className="text-lg font-semibold text-primary">Drop files here to upload</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* New Folder */}
          <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folder-name">Folder Name</Label>
                  <Input
                    id="folder-name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
                    Create Folder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Upload Files */}
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </Button>

          {/* Action buttons when items are selected */}
          {selectedCount > 0 && (
            <>
              <div className="h-6 w-px bg-border" />
              <Button variant="outline" size="sm" onClick={onDownloadSelected}>
                <Download className="h-4 w-4 mr-2" />
                Download ({selectedCount})
              </Button>
              <Button variant="outline" size="sm" onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedCount})
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("list")}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("grid")}
              className="rounded-l-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}