import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Risk {
  id: number;
  risk: string;
  currentLikelihood: number;
  currentConsequence: number;
  currentScore: number;
}

interface RiskMatrixHeatmapProps {
  risks: Risk[];
}

const getRiskLevelConfig = (score: number) => {
  if (score >= 16) return { level: "High", color: "bg-red-500", borderColor: "border-red-600" };
  if (score >= 10) return { level: "Significant", color: "bg-amber-500", borderColor: "border-amber-600" };
  if (score >= 5) return { level: "Moderate", color: "bg-yellow-400", borderColor: "border-yellow-500" };
  return { level: "Low", color: "bg-green-500", borderColor: "border-green-600" };
};

export const RiskMatrixHeatmap = ({ risks }: RiskMatrixHeatmapProps) => {
  const getCell = (likelihood: number, consequence: number) => {
    const score = likelihood * consequence;
    const config = getRiskLevelConfig(score);
    const risksInCell = risks.filter(
      r => r.currentLikelihood === likelihood && r.currentConsequence === consequence
    );

    return (
      <td 
        key={consequence} 
        className={`border border-slate-300 p-1 text-center ${config.color} relative min-w-[60px] h-[50px]`}
      >
        <span className="text-[10px] font-bold text-white/70 absolute top-0.5 right-1">{score}</span>
        {risksInCell.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-wrap justify-center gap-0.5">
                  {risksInCell.map((risk) => (
                    <div
                      key={risk.id}
                      className={`w-5 h-5 rounded-full bg-white/90 ${config.borderColor} border-2 flex items-center justify-center text-[10px] font-bold text-slate-700 cursor-pointer hover:scale-110 transition-transform`}
                    >
                      {risk.id}
                    </div>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <div className="space-y-1">
                  {risksInCell.map((risk) => (
                    <div key={risk.id} className="text-xs">
                      <span className="font-semibold">#{risk.id}:</span> {risk.risk}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </td>
    );
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200">
      <h4 className="font-semibold text-slate-900 mb-3 text-sm">Risk Position Heatmap</h4>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 p-2 text-left w-24">Likelihood</th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]" colSpan={5}>Consequence →</th>
            </tr>
            <tr>
              <th className="border border-slate-300 bg-slate-100 p-2"></th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]">1</th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]">2</th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]">3</th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]">4</th>
              <th className="border border-slate-300 bg-slate-100 p-1 text-center text-[10px]">5</th>
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((likelihood) => (
              <tr key={likelihood}>
                <td className="border border-slate-300 bg-slate-50 p-2 font-semibold text-center">{likelihood}</td>
                {[1, 2, 3, 4, 5].map((consequence) => getCell(likelihood, consequence))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Low (1-4)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-400"></div>
          <span>Moderate (5-9)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span>Significant (10-15)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>High (16-25)</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-4 h-4 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center text-[8px] font-bold">1</div>
          <span>Risk ID position</span>
        </div>
      </div>
    </div>
  );
};
