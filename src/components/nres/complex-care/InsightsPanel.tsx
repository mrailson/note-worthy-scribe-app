import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightCard } from "@/types/complexCareTypes";
import { TrendingUp, Pill, Activity, Award, Target, AlertCircle } from "lucide-react";

interface InsightsPanelProps {
  insights: InsightCard[];
}

export const InsightsPanel = ({ insights }: InsightsPanelProps) => {
  const getIcon = (type: InsightCard['type']) => {
    switch (type) {
      case 'preventable-admissions':
        return <Target className="h-5 w-5 text-[#DC143C]" />;
      case 'medication-optimization':
        return <Pill className="h-5 w-5 text-[#FF8C00]" />;
      case 'trending':
        return <TrendingUp className="h-5 w-5 text-[#ffc107]" />;
      case 'cqc-indicators':
        return <Award className="h-5 w-5 text-[#28a745]" />;
      case 'impact-metrics':
        return <Activity className="h-5 w-5 text-[#005EB8]" />;
      case 'immediate-actions':
        return <AlertCircle className="h-5 w-5 text-[#FF4500]" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-[#003087]">AI-Powered Insights</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card 
            key={insight.id}
            className="hover:shadow-lg transition-shadow border-t-4 border-t-[#005EB8]"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {getIcon(insight.type)}
                {insight.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <p className="text-3xl font-bold text-[#003087]">{insight.value}</p>
                {insight.subtitle && (
                  <p className="text-sm text-muted-foreground">{insight.subtitle}</p>
                )}
              </div>
              
              {insight.details && insight.details.length > 0 && (
                <div className="space-y-1">
                  {insight.details.map((detail, index) => (
                    <div 
                      key={index}
                      className="text-xs text-muted-foreground border-l-2 border-[#005EB8] pl-2 py-1"
                    >
                      {detail}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
