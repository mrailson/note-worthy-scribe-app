import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SharedDriveToolbar } from "@/components/shared-drive/SharedDriveToolbar";
import { SharedDriveNavigationPane } from "@/components/shared-drive/SharedDriveNavigationPane";
import { SharedDriveContentView } from "@/components/shared-drive/SharedDriveContentView";
import { SharedDriveBreadcrumb } from "@/components/shared-drive/SharedDriveBreadcrumb";
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
    searchParams.get("folder")
  );
  const [folders, setFolders] = useState<SharedDriveFolder[]>([]);
  const [files, setFiles] = useState<SharedDriveFile[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<SharedDriveFolder[]>([]);

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
  );
}