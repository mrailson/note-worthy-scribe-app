import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Play, CheckCircle, XCircle, Loader2, AlertTriangle, SkipForward } from 'lucide-react';

interface CreationResult {
  success: string[];
  failed: { email: string; error: string }[];
  skipped: string[];
}

interface Summary {
  total: number;
  created: number;
  skipped: number;
  failed: number;
}

export const BulkNRESUserCreation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CreationResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Correct user list from Excel file
  const USERS_TO_CREATE = [
    { email: "m.green28@nhs.net", name: "Maureen Green", organization: "PML" },
    { email: "mark.gray1@nhs.net", name: "Mark Gray", organization: "PML" },
    { email: "carolyn.abbisogni@nhs.net", name: "Carolyn Abbisoni", organization: "PML" },
    { email: "claire.garbett3@nhs.net", name: "Claire Garbett", organization: "PML" },
    { email: "chloe.thorpe15@nhs.net", name: "Chloe Thorpe", organization: "PML" },
    { email: "a.pratyush@nhs.net", name: "Anshal Pratyush", organization: "PML" },
    { email: "malcolm.railson@nhs.net", name: "Malcolm Railson", organization: "NHS ICB" },
    { email: "michael.chapman13@nhs.net", name: "Michael Chapman", organization: "NHS ICB" },
    { email: "sandra.easton2@nhs.net", name: "Sandra Easton", organization: "Brackley Medical Centre" },
    { email: "tbeardsworth@nhs.net", name: "Tina Beardsworth", organization: "Brackley Medical Centre" },
    { email: "amanda.taylor75@nhs.net", name: "Amanda Taylor", organization: "Brackley Medical Centre" },
    { email: "simon.ellis7@nhs.net", name: "Simon Ellis", organization: "Towcester Medical Centre" },
    { email: "chloe.lamont1@nhs.net", name: "Chloe Lamont", organization: "Towcester Medical Centre" },
    { email: "dal.samra@nhs.net", name: "Dal Samra", organization: "Springfield Surgery" },
    { email: "hayley.willingham1@nhs.net", name: "Hayley Willingham", organization: "Springfield Surgery" },
    { email: "arif.supple@nhs.net", name: "Arif Supple", organization: "The Brook Health Centre" },
    { email: "anita.carter5@nhs.net", name: "Anita Carter", organization: "The Brook Health Centre" },
    { email: "lesley.driscoll@nhs.net", name: "Lesley Driscoll", organization: "The Brook Health Centre" },
    { email: "rachel.parry2@nhs.net", name: "Rachel Parry", organization: "Bugbrooke Medical Practice" },
    { email: "lorraine.spicer@nhs.net", name: "Lorraine Spicer", organization: "Bugbrooke Medical Practice" },
    { email: "davidwade@nhs.net", name: "David Wade", organization: "Denton Village Surgery" },
    { email: "nicola.draper3@nhs.net", name: "Nicola Draper", organization: "Denton Village Surgery" },
    { email: "amy.amin1@nhs.net", name: "Amy Amin", organization: "Denton Village Surgery" },
    { email: "muhammad.chishti@nhs.net", name: "Muhammad Chishti", organization: "Danes Camp Medical Centre" },
    { email: "alexander.whitehead@nhs.net", name: "Alexander Whitehead", organization: "Danes Camp Medical Centre" },
    { email: "charlotte.barnell1@nhs.net", name: "Charlotte Barnell", organization: "The Parks Medical Practice" },
    { email: "helen.barrett@snvb.org.uk", name: "Helen Barrett", organization: "SNVB" },
    { email: "russell.rolph@voluntaryimpact.org.uk", name: "Russell Rolph", organization: "Voluntary Impact" },
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
      
      if (data.summary.skipped > 0) {
        toast.info(`${data.summary.skipped} users already exist and were skipped`);
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
          Create 28 NRES users with practice_manager role, Meeting Notes access, BP Average Service access, and NRES service activation. Password: LetMeIn1
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
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{summary.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{summary.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
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

            {/* Skipped list */}
            {results && results.skipped.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <SkipForward className="h-4 w-4 text-yellow-600" />
                  Skipped - Already Exist ({results.skipped.length})
                </h4>
                <ScrollArea className="h-32 border border-yellow-200 rounded-md p-3 bg-yellow-50/50">
                  <div className="space-y-1">
                    {results.skipped.map((email, index) => (
                      <div key={index} className="text-sm text-yellow-700">
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
