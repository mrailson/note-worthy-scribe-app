import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PracticePerformance } from "@/types/nresTypes";
import { InfoTooltip } from "./InfoTooltip";

interface PerformanceChartProps {
  data: PracticePerformance[];
  isIPhone?: boolean;
}

export const PerformanceChart = ({ data, isIPhone = false }: PerformanceChartProps) => {
  const chartData = data.map(d => ({
    practice: d.practice,
    hours: d.averageReviewTime,
    percentage: d.onTimePercentage
  }));

  const getBarColor = (hours: number) => {
    if (hours <= 18) return '#007F3B'; // Green - excellent
    if (hours <= 24) return '#005EB8'; // Blue - good
    if (hours <= 30) return '#FFB81C'; // Yellow - needs improvement
    return '#ED8B00'; // Orange - requires support
  };

  return (
    <Card className={isIPhone ? "p-3" : "p-6"}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-[#003087] ${isIPhone ? 'text-sm' : 'text-lg'}`}>
          {isIPhone ? 'Avg Review Time' : 'Average Review Time by Practice'}
        </h3>
        <InfoTooltip content="Average time taken for GPs to review and action hub consultation results. Target: <24 hours. Practices with >24hr average may need additional support." />
      </div>

      <ResponsiveContainer width="100%" height={isIPhone ? 200 : 300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="practice" 
            angle={isIPhone ? -60 : -45}
            textAnchor="end"
            height={isIPhone ? 80 : 100}
            tick={{ fontSize: isIPhone ? 9 : 12 }}
            interval={0}
          />
          <YAxis 
            label={isIPhone ? undefined : { value: 'Hours', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: isIPhone ? 10 : 12 }}
            width={isIPhone ? 30 : 60}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-semibold text-[#003087]">{payload[0].payload.practice}</p>
                    <p>
                      <span className="text-muted-foreground">Avg:</span>{' '}
                      <span className="font-semibold">{payload[0].value}h</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">On-Time:</span>{' '}
                      <span className="font-semibold">{payload[0].payload.percentage}%</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.hours)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className={`mt-3 flex flex-wrap gap-2 ${isIPhone ? 'text-[10px]' : 'text-xs gap-4 mt-4'}`}>
        <div className="flex items-center gap-1">
          <div className={`rounded-full bg-[#007F3B] ${isIPhone ? 'w-2 h-2' : 'w-3 h-3'}`} />
          <span>&lt;18h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`rounded-full bg-[#005EB8] ${isIPhone ? 'w-2 h-2' : 'w-3 h-3'}`} />
          <span>&lt;24h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`rounded-full bg-[#FFB81C] ${isIPhone ? 'w-2 h-2' : 'w-3 h-3'}`} />
          <span>&lt;30h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`rounded-full bg-[#ED8B00] ${isIPhone ? 'w-2 h-2' : 'w-3 h-3'}`} />
          <span>&gt;30h</span>
        </div>
      </div>
    </Card>
  );
};
