import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TrendingDown, TrendingUp, Minus, User, Calendar, AlertTriangle, Shield } from "lucide-react";
import { ProjectRisk, getRatingFromScore, getRatingBadgeStyles, getRiskTypeBadgeStyles, getRiskTypeLabel } from "./projectRisksData";

interface RiskMatrixHeatmapProps {
  risks: ProjectRisk[];
}

const getRiskLevelConfig = (score: number) => {
  if (score >= 16) return { level: "High", color: "bg-red-500", borderColor: "border-red-600" };
  if (score >= 10) return { level: "Significant", color: "bg-amber-500", borderColor: "border-amber-600" };
  if (score >= 5) return { level: "Moderate", color: "bg-yellow-400", borderColor: "border-yellow-500" };
  return { level: "Low", color: "bg-green-500", borderColor: "border-green-600" };
};

const getScoreTrendIcon = (original: number, current: number) => {
  if (current < original) return { icon: TrendingDown, color: "text-green-600", label: "Improved" };
  if (current > original) return { icon: TrendingUp, color: "text-red-600", label: "Worsened" };
  return { icon: Minus, color: "text-slate-400", label: "Unchanged" };
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

const formatDate = (dateStr: string) => {
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
    }
  }
  return dateStr;
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
          <div className="flex flex-wrap justify-center gap-0.5">
            {risksInCell.map((risk) => {
              const trend = getScoreTrendIcon(risk.originalScore, risk.currentScore);
              const TrendIcon = trend.icon;
              const rating = getRatingFromScore(risk.currentScore);
              
              return (
                <HoverCard key={risk.id} openDelay={100} closeDelay={50}>
                  <HoverCardTrigger asChild>
                    <div
                      className={`w-5 h-5 rounded-full bg-white/90 ${config.borderColor} border-2 flex items-center justify-center text-[10px] font-bold text-slate-700 cursor-pointer hover:scale-110 transition-transform hover:shadow-lg`}
                    >
                      {risk.id}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent 
                    side="right" 
                    align="start"
                    className="w-[340px] p-0 shadow-xl border-slate-200"
                  >
                    {/* Header */}
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 rounded-t-md">
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-full ${config.color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                          {risk.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-slate-900 leading-tight">
                            {risk.risk}
                          </h4>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getRiskTypeBadgeStyles(risk.riskType)}`}>
                              {getRiskTypeLabel(risk.riskType)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-300">
                              {risk.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Score Section */}
                    <div className="px-3 py-2 bg-white border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Score:</span>
                          <Badge variant="outline" className={`font-bold ${getRatingBadgeStyles(risk.currentScore)}`}>
                            {risk.currentScore} ({rating})
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <TrendIcon className={`w-3.5 h-3.5 ${trend.color}`} />
                          <span className={trend.color}>
                            {trend.label}
                          </span>
                          {risk.originalScore !== risk.currentScore && (
                            <span className="text-slate-400">(was {risk.originalScore})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-500">
                        <span>L: {risk.currentLikelihood} × C: {risk.currentConsequence}</span>
                        {risk.originalScore !== risk.currentScore && (
                          <span className="text-slate-400">
                            (was L: {risk.originalLikelihood} × C: {risk.originalConsequence})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-3 py-2 space-y-2.5 bg-white">
                      {/* Key Concerns */}
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Key Concerns</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {truncateText(risk.concerns, 150)}
                        </p>
                      </div>

                      {/* Mitigation */}
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Shield className="w-3 h-3 text-green-600" />
                          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Mitigation</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {truncateText(risk.mitigation, 150)}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 rounded-b-md flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{risk.owner}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Reviewed: {formatDate(risk.lastReviewed)}</span>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
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
          <span>Risk ID (hover for details)</span>
        </div>
      </div>
    </div>
  );
};
