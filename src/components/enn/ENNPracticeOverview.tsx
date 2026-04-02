import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ENNPracticeData, ENNHub } from "@/hooks/useENNData";
import { MapPin, Users, Calendar, Snowflake } from "lucide-react";

interface ENNPracticeOverviewProps {
  practices: ENNPracticeData[];
  getHubName: (practiceId: string) => string;
  isLoading: boolean;
}

export const ENNPracticeOverview = ({ practices, getHubName, isLoading }: ENNPracticeOverviewProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalListSize = practices.reduce((sum, p) => sum + p.list_size, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#003087]">Practice Overview</h2>
        <Badge variant="outline" className="text-sm">
          {practices.length} Practices • {totalListSize.toLocaleString()} Registered Patients
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {practices.map(practice => (
          <Card key={practice.id} className="p-4 hover:shadow-lg transition-shadow border-2 hover:border-[#005EB8]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-[#003087] text-sm">{practice.ods_code}</h3>
                <p className="text-xs text-muted-foreground">{getHubName(practice.practice_id)}</p>
              </div>
              {practice.participating_winter ? (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  <Snowflake className="h-3 w-3 mr-1" /> Winter
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">No Winter</Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-[#005EB8]" />
                <span className="font-medium">{practice.list_size.toLocaleString()}</span>
                <span className="text-muted-foreground">patients</span>
              </div>

              {practice.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{practice.address}</span>
                </div>
              )}

              <div className="border-t pt-2 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-[#005EB8]" />
                  <span className="font-medium">{practice.weekly_appts_required}</span>
                  <span className="text-muted-foreground">weekly appts</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {practice.annual_appts_required.toLocaleString()} annual
                </p>
              </div>

              {practice.participating_winter && (
                <div className="bg-blue-50 rounded p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Winter appts:</span>
                    <span className="font-medium">{practice.winter_appts_required}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Non-winter weekly:</span>
                    <span className="font-medium">{practice.weekly_non_winter_appts}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
