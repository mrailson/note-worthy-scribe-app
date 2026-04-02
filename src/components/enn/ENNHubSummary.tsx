import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ENNHub, ENNPracticeData } from "@/hooks/useENNData";
import { Building2, PoundSterling, Users, Calendar } from "lucide-react";

interface ENNHubSummaryProps {
  hubs: ENNHub[];
  getPracticesForHub: (hubId: string) => ENNPracticeData[];
  totalBudget: number;
  isLoading: boolean;
}

export const ENNHubSummary = ({ hubs, getPracticesForHub, totalBudget, isLoading }: ENNHubSummaryProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#003087]">Hub Reporting</h2>
        <Badge variant="outline" className="text-sm">
          Total Annual Budget: £{totalBudget.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {hubs.map(hub => {
          const hubPractices = getPracticesForHub(hub.id);
          const hubTotalListSize = hubPractices.reduce((sum, p) => sum + p.list_size, 0);
          const hubTotalWeeklyAppts = hubPractices.reduce((sum, p) => sum + p.weekly_appts_required, 0);
          const budgetPercentage = totalBudget > 0 ? ((Number(hub.annual_income) / totalBudget) * 100).toFixed(1) : '0';

          return (
            <Card key={hub.id} className="p-6 border-2 hover:border-[#005EB8] transition-all hover:shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[#005EB8]/10">
                  <Building2 className="h-6 w-6 text-[#005EB8]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#003087]">{hub.hub_name}</h3>
                  <p className="text-xs text-muted-foreground">{hubPractices.length} practices</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <PoundSterling className="h-4 w-4 text-[#007F3B]" />
                    <span className="text-sm text-muted-foreground">Annual Income</span>
                  </div>
                  <span className="font-bold text-[#007F3B]">
                    £{Number(hub.annual_income).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#005EB8]" />
                    <span className="text-sm text-muted-foreground">Hub List Size</span>
                  </div>
                  <span className="font-bold text-[#003087]">{hub.hub_list_size.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#005EB8]" />
                    <span className="text-sm text-muted-foreground">Weekly Appts</span>
                  </div>
                  <span className="font-bold text-[#003087]">{hub.weekly_appts_required.toLocaleString()}</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#005EB8] h-2 rounded-full transition-all"
                    style={{ width: `${budgetPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-centre">{budgetPercentage}% of total budget</p>
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Served Practices:</p>
                <div className="flex flex-wrap gap-1">
                  {hubPractices.map(p => (
                    <Badge key={p.id} variant="secondary" className="text-xs">
                      {p.ods_code}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
