import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BoardActionDocument } from "@/types/boardMembers";

export const useBoardActionDocuments = (actionId?: string) => {
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["board-action-documents", actionId],
    queryFn: async () => {
      if (!actionId) return [];
      
      const { data, error } = await supabase
        .from("nres_board_action_documents")
        .select("*")
        .eq("action_id", actionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BoardActionDocument[];
    },
    enabled: !!actionId,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ actionId, file }: { actionId: string; file: File }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${userData.user.id}/${actionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("board-action-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("nres_board_action_documents")
        .insert({
          action_id: actionId,
          user_id: userData.user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-action-documents"] });
      toast.success("Document uploaded");
    },
    onError: (error) => {
      toast.error("Failed to upload document");
      console.error(error);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: BoardActionDocument) => {
      const { error: storageError } = await supabase.storage
        .from("board-action-documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("nres_board_action_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-action-documents"] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete document");
      console.error(error);
    },
  });

  const getDocumentUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from("board-action-documents")
      .createSignedUrl(filePath, 3600);
    
    return data?.signedUrl;
  };

  return {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
  };
};
