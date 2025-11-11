import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminCopyNotes = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const meetingId = '7d1f77d9-b8e7-4bff-b06b-eb15f9a7aac0';

  const copyNotesToMeetings = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      // First, get the notes from meeting_summaries
      const { data: summaryData, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meetingId)
        .single();

      if (summaryError) {
        throw new Error(`Failed to fetch from meeting_summaries: ${summaryError.message}`);
      }

      if (!summaryData?.summary) {
        throw new Error('No summary found in meeting_summaries');
      }

      console.log('✅ Found summary in meeting_summaries, length:', summaryData.summary.length);

      // Now update the meetings table with this content
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ notes_style_3: summaryData.summary })
        .eq('id', meetingId);

      if (updateError) {
        throw new Error(`Failed to update meetings table: ${updateError.message}`);
      }

      console.log('✅ Successfully copied notes to meetings.notes_style_3');

      setResult({
        success: true,
        message: `Successfully copied ${summaryData.summary.length} characters to meetings.notes_style_3`
      });

      toast({
        title: 'Success',
        description: 'Notes have been copied successfully',
      });
    } catch (error: any) {
      console.error('❌ Error copying notes:', error);
      setResult({
        success: false,
        message: error.message
      });

      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/">
          <Button variant="outline" size="icon">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Admin: Copy Notes to meetings.notes_style_3</h1>
      </div>
      
      <Card className="p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Meeting ID</h2>
            <p className="font-mono text-sm bg-muted p-2 rounded">{meetingId}</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Problem</h2>
            <p className="text-muted-foreground">
              This meeting has notes in meeting_summaries.summary but not in meetings.notes_style_3, 
              causing the modal to not display the notes properly.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Solution</h2>
            <p className="text-muted-foreground">
              Click the button below to copy the notes from meeting_summaries to meetings.notes_style_3
            </p>
          </div>

          <Button
            onClick={copyNotesToMeetings}
            disabled={isProcessing}
            className="w-full gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>Copy Notes</>
            )}
          </Button>

          {result && (
            <div className={`flex items-start gap-2 p-4 rounded ${
              result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
            }`}>
              {result.success ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{result.success ? 'Success' : 'Error'}</p>
                <p className="text-sm">{result.message}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminCopyNotes;
