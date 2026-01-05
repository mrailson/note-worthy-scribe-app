import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { NRESBoardAction, CreateBoardActionData, UpdateBoardActionData } from "@/types/nresBoardActions";

export const useNRESBoardActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading, error } = useQuery({
    queryKey: ["nres-board-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nres_board_actions")
        .select("*")
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      return data as NRESBoardAction[];
    },
  });

  const createAction = useMutation({
    mutationFn: async (actionData: CreateBoardActionData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("nres_board_actions")
        .insert({
          ...actionData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nres-board-actions"] });
      toast({
        title: "Action created",
        description: "Board action has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create action: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, ...actionData }: UpdateBoardActionData) => {
      const { data, error } = await supabase
        .from("nres_board_actions")
        .update(actionData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nres-board-actions"] });
      toast({
        title: "Action updated",
        description: "Board action has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update action: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("nres_board_actions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nres-board-actions"] });
      toast({
        title: "Action deleted",
        description: "Board action has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete action: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Calculate stats
  const stats = {
    total: actions.length,
    pending: actions.filter((a) => a.status === "pending").length,
    inProgress: actions.filter((a) => a.status === "in-progress").length,
    completed: actions.filter((a) => a.status === "completed").length,
    overdue: actions.filter((a) => a.status === "overdue").length,
  };

  return {
    actions,
    isLoading,
    error,
    stats,
    createAction,
    updateAction,
    deleteAction,
  };
};
