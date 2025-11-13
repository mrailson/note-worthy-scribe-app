import { Card, CardContent } from "@/components/ui/card";
import { StatisticData } from "@/types/complexCareTypes";
import { InfoTooltip } from "../InfoTooltip";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatisticsGridProps {
  statistics: StatisticData[];
}

export const StatisticsGrid = ({ statistics }: StatisticsGridProps) => {
  const getColorConfig = (color: StatisticData['color']) => {
    switch (color) {
      case 'critical':
        return {
          border: 'border-l-[#DC143C]',
          bg: 'bg-gradient-to-br from-red-50 to-white',
          text: 'text-[#DC143C]',
        };
      case 'high':
        return {
          border: 'border-l-[#FF4500]',
          bg: 'bg-gradient-to-br from-orange-50 to-white',
          text: 'text-[#FF4500]',
        };
      case 'success':
        return {
          border: 'border-l-[#28a745]',
          bg: 'bg-gradient-to-br from-green-50 to-white',
          text: 'text-[#28a745]',
        };
      case 'primary':
        return {
          border: 'border-l-[#005EB8]',
          bg: 'bg-gradient-to-br from-blue-50 to-white',
          text: 'text-[#005EB8]',
        };
      default:
        return {
          border: 'border-l-gray-300',
          bg: 'bg-white',
          text: 'text-gray-700',
        };
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statistics.map((stat, index) => {
        const colors = getColorConfig(stat.color);
        const isIncrease = stat.change.includes('↑');
        
        return (
          <Card
            key={index}
            className={cn(
              "border-l-4 hover:shadow-lg transition-shadow cursor-default",
              colors.border,
              colors.bg
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#003087]">
                  {stat.label}
                </h3>
                <InfoTooltip content={stat.tooltip} />
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-bold", colors.text)}>
                  {stat.count}
                </span>
              </div>
              
              <div className="flex items-center gap-1 mt-2">
                {isIncrease ? (
                  <TrendingUp className={cn("h-4 w-4", stat.color === 'success' ? 'text-green-600' : 'text-red-600')} />
                ) : (
                  <TrendingDown className={cn("h-4 w-4", stat.color === 'success' ? 'text-red-600' : 'text-green-600')} />
                )}
                <span className="text-sm text-muted-foreground">{stat.change}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
