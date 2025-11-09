import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle } from "lucide-react";

const DEMO_TEAM_MEMBERS = [
  { name: 'Dr. Helen Carter', role: 'GP Partner', phone: '+44 7700 900123' },
  { name: 'Dr. Thomas Wright', role: 'GP Partner', phone: '+44 7700 900124' },
  { name: 'Dr. Sarah Smith', role: 'GP Salaried', phone: '+44 7700 900125' },
  { name: 'Dr. Aisha Patel', role: 'GP Salaried', phone: '+44 7700 900126' },
  { name: 'Dr. James Foster', role: 'GP Trainee', phone: '+44 7700 900127' },
  { name: 'Rachel Green', role: 'Practice Manager', phone: '+44 7700 900128' },
  { name: 'Emma Thompson', role: 'Reception Team', phone: '+44 7700 900129' },
  { name: 'Sophie Williams', role: 'Reception Team', phone: '+44 7700 900130' },
  { name: 'Linda Davies', role: 'Reception Team', phone: '+44 7700 900131' },
  { name: 'Claire Mitchell', role: 'Practice Nurse', phone: '+44 7700 900132' },
  { name: 'Jennifer Brown', role: 'Practice Nurse', phone: '+44 7700 900133' },
  { name: 'Mark Johnson', role: 'ARRS Staff', phone: '+44 7700 900134' },
  { name: 'Dr. Priya Sharma', role: 'ARRS Staff', phone: '+44 7700 900135' },
  { name: 'Sarah Bennett', role: 'Admin Team', phone: '+44 7700 900136' },
  { name: 'David Collins', role: 'Admin Team', phone: '+44 7700 900137' }
];

const TEST_EMAIL = 'Malcolm.railson@nhs.net';

export default function LoadDemoTeamData() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const loadDemoData = async () => {
    setLoading(true);
    setSuccess(false);
    setLoadedCount(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to load demo data');
        return;
      }

      // Check for existing team members
      const { data: existing } = await supabase
        .from('complaint_team_members')
        .select('name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const existingNames = new Set(existing?.map(m => m.name) || []);
      
      // Filter out members that already exist
      const membersToAdd = DEMO_TEAM_MEMBERS.filter(
        member => !existingNames.has(member.name)
      );

      if (membersToAdd.length === 0) {
        toast.info('All demo team members already exist in your database');
        setSuccess(true);
        setLoadedCount(DEMO_TEAM_MEMBERS.length);
        return;
      }

      // Insert each team member
      const results = await Promise.all(
        membersToAdd.map(async (member) => {
          const { error } = await supabase
            .from('complaint_team_members')
            .insert({
              user_id: user.id,
              name: member.name,
              email: TEST_EMAIL,
              role: member.role,
              phone: member.phone,
              is_active: true
            });

          if (error) {
            console.error(`Failed to add ${member.name}:`, error);
            return false;
          }
          return true;
        })
      );

      const successCount = results.filter(r => r).length;
      const alreadyExisted = DEMO_TEAM_MEMBERS.length - membersToAdd.length;
      
      setLoadedCount(successCount + alreadyExisted);
      setSuccess(true);

      if (successCount > 0) {
        toast.success(
          `Successfully loaded ${successCount} team member${successCount !== 1 ? 's' : ''}` +
          (alreadyExisted > 0 ? ` (${alreadyExisted} already existed)` : '')
        );
      }

    } catch (error) {
      console.error('Error loading demo data:', error);
      toast.error('Failed to load demo team members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Load Demo Team Members
          </CardTitle>
          <CardDescription>
            Load fictitious GP practice team members for testing and demonstration purposes.
            All emails will be set to {TEST_EMAIL}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Team Members to Load:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEMO_TEAM_MEMBERS.map((member, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.role}</div>
                    <div className="text-xs text-muted-foreground mt-1">{member.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={loadDemoData}
              disabled={loading || success}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading Demo Data...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Loaded {loadedCount} Team Members Successfully
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  Load {DEMO_TEAM_MEMBERS.length} Team Members
                </>
              )}
            </Button>

            {success && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Demo team members have been loaded successfully!
                  <br />
                  All email addresses are set to: <strong>{TEST_EMAIL}</strong>
                  <br />
                  <br />
                  You can now navigate to any complaint and use the "Request Information" 
                  feature to quickly select from these team members.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
