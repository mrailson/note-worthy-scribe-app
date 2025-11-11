import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wrench, Loader2, Home } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminTranscriptRepair() {
  const [meetingId, setMeetingId] = useState("");
  const [isRepairing, setIsRepairing] = useState(false);

  const handleRepair = async () => {
    if (!meetingId.trim()) {
      toast.error("Please enter a meeting ID");
      return;
    }

    try {
      setIsRepairing(true);
      console.log("🔧 Repairing transcript for meeting:", meetingId);

      const { data, error } = await supabase.functions.invoke('repair-transcript-chunks', {
        body: { meetingId: meetingId.trim() }
      });

      if (error) throw error;

      console.log("✅ Repair complete:", data);
      toast.success(`Repair complete!`, {
        description: `Processed ${data.processed} chunks${data.errors > 0 ? ` with ${data.errors} errors` : ""}`
      });
      
      setMeetingId("");
    } catch (error) {
      console.error("❌ Repair failed:", error);
      toast.error("Repair failed", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const repairSpecificMeetings = async () => {
    const meetingIds = [
      "0793ab78-f170-4c6d-9dcd-fda0cb15f15a",
      "7d1f77d9-b8e7-4bff-b06b-eb15f9a7aac0"
    ];

    setIsRepairing(true);
    
    for (const id of meetingIds) {
      try {
        console.log("🔧 Repairing:", id);
        const { data, error } = await supabase.functions.invoke('repair-transcript-chunks', {
          body: { meetingId: id }
        });

        if (error) throw error;
        
        toast.success(`Repaired meeting ${id.slice(0, 8)}...`, {
          description: `Processed ${data.processed} chunks`
        });
      } catch (error) {
        console.error("❌ Failed:", id, error);
        toast.error(`Failed to repair ${id.slice(0, 8)}...`);
      }
    }

    setIsRepairing(false);
  };

  return (
    <>
      <Helmet>
        <title>Admin: Transcript Repair | Notewell AI</title>
      </Helmet>

      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Transcript Repair Tool</h1>
          <Button asChild variant="outline">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Repair J.Railson's Meetings</CardTitle>
            <CardDescription>
              Fix the two meetings with pending transcription chunks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={repairSpecificMeetings} 
              disabled={isRepairing}
              className="w-full"
            >
              {isRepairing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Repairing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Repair Both Meetings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Repair</CardTitle>
            <CardDescription>
              Enter a meeting ID to repair its transcript chunks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Meeting ID (UUID)"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
            />
            <Button 
              onClick={handleRepair} 
              disabled={isRepairing || !meetingId.trim()}
              className="w-full"
            >
              {isRepairing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Repairing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Repair Transcript
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
