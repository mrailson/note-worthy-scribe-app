import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BoardMember, CreateBoardMemberData, UpdateBoardMemberData } from "@/types/boardMembers";

export const useBoardMembers = () => {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["board-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nres_board_members")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as BoardMember[];
    },
  });

  const activeMembers = members.filter(m => m.is_active);

  const groupedMembers = activeMembers.reduce((acc, member) => {
    const group = member.group_name || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(member);
    return acc;
  }, {} as Record<string, BoardMember[]>);

  const createMember = useMutation({
    mutationFn: async (data: CreateBoardMemberData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("nres_board_members").insert({
        ...data,
        user_id: userData.user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-members"] });
      toast.success("Board member added");
    },
    onError: (error) => {
      toast.error("Failed to add board member");
      console.error(error);
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...data }: UpdateBoardMemberData) => {
      const { error } = await supabase
        .from("nres_board_members")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-members"] });
      toast.success("Board member updated");
    },
    onError: (error) => {
      toast.error("Failed to update board member");
      console.error(error);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("nres_board_members")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-members"] });
      toast.success("Board member deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete board member");
      console.error(error);
    },
  });

  return {
    members,
    activeMembers,
    groupedMembers,
    isLoading,
    error,
    createMember,
    updateMember,
    deleteMember,
  };
};
