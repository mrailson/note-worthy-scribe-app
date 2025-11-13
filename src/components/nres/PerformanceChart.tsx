import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PracticePerformance } from "@/types/nresTypes";
import { InfoTooltip } from "./InfoTooltip";

interface PerformanceChartProps {
  data: PracticePerformance[];
}

export const PerformanceChart = ({ data }: PerformanceChartProps) => {
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#003087]">Average Review Time by Practice</h3>
        <InfoTooltip content="Average time taken for GPs to review and action hub consultation results. Target: <24 hours. Practices with >24hr average may need additional support." />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="practice" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-[#003087]">{payload[0].payload.practice}</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Avg Review Time:</span>{' '}
                      <span className="font-semibold">{payload[0].value}h</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">On-Time %:</span>{' '}
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

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#007F3B]" />
          <span>Excellent (&lt;18h)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#005EB8]" />
          <span>Good (&lt;24h)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FFB81C]" />
          <span>Needs Improvement (&lt;30h)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ED8B00]" />
          <span>Requires Support (&gt;30h)</span>
        </div>
      </div>
    </Card>
  );
};
