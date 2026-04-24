import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * NRES Worklists — practice-scoped clinical worklists for Population Risk
 * cohorts. Patients are tracked by their stable `fk_patient_link_id` so that
 * re-imports of the NARP export update each item's change-flag automatically
 * via the database trigger `flag_worklist_changes_on_new_export`.
 */

export type WorklistStatus = "open" | "closed";
export type ItemReviewStatus = "pending" | "reviewed" | "excluded";
export type ItemChangeFlag = "unchanged" | "improved" | "escalated" | "left_practice";

export interface NarpWorklist {
  id: string;
  practice_id: string;
  title: string;
  description: string | null;
  status: WorklistStatus;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  source_export_id: string | null;
  cohort_label: string | null;
}

export interface NarpWorklistItem {
  id: string;
  worklist_id: string;
  fk_patient_link_id: string;
  added_at: string;
  added_by: string;
  added_risk_tier: string | null;
  added_poa: number | null;
  added_polos: number | null;
  added_drug_count: number | null;
  added_frailty_category: string | null;
  added_export_id: string | null;
  review_status: ItemReviewStatus;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  reviewed_via_meeting_id: string | null;
  notes: string | null;
  change_flag: ItemChangeFlag;
  change_flag_updated_at: string | null;
  latest_risk_tier: string | null;
  latest_poa: number | null;
  created_at: string;
  updated_at: string;
}

export interface NarpWorklistMeetingLink {
  id: string;
  worklist_id: string;
  meeting_id: string;
  linked_at: string;
  linked_by: string;
  unlinked_at: string | null;
}

/* ───── List worklists for a practice ───── */
export function useNarpWorklists(practiceId: string | null | undefined, opts: { includeClosed?: boolean } = {}) {
  const { includeClosed = false } = opts;
  return useQuery({
    queryKey: ["narp-worklists", practiceId, includeClosed],
    queryFn: async (): Promise<NarpWorklist[]> => {
      if (!practiceId) return [];
      let q = supabase
        .from("narp_worklists")
        .select("*")
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false });
      if (!includeClosed) q = q.eq("status", "open");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NarpWorklist[];
    },
    enabled: !!practiceId,
    staleTime: 15_000,
  });
}

/* ───── Items for a single worklist ───── */
export function useNarpWorklistItems(worklistId: string | null | undefined) {
  return useQuery({
    queryKey: ["narp-worklist-items", worklistId],
    queryFn: async (): Promise<NarpWorklistItem[]> => {
      if (!worklistId) return [];
      const { data, error } = await supabase
        .from("narp_worklist_items")
        .select("*")
        .eq("worklist_id", worklistId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NarpWorklistItem[];
    },
    enabled: !!worklistId,
    staleTime: 10_000,
  });
}

/* ───── Linked meetings for a single worklist ───── */
export function useNarpWorklistMeetings(worklistId: string | null | undefined) {
  return useQuery({
    queryKey: ["narp-worklist-meetings", worklistId],
    queryFn: async () => {
      if (!worklistId) return [];
      const { data: links, error } = await supabase
        .from("narp_worklist_meeting_links")
        .select("*")
        .eq("worklist_id", worklistId)
        .is("unlinked_at", null);
      if (error) throw error;
      const linkRows = (links ?? []) as NarpWorklistMeetingLink[];
      if (!linkRows.length) return [];
      const meetingIds = linkRows.map((l) => l.meeting_id);
      const { data: meetings, error: mErr } = await supabase
        .from("meetings")
        .select("id, title, start_time, status")
        .in("id", meetingIds);
      if (mErr) throw mErr;
      return linkRows.map((l) => ({
        link: l,
        meeting: (meetings ?? []).find((m) => m.id === l.meeting_id) ?? null,
      }));
    },
    enabled: !!worklistId,
    staleTime: 10_000,
  });
}

/* ───── Create worklist ───── */
export interface CreateWorklistInput {
  practice_id: string;
  title: string;
  description?: string;
  cohort_label?: string;
  source_export_id?: string | null;
}

export function useCreateWorklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorklistInput): Promise<NarpWorklist> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("narp_worklists")
        .insert({
          practice_id: input.practice_id,
          title: input.title,
          description: input.description ?? null,
          cohort_label: input.cohort_label ?? null,
          source_export_id: input.source_export_id ?? null,
          created_by: auth.user.id,
          created_by_email: auth.user.email ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as NarpWorklist;
    },
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["narp-worklists", w.practice_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not create worklist"),
  });
}

/* ───── Add patients to a worklist ───── */
export interface AddPatientsInput {
  worklist_id: string;
  patients: Array<{
    fk_patient_link_id: string;
    added_risk_tier?: string | null;
    added_poa?: number | null;
    added_polos?: number | null;
    added_drug_count?: number | null;
    added_frailty_category?: string | null;
    added_export_id?: string | null;
  }>;
}

export function useAddPatientsToWorklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ worklist_id, patients }: AddPatientsInput) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      if (!patients.length) return { inserted: 0 };
      const rows = patients.map((p) => ({
        worklist_id,
        added_by: auth.user!.id,
        fk_patient_link_id: p.fk_patient_link_id,
        added_risk_tier: p.added_risk_tier ?? null,
        added_poa: p.added_poa ?? null,
        added_polos: p.added_polos ?? null,
        added_drug_count: p.added_drug_count ?? null,
        added_frailty_category: p.added_frailty_category ?? null,
        added_export_id: p.added_export_id ?? null,
      }));
      // Upsert on (worklist_id, fk_patient_link_id) so re-adding is idempotent.
      const { data, error } = await supabase
        .from("narp_worklist_items")
        .upsert(rows, { onConflict: "worklist_id,fk_patient_link_id", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return { inserted: data?.length ?? 0 };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklist-items", vars.worklist_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not add patients"),
  });
}

/* ───── Update an item (review status, notes, etc.) ───── */
export interface UpdateItemInput {
  id: string;
  worklist_id: string;
  review_status?: ItemReviewStatus;
  notes?: string | null;
  reviewed_via_meeting_id?: string | null;
}

export function useUpdateWorklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateItemInput) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const patch: Record<string, unknown> = {};
      if (input.review_status !== undefined) {
        patch.review_status = input.review_status;
        if (input.review_status === "reviewed") {
          patch.reviewed_at = new Date().toISOString();
          patch.reviewed_by = auth.user.id;
          patch.reviewed_by_email = auth.user.email ?? null;
        } else if (input.review_status === "pending") {
          patch.reviewed_at = null;
          patch.reviewed_by = null;
          patch.reviewed_by_email = null;
          patch.reviewed_via_meeting_id = null;
        }
      }
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.reviewed_via_meeting_id !== undefined) patch.reviewed_via_meeting_id = input.reviewed_via_meeting_id;
      const { error } = await supabase
        .from("narp_worklist_items")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklist-items", vars.worklist_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not update item"),
  });
}

/* ───── Tick patients reviewed via a linked meeting ───── */
export function useTickPatientsViaMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { worklist_id: string; meeting_id: string; item_ids: string[] }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      if (!input.item_ids.length) return { updated: 0 };
      const { error } = await supabase
        .from("narp_worklist_items")
        .update({
          review_status: "reviewed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user.id,
          reviewed_by_email: auth.user.email ?? null,
          reviewed_via_meeting_id: input.meeting_id,
        })
        .in("id", input.item_ids);
      if (error) throw error;
      return { updated: input.item_ids.length };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklist-items", vars.worklist_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not mark patients reviewed"),
  });
}

/* ───── Close / reopen a worklist ───── */
export function useSetWorklistStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; practice_id: string; status: WorklistStatus }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === "closed") {
        patch.closed_at = new Date().toISOString();
        patch.closed_by = auth.user.id;
      } else {
        patch.closed_at = null;
        patch.closed_by = null;
      }
      const { error } = await supabase
        .from("narp_worklists")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklists", vars.practice_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not change worklist status"),
  });
}

/* ───── Link / unlink a Notewell meeting ───── */
export function useLinkMeetingToWorklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { worklist_id: string; meeting_id: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("narp_worklist_meeting_links")
        .upsert(
          {
            worklist_id: input.worklist_id,
            meeting_id: input.meeting_id,
            linked_by: auth.user.id,
            unlinked_at: null,
          },
          { onConflict: "worklist_id,meeting_id" },
        );
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklist-meetings", vars.worklist_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not link meeting"),
  });
}

export function useUnlinkMeetingFromWorklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { worklist_id: string; link_id: string }) => {
      const { error } = await supabase
        .from("narp_worklist_meeting_links")
        .update({ unlinked_at: new Date().toISOString() })
        .eq("id", input.link_id);
      if (error) throw error;
      return input;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["narp-worklist-meetings", vars.worklist_id] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Could not unlink meeting"),
  });
}

/* ───── Recent meetings the user can pick from to link ───── */
export function useRecentUserMeetings(limit = 25) {
  return useQuery({
    queryKey: ["narp-worklist-recent-meetings", limit],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, start_time, status")
        .eq("user_id", auth.user.id)
        .order("start_time", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/* ───── Helper: derived counts for a worklist ───── */
export function useWorklistCounts(items: NarpWorklistItem[] | undefined) {
  return useMemo(() => {
    const list = items ?? [];
    const total = list.length;
    const reviewed = list.filter((i) => i.review_status === "reviewed").length;
    const excluded = list.filter((i) => i.review_status === "excluded").length;
    const pending = list.filter((i) => i.review_status === "pending").length;
    const escalated = list.filter((i) => i.change_flag === "escalated").length;
    const improved = list.filter((i) => i.change_flag === "improved").length;
    const left = list.filter((i) => i.change_flag === "left_practice").length;
    return { total, reviewed, excluded, pending, escalated, improved, left };
  }, [items]);
}
