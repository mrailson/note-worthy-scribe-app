import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ENNPracticeData } from "@/hooks/useENNData";
import { Snowflake, CheckCircle2, XCircle, Calendar } from "lucide-react";

interface ENNWinterAccessPanelProps {
  practices: ENNPracticeData[];
  isLoading: boolean;
}

export const ENNWinterAccessPanel = ({ practices, isLoading }: ENNWinterAccessPanelProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const winterPractices = practices.filter(p => p.participating_winter);
  const nonWinterPractices = practices.filter(p => !p.participating_winter);
  const totalWinterAppts = practices.reduce((sum, p) => sum + p.winter_appts_required, 0);
  const totalWinterSlots = Math.round(totalWinterAppts / 2); // Approx 821

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#003087]">Winter Access Programme</h2>
        <Badge className="bg-blue-100 text-blue-800">
          <Snowflake className="h-3 w-3 mr-1" />
          {winterPractices.length}/{practices.length} Participating
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Snowflake className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-blue-800">Winter Appointments</h3>
          </div>
          <p className="text-3xl font-bold text-blue-900">{totalWinterAppts.toLocaleString()}</p>
          <p className="text-xs text-blue-600 mt-1">Total winter appointment slots</p>
        </Card>

        <Card className="p-4 border-2 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-medium text-green-800">Participating</h3>
          </div>
          <p className="text-3xl font-bold text-green-900">{winterPractices.length}</p>
          <p className="text-xs text-green-600 mt-1">Practices in winter programme</p>
        </Card>

        <Card className="p-4 border-2 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            <h3 className="font-medium text-amber-800">Non-Winter Weekly</h3>
          </div>
          <p className="text-3xl font-bold text-amber-900">
            {practices.reduce((sum, p) => sum + p.weekly_non_winter_appts, 0).toLocaleString()}
          </p>
          <p className="text-xs text-amber-600 mt-1">Weekly appointments (non-winter)</p>
        </Card>
      </div>

      {/* Practice Details Table */}
      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">ODS Code</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Practice</th>
                <th className="text-centre py-2 px-3 text-muted-foreground font-medium">Winter?</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Winter Appts</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Non-Winter Appts</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Non-Winter Weekly</th>
              </tr>
            </thead>
            <tbody>
              {practices.map(practice => (
                <tr key={practice.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 font-mono text-xs">{practice.ods_code}</td>
                  <td className="py-2 px-3 font-medium">{practice.ods_code}</td>
                  <td className="py-2 px-3 text-centre">
                    {practice.participating_winter ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 inline" />
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{practice.winter_appts_required}</td>
                  <td className="py-2 px-3 text-right">{practice.non_winter_appts_required.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right">{practice.weekly_non_winter_appts}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3" colSpan={3}>Total</td>
                <td className="py-2 px-3 text-right">{totalWinterAppts.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">
                  {practices.reduce((sum, p) => sum + p.non_winter_appts_required, 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right">
                  {practices.reduce((sum, p) => sum + p.weekly_non_winter_appts, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};
