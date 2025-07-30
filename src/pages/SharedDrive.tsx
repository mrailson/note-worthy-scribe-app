import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SharedDriveToolbar } from "@/components/shared-drive/SharedDriveToolbar";
import { SharedDriveNavigationPane } from "@/components/shared-drive/SharedDriveNavigationPane";
import { SharedDriveContentView } from "@/components/shared-drive/SharedDriveContentView";
import { SharedDriveBreadcrumb } from "@/components/shared-drive/SharedDriveBreadcrumb";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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

export default function SharedDrive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    searchParams.get("folder") || null
  );
  const [folders, setFolders] = useState<SharedDriveFolder[]>([]);
  const [files, setFiles] = useState<SharedDriveFile[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<SharedDriveFolder[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    folderCount: number;
    fileCount: number;
    totalSubfolders: number;
    totalFiles: number;
  }>({
    isOpen: false,
    folderCount: 0,
    fileCount: 0,
    totalSubfolders: 0,
    totalFiles: 0
  });

  // Load folders and files for current directory
  const loadCurrentDirectory = async () => {
    setIsLoading(true);
    try {
      // Load folders
      const { data: foldersData, error: foldersError } = await supabase
        .from("shared_drive_folders")
        .select("*")
        .eq("parent_id", currentFolderId)
        .order("name");

      if (foldersError) throw foldersError;

      // Load files
      const { data: filesData, error: filesError } = await supabase
        .from("shared_drive_files")
        .select("*")
        .eq("folder_id", currentFolderId)
        .order("name");

      if (filesError) throw filesError;

      setFolders(foldersData || []);
      setFiles(filesData || []);

      // Load current path for breadcrumb
      if (currentFolderId) {
        await loadBreadcrumbPath(currentFolderId);
      } else {
        setCurrentPath([]);
      }
    } catch (error) {
      console.error("Error loading directory:", error);
      toast.error("Failed to load directory contents");
    } finally {
      setIsLoading(false);
    }
  };

  // Load breadcrumb path
  const loadBreadcrumbPath = async (folderId: string) => {
    try {
      const path: SharedDriveFolder[] = [];
      let currentId = folderId;

      while (currentId) {
        const { data, error } = await supabase
          .from("shared_drive_folders")
          .select("*")
          .eq("id", currentId)
          .single();

        if (error) throw error;
        
        path.unshift(data);
        currentId = data.parent_id;
      }

      setCurrentPath(path);
    } catch (error) {
      console.error("Error loading breadcrumb path:", error);
    }
  };

  // Handle folder navigation
  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedItems(new Set());
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  // Handle creating new folder
  const createFolder = async (name: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Check if folder name already exists in current directory
      const { data: existingFolders, error: checkError } = await supabase
        .from("shared_drive_folders")
        .select("name")
        .eq("parent_id", currentFolderId)
        .eq("name", name);

      if (checkError) throw checkError;

      if (existingFolders && existingFolders.length > 0) {
        toast.error("A folder with this name already exists");
        return;
      }

      const folderPath = currentPath.length > 0 
        ? `${currentPath.map(f => f.name).join("/")}/${name}`
        : name;

      const { error } = await supabase
        .from("shared_drive_folders")
        .insert({
          name,
          parent_id: currentFolderId,
          created_by: user.user.id,
          path: folderPath
        });

      if (error) throw error;

      toast.success("Folder created successfully");
      loadCurrentDirectory();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    }
  };

  // Handle file upload
  const uploadFiles = async (files: FileList) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const uploads = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.user.id}/${Date.now()}.${fileExt}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("shared-drive")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save file metadata
        const { error: dbError } = await supabase
          .from("shared_drive_files")
          .insert({
            name: file.name,
            original_name: file.name,
            folder_id: currentFolderId,
            file_path: fileName,
            file_size: file.size,
            file_type: fileExt,
            mime_type: file.type,
            created_by: user.user.id
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploads);
      toast.success(`${files.length} file(s) uploaded successfully`);
      loadCurrentDirectory();
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    }
  };

  // Check contents before bulk delete
  const checkSelectedItemsForDeletion = async () => {
    try {
      // Parse selected items to get actual IDs
      const selectedFolderIds: string[] = [];
      const selectedFileIds: string[] = [];
      
      selectedItems.forEach(itemId => {
        if (itemId.startsWith('folder-')) {
          selectedFolderIds.push(itemId.replace('folder-', ''));
        } else if (itemId.startsWith('file-')) {
          selectedFileIds.push(itemId.replace('file-', ''));
        }
      });

      let totalSubfolders = 0;
      let totalFiles = 0;

      // Count subfolders and files within selected folders
      for (const folderId of selectedFolderIds) {
        // Count direct subfolders
        const { data: subfolders, error: subfoldersError } = await supabase
          .from("shared_drive_folders")
          .select("id", { count: 'exact' })
          .eq("parent_id", folderId);

        if (subfoldersError) throw subfoldersError;

        // Count direct files
        const { data: files, error: filesError } = await supabase
          .from("shared_drive_files")
          .select("id", { count: 'exact' })
          .eq("folder_id", folderId);

        if (filesError) throw filesError;

        totalSubfolders += subfolders?.length || 0;
        totalFiles += files?.length || 0;
      }

      setDeleteDialog({
        isOpen: true,
        folderCount: selectedFolderIds.length,
        fileCount: selectedFileIds.length,
        totalSubfolders,
        totalFiles
      });
    } catch (error) {
      console.error("Error checking selected items:", error);
      toast.error("Failed to check folder contents");
    }
  };

  // Handle deleting selected items with confirmation
  const deleteSelectedItems = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Parse selected items to get actual IDs
      const selectedFolderIds: string[] = [];
      const selectedFileIds: string[] = [];
      
      selectedItems.forEach(itemId => {
        if (itemId.startsWith('folder-')) {
          selectedFolderIds.push(itemId.replace('folder-', ''));
        } else if (itemId.startsWith('file-')) {
          selectedFileIds.push(itemId.replace('file-', ''));
        }
      });

      const selectedFolders = folders.filter(folder => selectedFolderIds.includes(folder.id));
      const selectedFiles = files.filter(file => selectedFileIds.includes(file.id));

      // Delete folders
      for (const folder of selectedFolders) {
        // First delete all files in the folder from storage
        const { data: folderFiles } = await supabase
          .from("shared_drive_files")
          .select("file_path")
          .eq("folder_id", folder.id);

        if (folderFiles && folderFiles.length > 0) {
          const filePaths = folderFiles.map(f => f.file_path);
          await supabase.storage
            .from("shared-drive")
            .remove(filePaths);
        }

        // Delete folder and its contents from database (cascading)
        const { error: folderError } = await supabase
          .from("shared_drive_folders")
          .delete()
          .eq("id", folder.id);

        if (folderError) throw folderError;
      }

      // Delete files
      for (const file of selectedFiles) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("shared-drive")
          .remove([file.file_path]);

        if (storageError) throw storageError;

        // Delete from database
        const { error: dbError } = await supabase
          .from("shared_drive_files")
          .delete()
          .eq("id", file.id);

        if (dbError) throw dbError;
      }

      toast.success(`${selectedItems.size} item(s) deleted successfully`);
      setSelectedItems(new Set());
      setDeleteDialog({ isOpen: false, folderCount: 0, fileCount: 0, totalSubfolders: 0, totalFiles: 0 });
      loadCurrentDirectory();
    } catch (error) {
      console.error("Error deleting items:", error);
      toast.error("Failed to delete items");
    }
  };

  // Handle downloading selected items
  const downloadSelectedItems = async () => {
    try {
      // Parse selected items to get actual file IDs
      const selectedFileIds: string[] = [];
      
      selectedItems.forEach(itemId => {
        if (itemId.startsWith('file-')) {
          selectedFileIds.push(itemId.replace('file-', ''));
        }
      });

      const selectedFiles = files.filter(file => selectedFileIds.includes(file.id));
      
      for (const file of selectedFiles) {
        const { data, error } = await supabase.storage
          .from("shared-drive")
          .download(file.file_path);

        if (error) throw error;

        // Create download link
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.original_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      if (selectedFiles.length > 0) {
        toast.success(`${selectedFiles.length} file(s) downloaded`);
      } else {
        toast.error("No files selected for download");
      }
    } catch (error) {
      console.error("Error downloading files:", error);
      toast.error("Failed to download files");
    }
  };

  // Filter items based on search
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    loadCurrentDirectory();
  }, [currentFolderId]);

  return (
    <>
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Shared Drive</h1>
            <p className="text-muted-foreground">
              Organize and share files with your team using familiar file explorer interface
            </p>
          </div>

          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            {/* Toolbar */}
            <SharedDriveToolbar
              onCreateFolder={createFolder}
              onUploadFiles={uploadFiles}
              onSearch={setSearchQuery}
              searchQuery={searchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedCount={selectedItems.size}
              onDownloadSelected={downloadSelectedItems}
              onDeleteSelected={checkSelectedItemsForDeletion}
            />

            {/* Breadcrumb */}
            <SharedDriveBreadcrumb
              path={currentPath}
              onNavigate={navigateToFolder}
            />

            <div className="flex">
              {/* Navigation Pane */}
              <SharedDriveNavigationPane
                currentFolderId={currentFolderId}
                onNavigate={navigateToFolder}
                onRefresh={loadCurrentDirectory}
              />

              {/* Content View */}
              <div className="flex-1 border-l">
                <SharedDriveContentView
                  folders={filteredFolders}
                  files={filteredFiles}
                  selectedItems={selectedItems}
                  onSelectionChange={setSelectedItems}
                  onNavigate={navigateToFolder}
                  viewMode={viewMode}
                  isLoading={isLoading}
                  onRefresh={loadCurrentDirectory}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.isOpen} 
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, folderCount: 0, fileCount: 0, totalSubfolders: 0, totalFiles: 0 })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete the selected items?
              </p>
              
              <div className="bg-muted rounded-md p-3 mt-3">
                <p className="font-semibold mb-2">Selected items:</p>
                <ul className="text-sm space-y-1">
                  {deleteDialog.folderCount > 0 && (
                    <li>• {deleteDialog.folderCount} folder{deleteDialog.folderCount > 1 ? 's' : ''}</li>
                  )}
                  {deleteDialog.fileCount > 0 && (
                    <li>• {deleteDialog.fileCount} file{deleteDialog.fileCount > 1 ? 's' : ''}</li>
                  )}
                </ul>
              </div>

              {(deleteDialog.totalSubfolders > 0 || deleteDialog.totalFiles > 0) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                  <p className="font-semibold text-destructive mb-2">⚠️ Warning: Selected folders contain:</p>
                  <ul className="text-sm space-y-1 text-destructive">
                    {deleteDialog.totalSubfolders > 0 && (
                      <li>• {deleteDialog.totalSubfolders} additional subfolder{deleteDialog.totalSubfolders > 1 ? 's' : ''}</li>
                    )}
                    {deleteDialog.totalFiles > 0 && (
                      <li>• {deleteDialog.totalFiles} additional file{deleteDialog.totalFiles > 1 ? 's' : ''}</li>
                    )}
                  </ul>
                  <p className="font-semibold text-destructive mt-2">
                    All contents will be permanently deleted and cannot be recovered.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedItems}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}