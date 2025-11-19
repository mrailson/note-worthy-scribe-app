import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function AdminChunkRepair() {
  const [meetingId, setMeetingId] = useState("018e8d4e-7294-4d00-b676-682c205a9b38");
  const [isRepairing, setIsRepairing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRepair = async () => {
    try {
      setIsRepairing(true);
      setProgress(10);
      setResult(null);
      setError(null);
      
      console.log("🔧 Starting transcript repair for meeting:", meetingId);
      
      toast.info("Repairing transcript chunks...", {
        description: "This may take a few moments"
      });

      setProgress(30);

      // Set a longer timeout for this operation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const { data, error: invokeError } = await supabase.functions.invoke('repair-transcript-chunks', {
        body: { meetingId }
      });

      clearTimeout(timeoutId);
      setProgress(90);

      if (invokeError) {
        console.error("❌ Repair failed:", invokeError);
        setError(invokeError.message || "Unknown error");
        toast.error("Repair failed", {
          description: invokeError.message
        });
        return;
      }

      console.log("✅ Repair complete:", data);
      setResult(data);
      setProgress(100);
      
      toast.success(`Repair complete!`, {
        description: `Processed ${data.processed} chunks${data.errors > 0 ? ` with ${data.errors} errors` : ""}`
      });

    } catch (err: any) {
      console.error("❌ Repair exception:", err);
      setError(err.message || "Unexpected error occurred");
      toast.error("Repair failed", {
        description: err.message || "Unexpected error"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const checkChunkStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_transcription_chunks')
        .select('id, chunk_number, cleaned_text, cleaning_status')
        .eq('meeting_id', meetingId)
        .order('chunk_number');

      if (error) throw error;

      const uncleaned = data?.filter(c => !c.cleaned_text || c.cleaned_text === '').length || 0;
      const total = data?.length || 0;

      toast.info(`Chunk Status`, {
        description: `${uncleaned} uncleaned out of ${total} total chunks`
      });

      console.log('Chunk status:', { total, uncleaned, data });
    } catch (err: any) {
      toast.error('Failed to check status', {
        description: err.message
      });
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Admin: Transcript Chunk Repair
          </CardTitle>
          <CardDescription>
            Manually repair and reprocess meeting transcription chunks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="meetingId">Meeting ID</Label>
            <Input
              id="meetingId"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="Enter meeting ID..."
              disabled={isRepairing}
            />
          </div>

          {isRepairing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-centre">Processing chunks... {progress}%</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Repair Complete!</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Processed: {result.processed} chunks</li>
                  {result.errors > 0 && <li className="text-destructive">• Errors: {result.errors}</li>}
                  {result.errorDetails && (
                    <li className="text-muted-foreground mt-2">
                      <details>
                        <summary className="cursor-pointer">Error Details</summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-40">
                          {JSON.stringify(result.errorDetails, null, 2)}
                        </pre>
                      </details>
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleRepair}
              disabled={isRepairing || !meetingId}
              className="flex-1"
            >
              {isRepairing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Repairing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Repair Chunks
                </>
              )}
            </Button>
            <Button
              onClick={checkChunkStatus}
              disabled={isRepairing || !meetingId}
              variant="outline"
            >
              Check Status
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Current Meeting:</strong> j.railson - Health, Equalities, & Prevention Group</p>
            <p><strong>Created:</strong> 19th November 2025, 15:01</p>
            <p><strong>Status:</strong> 173 chunks awaiting repair</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
