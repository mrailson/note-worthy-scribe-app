import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export default function MandatoryReadView() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const token = params.get("token") || undefined;
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        if (token) {
          const { data, error } = await supabase.functions.invoke("mandatory-reads-token-resolve", {
            body: { token, policy_id: id },
          });
          if (error || !data?.ok) throw new Error(data?.error || "Invalid link");
          setPolicy(data.policy);
          setAssignment(data.assignment);
          setTypedName(data.assignment?.full_name || "");
        } else if (user) {
          const { data: pol } = await supabase.from("mandatory_reads").select("*").eq("id", id).maybeSingle();
          const { data: ass } = await supabase
            .from("mandatory_read_assignments")
            .select("*")
            .eq("mandatory_read_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!pol) throw new Error("Policy not found");
          setPolicy(pol);
          setAssignment(ass);
          setTypedName(ass?.full_name || (user as any).user_metadata?.full_name || "");
        } else {
          throw new Error("You must sign in or use the link from your email.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, user]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
  }

  async function submit() {
    if (!policy) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mandatory-reads-acknowledge", {
        body: {
          mandatory_read_id: policy.id,
          token,
          typed_name: typedName.trim(),
          user_id: user?.id,
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || "Failed");
      setDone(true);
      toast({ title: "Acknowledged", description: "A receipt has been emailed to you." });
    } catch (e: any) {
      toast({ title: "Couldn't record acknowledgement", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {user && <Header onNewMeeting={() => {}} />}
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {error ? (
          <Card className="p-8 text-center">
            <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
            <h2 className="text-lg font-semibold mb-2">Unable to open this policy</h2>
            <p className="text-muted-foreground">{error}</p>
          </Card>
        ) : done ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
            <h2 className="text-xl font-semibold mb-2">Thank you</h2>
            <p className="text-muted-foreground">Your acknowledgement of <strong>{policy?.title}</strong> has been recorded. A receipt has been emailed to you.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="p-6 border-b bg-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Mandatory read · v{policy?.version}</div>
              <h1 className="text-2xl font-bold mb-1">{policy?.title}</h1>
              {policy?.description && <p className="text-sm text-muted-foreground">{policy.description}</p>}
            </div>
            <div
              onScroll={onScroll}
              className="prose prose-sm max-w-none p-6 bg-background overflow-auto"
              style={{ maxHeight: "60vh" }}
              dangerouslySetInnerHTML={{ __html: policy?.body_html || "<p><em>No content available.</em></p>" }}
            />
            <div className="p-6 border-t bg-muted/20 space-y-4">
              {!scrolled && (
                <p className="text-xs text-muted-foreground italic">Scroll to the end of the policy to enable the acknowledgement.</p>
              )}
              <div className="flex items-start gap-3">
                <Checkbox id="confirm" checked={confirmed} disabled={!scrolled} onCheckedChange={(v) => setConfirmed(!!v)} />
                <Label htmlFor="confirm" className="text-sm leading-snug">
                  I confirm I have read and understood this policy and agree to comply with it.
                </Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="typedName" className="text-sm">Type your full name as e-signature</Label>
                <Input id="typedName" value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Full name" />
              </div>
              <Button onClick={submit} disabled={!confirmed || !typedName.trim() || submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit acknowledgement
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
