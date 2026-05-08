import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileCheck2, Clock, AlertCircle, Loader2 } from "lucide-react";

export default function MandatoryReads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, { ack: number; total: number }>>({});

  // create dialog
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [dueDays, setDueDays] = useState(14);
  const [assigneesText, setAssigneesText] = useState(""); // "Name <email>" per line
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: pols }, { data: myAss }] = await Promise.all([
      supabase.from("mandatory_reads").select("*").eq("archived", false).order("created_at", { ascending: false }),
      supabase.from("mandatory_read_assignments").select("*, mandatory_reads(title,version)").eq("user_id", user?.id || "").order("due_at"),
    ]);
    setPolicies(pols || []);
    setMine((myAss as any) || []);
    if (pols?.length) {
      const ids = pols.map((p: any) => p.id);
      const { data: ass } = await supabase.from("mandatory_read_assignments").select("mandatory_read_id,status").in("mandatory_read_id", ids);
      const s: Record<string, { ack: number; total: number }> = {};
      (ass || []).forEach((a: any) => {
        s[a.mandatory_read_id] = s[a.mandatory_read_id] || { ack: 0, total: 0 };
        s[a.mandatory_read_id].total++;
        if (a.status === "acknowledged") s[a.mandatory_read_id].ack++;
      });
      setStats(s);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function hashHex(s: string) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function parseAssignees(text: string) {
    return text.split(/\n+/).map(line => {
      const m = line.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
      if (m) return { full_name: m[1].trim(), email: m[2].trim().toLowerCase() };
      const e = line.trim();
      if (e.includes("@")) return { full_name: e.split("@")[0], email: e.toLowerCase() };
      return null;
    }).filter(Boolean) as { full_name: string; email: string }[];
  }

  async function create() {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and content required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const versionHash = await hashHex(body);
      const { data: pol, error } = await supabase.from("mandatory_reads").insert({
        title: title.trim(),
        description: description.trim() || null,
        body_html: body,
        version: 1,
        version_hash: versionHash,
        due_days: dueDays,
        source_type: "pasted_text",
        created_by: user!.id,
      }).select("id").single();
      if (error) throw error;

      const assignees = parseAssignees(assigneesText);
      if (assignees.length === 0) {
        toast({ title: "Policy created", description: "No assignees yet — add some later." });
      } else {
        const { data, error: pubErr } = await supabase.functions.invoke("mandatory-reads-publish", {
          body: { mandatory_read_id: pol!.id, assignees, send_initial_email: true },
        });
        if (pubErr) throw pubErr;
        toast({ title: "Published", description: `Sent to ${(data as any)?.emailed || 0} of ${assignees.length} recipients.` });
      }
      setOpen(false);
      setTitle(""); setDescription(""); setBody(""); setAssigneesText(""); setDueDays(14);
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header onNewMeeting={() => {}} />
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileCheck2 className="h-6 w-6 text-primary" /> Mandatory Reads</h1>
            <p className="text-sm text-muted-foreground">Publish policies, capture e-acknowledgements and produce a CQC-ready audit log.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New mandatory read</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New mandatory read</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Infection Prevention &amp; Control Policy" /></div>
                <div><Label>Short description (optional)</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div><Label>Policy content (HTML or plain text)</Label><Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Paste the full policy text here. Basic HTML is supported." /></div>
                <div><Label>Due in (days)</Label><Input type="number" value={dueDays} onChange={e => setDueDays(parseInt(e.target.value) || 14)} /></div>
                <div>
                  <Label>Assignees — one per line, "Name &lt;email&gt;" or just email</Label>
                  <Textarea value={assigneesText} onChange={e => setAssigneesText(e.target.value)} rows={5} placeholder={"Jane Smith <jane@practice.nhs.uk>\njohn@practice.nhs.uk"} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Publish &amp; send</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="mine">My reads {mine.filter(m => m.status !== "acknowledged").length > 0 && <Badge variant="destructive" className="ml-2">{mine.filter(m => m.status !== "acknowledged").length}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-4">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : policies.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No mandatory reads yet. Create one to get started.</Card>
            ) : (
              <div className="grid gap-3">
                {policies.map(p => {
                  const s = stats[p.id] || { ack: 0, total: 0 };
                  const pct = s.total ? Math.round((s.ack / s.total) * 100) : 0;
                  return (
                    <Card key={p.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground">v{p.version} · {s.ack}/{s.total} acknowledged ({pct}%)</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/mandatory-reads/${p.id}`)}>Open</Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            {mine.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">You have no mandatory reads assigned.</Card>
            ) : (
              <div className="grid gap-3">
                {mine.map(a => (
                  <Card key={a.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{a.mandatory_reads?.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        {a.status === "acknowledged" ? (
                          <Badge variant="outline" className="text-green-700 border-green-700">Acknowledged</Badge>
                        ) : a.status === "overdue" ? (
                          <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>
                        ) : (
                          <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Due {new Date(a.due_at).toLocaleDateString("en-GB")}</Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/mandatory-reads/${a.mandatory_read_id}`)}>
                      {a.status === "acknowledged" ? "View" : "Read &amp; sign"}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
