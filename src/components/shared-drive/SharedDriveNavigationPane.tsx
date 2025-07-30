import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2, Edit, Share } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface TreeNode extends SharedDriveFolder {
  children: TreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
}

interface SharedDriveNavigationPaneProps {
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onRefresh?: () => void;
}

export function SharedDriveNavigationPane({
  currentFolderId,
  onNavigate,
  onRefresh
}: SharedDriveNavigationPaneProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    folder: TreeNode | null;
    subfolderCount: number;
    fileCount: number;
  }>({
    isOpen: false,
    folder: null,
    subfolderCount: 0,
    fileCount: 0
  });

  // Check folder contents before deletion
  const checkFolderContents = async (folder: TreeNode) => {
    try {
      // Count subfolders
      const { data: subfolders, error: subfoldersError } = await supabase
        .from("shared_drive_folders")
        .select("id", { count: 'exact' })
        .eq("parent_id", folder.id);

      if (subfoldersError) throw subfoldersError;

      // Count files
      const { data: files, error: filesError } = await supabase
        .from("shared_drive_files")
        .select("id", { count: 'exact' })
        .eq("folder_id", folder.id);

      if (filesError) throw filesError;

      const subfolderCount = subfolders?.length || 0;
      const fileCount = files?.length || 0;

      setDeleteDialog({
        isOpen: true,
        folder,
        subfolderCount,
        fileCount
      });
    } catch (error) {
      console.error("Error checking folder contents:", error);
      toast.error("Failed to check folder contents");
    }
  };

  // Handle folder deletion with confirmation
  const handleDeleteFolder = async () => {
    if (!deleteDialog.folder) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const folder = deleteDialog.folder;

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

      toast.success(`Folder "${folder.name}" deleted successfully`);
      
      // Close dialog
      setDeleteDialog({ isOpen: false, folder: null, subfolderCount: 0, fileCount: 0 });
      
      // Refresh the navigation tree
      loadRootFolders();
      
      // If we're currently in the deleted folder, navigate to parent
      if (currentFolderId === folder.id) {
        onNavigate(folder.parent_id);
      }
      
      // Also refresh the main content area
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  };

  // Load root folders
  const loadRootFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("shared_drive_folders")
        .select("*")
        .is("parent_id", null)
        .order("name");

      if (error) throw error;

      const rootNodes: TreeNode[] = (data || []).map(folder => ({
        ...folder,
        children: [],
        isExpanded: false,
        isLoading: false
      }));

      setTree(rootNodes);
    } catch (error) {
      console.error("Error loading root folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load children for a specific folder
  const loadChildren = async (parentId: string): Promise<TreeNode[]> => {
    try {
      const { data, error } = await supabase
        .from("shared_drive_folders")
        .select("*")
        .eq("parent_id", parentId)
        .order("name");

      if (error) throw error;

      return (data || []).map(folder => ({
        ...folder,
        children: [],
        isExpanded: false,
        isLoading: false
      }));
    } catch (error) {
      console.error("Error loading children:", error);
      return [];
    }
  };

  // Toggle folder expansion
  const toggleFolder = async (folderId: string) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === folderId) {
          if (!node.isExpanded && node.children.length === 0) {
            // Load children first
            return { ...node, isLoading: true };
          }
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    setTree(updateNode(tree));

    // Load children if needed
    const targetNode = findNode(tree, folderId);
    if (targetNode && !targetNode.isExpanded && targetNode.children.length === 0) {
      const children = await loadChildren(folderId);
      
      const updateWithChildren = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.id === folderId) {
            return { 
              ...node, 
              children, 
              isExpanded: true, 
              isLoading: false 
            };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateWithChildren(node.children) };
          }
          return node;
        });
      };

      setTree(updateWithChildren(tree));
    }
  };

  // Find a node in the tree
  const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Check if a folder is currently selected
  const isSelected = (folderId: string) => folderId === currentFolderId;

  // Render tree node
  const renderNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const canExpand = hasChildren || !node.isExpanded; // Assume folders might have children

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-left h-8 px-2",
                isSelected(node.id) && "bg-accent text-accent-foreground",
                "hover:bg-accent/50"
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => onNavigate(node.id)}
            >
              <div className="flex items-center gap-1 w-full">
                {canExpand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(node.id);
                    }}
                  >
                    {node.isLoading ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    ) : node.isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                )}
                {!canExpand && <div className="w-4" />}
                
                {node.isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
                
                <span className="truncate flex-1 text-sm">{node.name}</span>
              </div>
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => console.log("Share:", node)}>
              <Share className="h-4 w-4 mr-2" />
              Share
            </ContextMenuItem>
            <ContextMenuItem onClick={() => console.log("Rename:", node)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => checkFolderContents(node)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        
        {node.isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    loadRootFolders();
  }, []);

  return (
    <>
      <div className="w-64 border-r bg-muted/30">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Folders</h3>
        </div>
        
        <ScrollArea className="h-[600px]">
          <div className="p-2">
            {/* Root/Home folder */}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-left h-8 px-2 mb-1",
                currentFolderId === null && "bg-accent text-accent-foreground",
                "hover:bg-accent/50"
              )}
              onClick={() => onNavigate(null)}
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Shared Drive</span>
              </div>
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-1">
                {tree.map(node => renderNode(node))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.isOpen} 
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, folder: null, subfolderCount: 0, fileCount: 0 })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete the folder <strong>"{deleteDialog.folder?.name}"</strong>?
              </p>
              
              {(deleteDialog.subfolderCount > 0 || deleteDialog.fileCount > 0) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                  <p className="font-semibold text-destructive mb-2">⚠️ Warning: This folder contains:</p>
                  <ul className="text-sm space-y-1 text-destructive">
                    {deleteDialog.subfolderCount > 0 && (
                      <li>• {deleteDialog.subfolderCount} subfolder{deleteDialog.subfolderCount > 1 ? 's' : ''}</li>
                    )}
                    {deleteDialog.fileCount > 0 && (
                      <li>• {deleteDialog.fileCount} file{deleteDialog.fileCount > 1 ? 's' : ''}</li>
                    )}
                  </ul>
                  <p className="font-semibold text-destructive mt-2">
                    All contents will be permanently deleted and cannot be recovered.
                  </p>
                </div>
              )}
              
              {deleteDialog.subfolderCount === 0 && deleteDialog.fileCount === 0 && (
                <p className="text-muted-foreground">This folder is empty and will be permanently deleted.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
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