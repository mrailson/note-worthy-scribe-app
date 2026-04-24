import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ListChecks, ChevronRight, ArrowLeft, Plus, Lock, Unlock,
  ArrowUpRight, ArrowDownRight, UserMinus, Link2, Link2Off,
  CheckCircle2, Circle, Mic, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useNarpWorklists,
  useNarpWorklistItems,
  useNarpWorklistMeetings,
  useUpdateWorklistItem,
  useTickPatientsViaMeeting,
  useSetWorklistStatus,
  useLinkMeetingToWorklist,
  useUnlinkMeetingFromWorklist,
  useRecentUserMeetings,
  useCreateWorklist,
  useWorklistCounts,
  type NarpWorklist,
  type NarpWorklistItem,
} from "@/hooks/useNarpWorklists";

interface WorklistsTabProps {
  practiceId: string | null | undefined;
  practiceName?: string;
}

export const WorklistsTab = ({ practiceId, practiceName }: WorklistsTabProps) => {
  const [includeClosed, setIncludeClosed] = useState(false);
  const [openWorklistId, setOpenWorklistId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: worklists = [], isLoading } = useNarpWorklists(practiceId, { includeClosed });

  if (!practiceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Select a single practice (not "All Practices") to manage clinical worklists.
        </CardContent>
      </Card>
    );
  }

  if (openWorklistId) {
    return (
      <WorklistDetail
        worklistId={openWorklistId}
        worklist={worklists.find((w) => w.id === openWorklistId)}
        onBack={() => setOpenWorklistId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold">Clinical worklists — {practiceName ?? "this practice"}</h3>
          <p className="text-xs text-muted-foreground">
            Practice-shared lists of patients identified for review. Add patients from the patient drawer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="include-closed" checked={includeClosed} onCheckedChange={setIncludeClosed} />
            <Label htmlFor="include-closed" className="text-xs cursor-pointer">Show closed</Label>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New worklist
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && worklists.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No {includeClosed ? "" : "open "}worklists yet.</p>
            <p className="text-xs mt-1">Drill into a cohort or the Top 25 list, select patients, then "Add to worklist".</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {worklists.map((w) => (
          <WorklistCard key={w.id} worklist={w} onOpen={() => setOpenWorklistId(w.id)} />
        ))}
      </div>

      <CreateWorklistDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        practiceId={practiceId}
      />
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Card summary of a single worklist
   ──────────────────────────────────────────────────────────── */
const WorklistCard = ({ worklist, onOpen }: { worklist: NarpWorklist; onOpen: () => void }) => {
  const { data: items } = useNarpWorklistItems(worklist.id);
  const counts = useWorklistCounts(items);
  const closed = worklist.status === "closed";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left border rounded-lg p-3 hover:shadow-sm transition-shadow bg-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            {closed ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Unlock className="h-3.5 w-3.5 text-primary" />}
            {worklist.title}
          </div>
          {worklist.cohort_label && (
            <div className="text-[11px] text-muted-foreground italic line-clamp-1">cohort: {worklist.cohort_label}</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Created {format(parseISO(worklist.created_at), "dd MMM yyyy")}
            {worklist.created_by_email ? ` · ${worklist.created_by_email}` : ""}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Badge variant="secondary" className="text-[10px]">{counts.total} patients</Badge>
        {counts.reviewed > 0 && (
          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-700 dark:text-green-400">
            {counts.reviewed} reviewed
          </Badge>
        )}
        {counts.pending > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {counts.pending} pending
          </Badge>
        )}
        {counts.escalated > 0 && (
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <ArrowUpRight className="h-3 w-3 mr-0.5" />
            {counts.escalated} escalated
          </Badge>
        )}
        {counts.improved > 0 && (
          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-700 dark:text-green-400">
            <ArrowDownRight className="h-3 w-3 mr-0.5" />
            {counts.improved} improved
          </Badge>
        )}
        {counts.left > 0 && (
          <Badge variant="outline" className="text-[10px]">
            <UserMinus className="h-3 w-3 mr-0.5" />
            {counts.left} left
          </Badge>
        )}
      </div>
    </button>
  );
};

/* ────────────────────────────────────────────────────────────
   Detail view — items + meeting links
   ──────────────────────────────────────────────────────────── */
const WorklistDetail = ({
  worklistId, worklist, onBack,
}: {
  worklistId: string;
  worklist: NarpWorklist | undefined;
  onBack: () => void;
}) => {
  const { data: items = [], isLoading } = useNarpWorklistItems(worklistId);
  const { data: meetingLinks = [] } = useNarpWorklistMeetings(worklistId);
  const counts = useWorklistCounts(items);
  const updateItem = useUpdateWorklistItem();
  const setStatus = useSetWorklistStatus();
  const link = useLinkMeetingToWorklist();
  const unlink = useUnlinkMeetingFromWorklist();
  const tickViaMeeting = useTickPatientsViaMeeting();
  const { data: recentMeetings = [] } = useRecentUserMeetings();

  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "escalated">("all");
  const [meetingTickPicker, setMeetingTickPicker] = useState<{ meetingId: string; itemIds: Set<string> } | null>(null);
  const [linkMeetingId, setLinkMeetingId] = useState<string>("");

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "pending":
        return items.filter((i) => i.review_status === "pending");
      case "reviewed":
        return items.filter((i) => i.review_status === "reviewed");
      case "escalated":
        return items.filter((i) => i.change_flag === "escalated");
      default:
        return items;
    }
  }, [items, filter]);

  if (!worklist) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Worklist not found.</CardContent></Card>
      </div>
    );
  }

  const closed = worklist.status === "closed";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          All worklists
        </Button>
        <div className="flex gap-2">
          {!closed ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setStatus.mutate(
                  { id: worklist.id, practice_id: worklist.practice_id, status: "closed" },
                  { onSuccess: () => toast.success("Worklist closed") },
                )
              }
            >
              <Lock className="h-4 w-4 mr-1.5" />
              Close worklist
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setStatus.mutate(
                  { id: worklist.id, practice_id: worklist.practice_id, status: "open" },
                  { onSuccess: () => toast.success("Worklist re-opened") },
                )
              }
            >
              <Unlock className="h-4 w-4 mr-1.5" />
              Re-open
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {closed ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-primary" />}
                {worklist.title}
              </h3>
              {worklist.description && <p className="text-sm text-muted-foreground mt-1">{worklist.description}</p>}
              {worklist.cohort_label && (
                <p className="text-xs text-muted-foreground italic mt-0.5">cohort: {worklist.cohort_label}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Created {format(parseISO(worklist.created_at), "dd MMM yyyy 'at' HH:mm")}
                {worklist.created_by_email ? ` · ${worklist.created_by_email}` : ""}
                {closed && worklist.closed_at && (
                  <> · Closed {format(parseISO(worklist.closed_at), "dd MMM yyyy")}</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{counts.total} patients</Badge>
              <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
                {counts.reviewed} reviewed
              </Badge>
              <Badge variant="outline">{counts.pending} pending</Badge>
              {counts.escalated > 0 && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  {counts.escalated} escalated
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked meetings */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Mic className="h-4 w-4" />
                Linked Notewell meetings
              </div>
              <p className="text-[11px] text-muted-foreground">
                Link a meeting where this worklist was discussed, then tick the patients reviewed during it.
              </p>
            </div>
          </div>
          {!closed && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={linkMeetingId} onValueChange={setLinkMeetingId}>
                <SelectTrigger className="w-[280px] h-8 text-xs">
                  <SelectValue placeholder="Select a recent meeting…" />
                </SelectTrigger>
                <SelectContent>
                  {recentMeetings.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2">No recent meetings</div>
                  )}
                  {recentMeetings
                    .filter((m) => !meetingLinks.some((l) => l.link.meeting_id === m.id))
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.title || "Untitled"}{" "}
                        {m.start_time ? `· ${format(parseISO(m.start_time), "dd MMM yyyy HH:mm")}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!linkMeetingId || link.isPending}
                onClick={() =>
                  link.mutate(
                    { worklist_id: worklistId, meeting_id: linkMeetingId },
                    {
                      onSuccess: () => {
                        toast.success("Meeting linked");
                        setLinkMeetingId("");
                      },
                    },
                  )
                }
              >
                <Link2 className="h-4 w-4 mr-1.5" />
                Link meeting
              </Button>
            </div>
          )}
          {meetingLinks.length === 0 && (
            <p className="text-xs text-muted-foreground">No meetings linked yet.</p>
          )}
          <ul className="divide-y">
            {meetingLinks.map(({ link: l, meeting }) => (
              <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {meeting?.title || "Untitled meeting"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Linked {format(parseISO(l.linked_at), "dd MMM yyyy HH:mm")}
                    {meeting?.start_time && (
                      <> · meeting {format(parseISO(meeting.start_time), "dd MMM yyyy HH:mm")}</>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {!closed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setMeetingTickPicker({
                          meetingId: l.meeting_id,
                          itemIds: new Set(items.filter((i) => i.review_status === "pending").map((i) => i.id)),
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Tick patients reviewed
                    </Button>
                  )}
                  {!closed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        unlink.mutate(
                          { worklist_id: worklistId, link_id: l.id },
                          { onSuccess: () => toast.success("Meeting unlinked") },
                        )
                      }
                    >
                      <Link2Off className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-6">All ({counts.total})</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs h-6">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="reviewed" className="text-xs h-6">Reviewed ({counts.reviewed})</TabsTrigger>
              <TabsTrigger value="escalated" className="text-xs h-6">Escalated ({counts.escalated})</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} className="mt-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && filteredItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No patients in this view.</p>
              )}
              {filteredItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr className="text-left">
                        <th className="p-2 w-8"></th>
                        <th className="p-2">Patient ref</th>
                        <th className="p-2">Added risk</th>
                        <th className="p-2 text-right">PoA at add</th>
                        <th className="p-2">Now</th>
                        <th className="p-2">Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          disabled={closed}
                          onToggleReviewed={() =>
                            updateItem.mutate({
                              id: item.id,
                              worklist_id: worklistId,
                              review_status: item.review_status === "reviewed" ? "pending" : "reviewed",
                            })
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Meeting tick picker */}
      <Dialog open={!!meetingTickPicker} onOpenChange={(o) => { if (!o) setMeetingTickPicker(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tick patients reviewed in this meeting</DialogTitle>
            <DialogDescription>
              Selected patients will be marked reviewed and linked to this meeting for audit.
            </DialogDescription>
          </DialogHeader>
          {meetingTickPicker && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Showing pending patients only.
              </div>
              <div className="border rounded-md max-h-64 overflow-auto">
                <ul className="divide-y">
                  {items.filter((i) => i.review_status === "pending").map((i) => {
                    const ticked = meetingTickPicker.itemIds.has(i.id);
                    return (
                      <li key={i.id} className="p-2 flex items-center gap-2 hover:bg-muted/40">
                        <Checkbox
                          checked={ticked}
                          onCheckedChange={(v) => {
                            const next = new Set(meetingTickPicker.itemIds);
                            if (v) next.add(i.id);
                            else next.delete(i.id);
                            setMeetingTickPicker({ ...meetingTickPicker, itemIds: next });
                          }}
                        />
                        <span className="font-mono text-xs">{i.fk_patient_link_id}</span>
                        {i.change_flag === "escalated" && (
                          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive ml-auto">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />escalated
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                  {items.filter((i) => i.review_status === "pending").length === 0 && (
                    <li className="p-3 text-xs text-muted-foreground text-center">No pending patients.</li>
                  )}
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMeetingTickPicker(null)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={meetingTickPicker.itemIds.size === 0 || tickViaMeeting.isPending}
                  onClick={() => {
                    tickViaMeeting.mutate(
                      {
                        worklist_id: worklistId,
                        meeting_id: meetingTickPicker.meetingId,
                        item_ids: Array.from(meetingTickPicker.itemIds),
                      },
                      {
                        onSuccess: (res) => {
                          toast.success(`${res.updated} patient${res.updated === 1 ? "" : "s"} marked reviewed`);
                          setMeetingTickPicker(null);
                        },
                      },
                    );
                  }}
                >
                  Mark {meetingTickPicker.itemIds.size} reviewed
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ItemRow = ({
  item, disabled, onToggleReviewed,
}: { item: NarpWorklistItem; disabled: boolean; onToggleReviewed: () => void }) => {
  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="p-2">
        <button
          type="button"
          onClick={disabled ? undefined : onToggleReviewed}
          disabled={disabled}
          aria-label={item.review_status === "reviewed" ? "Mark pending" : "Mark reviewed"}
        >
          {item.review_status === "reviewed" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </td>
      <td className="p-2 font-mono">{item.fk_patient_link_id}</td>
      <td className="p-2 capitalize">{(item.added_risk_tier ?? "—").replace("_", " ")}</td>
      <td className="p-2 text-right tabular-nums">{item.added_poa !== null ? `${item.added_poa.toFixed(1)}%` : "—"}</td>
      <td className="p-2">
        {item.change_flag === "escalated" && (
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <ArrowUpRight className="h-3 w-3 mr-0.5" />escalated
          </Badge>
        )}
        {item.change_flag === "improved" && (
          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-700 dark:text-green-400">
            <ArrowDownRight className="h-3 w-3 mr-0.5" />improved
          </Badge>
        )}
        {item.change_flag === "left_practice" && (
          <Badge variant="outline" className="text-[10px]"><UserMinus className="h-3 w-3 mr-0.5" />left</Badge>
        )}
        {item.change_flag === "unchanged" && (
          <span className="text-muted-foreground text-[11px]">unchanged</span>
        )}
      </td>
      <td className="p-2 text-[11px] text-muted-foreground">
        {item.review_status === "reviewed" && item.reviewed_at
          ? `${format(parseISO(item.reviewed_at), "dd MMM HH:mm")}${item.reviewed_via_meeting_id ? " (mtg)" : ""}`
          : "—"}
      </td>
    </tr>
  );
};

/* ────────────────────────────────────────────────────────────
   Create-worklist dialog (used from the tab itself)
   ──────────────────────────────────────────────────────────── */
const CreateWorklistDialog = ({
  open, onOpenChange, practiceId,
}: { open: boolean; onOpenChange: (open: boolean) => void; practiceId: string }) => {
  const create = useCreateWorklist();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (title.trim().length < 3) {
      toast.error("Worklist name must be at least 3 characters");
      return;
    }
    try {
      await create.mutateAsync({
        practice_id: practiceId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Worklist created");
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch {
      // mutation already toasts
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a clinical worklist</DialogTitle>
          <DialogDescription>
            Empty worklists are useful for ad-hoc tracking. Add patients later from the patient drawer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cwl-title" className="text-xs">Worklist name</Label>
            <Input id="cwl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cwl-desc" className="text-xs">Description (optional)</Label>
            <Textarea id="cwl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
