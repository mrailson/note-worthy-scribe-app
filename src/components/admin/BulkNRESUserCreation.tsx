import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Play, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface CreationResult {
  success: string[];
  failed: { email: string; error: string }[];
}

interface Summary {
  total: number;
  created: number;
  failed: number;
}

export const BulkNRESUserCreation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CreationResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const USERS_TO_CREATE = [
    { email: "james.sherrell@nhs.net", name: "James Sherrell", organization: "PML" },
    { email: "dawn.sherrell@nhs.net", name: "Dawn Sherrell", organization: "PML" },
    { email: "ian.rogers16@nhs.net", name: "Ian Rogers", organization: "PML" },
    { email: "david.horne9@nhs.net", name: "David Horne", organization: "NHS ICB" },
    { email: "bethany.sherwood1@nhs.net", name: "Bethany Sherwood", organization: "NHS ICB" },
    { email: "gemma.sherrell@nhs.net", name: "Gemma Sherrell", organization: "NHS ICB" },
    { email: "nicola.sherrell@nhs.net", name: "Nicola Sherrell", organization: "NHS ICB" },
    { email: "sarah.sherrell@nhs.net", name: "Sarah Sherrell", organization: "SNVB" },
    { email: "james.abbott28@nhs.net", name: "James Abbott", organization: "Voluntary Impact" },
    { email: "caroline.cook56@nhs.net", name: "Caroline Cook", organization: "Brackley Medical Centre" },
    { email: "helen.johnson158@nhs.net", name: "Helen Johnson", organization: "Towcester Medical Centre" },
    { email: "lisa.smith241@nhs.net", name: "Lisa Smith", organization: "Springfield Surgery" },
    { email: "susan.brown89@nhs.net", name: "Susan Brown", organization: "The Brook Health Centre" },
    { email: "rachel.williams67@nhs.net", name: "Rachel Williams", organization: "Bugbrooke Medical Practice" },
    { email: "emma.jones123@nhs.net", name: "Emma Jones", organization: "Denton Village Surgery" },
    { email: "jane.taylor45@nhs.net", name: "Jane Taylor", organization: "Danes Camp Medical Centre" },
    { email: "claire.davies78@nhs.net", name: "Claire Davies", organization: "The Parks Medical Practice" },
    { email: "karen.wilson34@nhs.net", name: "Karen Wilson", organization: "Brackley Medical Centre" },
    { email: "michelle.thompson56@nhs.net", name: "Michelle Thompson", organization: "Towcester Medical Centre" },
    { email: "andrea.moore23@nhs.net", name: "Andrea Moore", organization: "Springfield Surgery" },
    { email: "paula.jackson67@nhs.net", name: "Paula Jackson", organization: "The Brook Health Centre" },
    { email: "julie.white89@nhs.net", name: "Julie White", organization: "Bugbrooke Medical Practice" },
    { email: "tracy.harris12@nhs.net", name: "Tracy Harris", organization: "Denton Village Surgery" },
  ];

  const handleBulkCreate = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);
    setSummary(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('bulk-create-nres-users', {
        body: {}
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      setResults(data.results);
      setSummary(data.summary);

      if (data.summary.created > 0) {
        toast.success(`Successfully created ${data.summary.created} users`);
      }
      
      if (data.summary.failed > 0) {
        toast.warning(`${data.summary.failed} users failed to create`);
      }

    } catch (err: any) {
      console.error('Bulk creation error:', err);
      setError(err.message);
      toast.error('Failed to create users: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Bulk NRES User Creation
        </CardTitle>
        <CardDescription>
          Create 23 NRES users with practice_manager role, Meeting Notes access, BP Average Service access, and NRES service activation. Password: LetMeIn1
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Users to create preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Users to Create ({USERS_TO_CREATE.length})</h4>
          <ScrollArea className="h-40 border rounded-md p-3">
            <div className="space-y-1">
              {USERS_TO_CREATE.map((user, index) => (
                <div key={index} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{user.name}</span>
                    <span className="text-muted-foreground ml-2">({user.email})</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {user.organization}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Configuration summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium">Configuration</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Role:</span>
              <Badge className="ml-2">practice_manager</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Password:</span>
              <span className="ml-2 font-mono">LetMeIn1</span>
            </div>
            <div>
              <span className="text-muted-foreground">Meeting Notes:</span>
              <CheckCircle className="inline ml-2 h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="text-muted-foreground">BP Service:</span>
              <CheckCircle className="inline ml-2 h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="text-muted-foreground">NRES Access:</span>
              <CheckCircle className="inline ml-2 h-4 w-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Action button */}
        <Button 
          onClick={handleBulkCreate} 
          disabled={isRunning}
          className="w-full"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Users...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Create All NRES Users
            </>
          )}
        </Button>

        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Results display */}
        {summary && (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Results Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{summary.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
              <Progress 
                value={(summary.created / summary.total) * 100} 
                className="mt-4"
              />
            </div>

            {/* Success list */}
            {results && results.success.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Successfully Created ({results.success.length})
                </h4>
                <ScrollArea className="h-32 border border-green-200 rounded-md p-3 bg-green-50/50">
                  <div className="space-y-1">
                    {results.success.map((email, index) => (
                      <div key={index} className="text-sm text-green-700">
                        {email}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Failed list */}
            {results && results.failed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Failed ({results.failed.length})
                </h4>
                <ScrollArea className="h-32 border border-destructive/20 rounded-md p-3 bg-destructive/5">
                  <div className="space-y-2">
                    {results.failed.map((item, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium text-destructive">{item.email}</span>
                        <span className="text-muted-foreground ml-2">- {item.error}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
