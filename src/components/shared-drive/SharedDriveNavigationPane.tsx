import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
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

interface TreeNode extends SharedDriveFolder {
  children: TreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
}

interface SharedDriveNavigationPaneProps {
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

export function SharedDriveNavigationPane({
  currentFolderId,
  onNavigate
}: SharedDriveNavigationPaneProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  );
}