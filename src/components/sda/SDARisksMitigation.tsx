import { useState, useMemo } from "react";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, ChevronDown, TrendingDown, TrendingUp, Minus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { RiskAssessmentGuidance } from "./risk-register/RiskAssessmentGuidance";
import { RiskMatrixHeatmap } from "./risk-register/RiskMatrixHeatmap";
import { RiskEditDialog } from "./risk-register/RiskEditDialog";
import { projectRisks as initialProjectRisks, getRatingFromScore, getRatingBadgeStyles, getRiskTypeBadgeStyles, getRiskTypeLabel, ProjectRisk, AssuranceItem } from "./risk-register/projectRisksData";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

type SortField = 'id' | 'risk' | 'riskType' | 'originalScore' | 'currentScore' | 'category' | 'owner';
type SortDirection = 'asc' | 'desc';



export const SDARisksMitigation = () => {
  const [risks, setRisks] = useState<ProjectRisk[]>(initialProjectRisks);
  const [editingRisk, setEditingRisk] = useState<ProjectRisk | null>(null);
  const [sortField, setSortField] = useState<SortField>('currentScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { practiceContext } = usePracticeContext();
  

  // Risk summary calculations (reactive to state)
  const riskSummary = useMemo(() => ({
    high: risks.filter(r => r.currentScore >= 16).length,
    significant: risks.filter(r => r.currentScore >= 10 && r.currentScore < 16).length,
    moderate: risks.filter(r => r.currentScore >= 5 && r.currentScore < 10).length,
    low: risks.filter(r => r.currentScore < 5).length,
    requiresEscalation: risks.filter(r => r.currentScore >= 12).length,
  }), [risks]);
  
  const handleRiskSave = (updated: ProjectRisk) => {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const getScoreChangeIndicator = (original: number, current: number) => {
    if (current < original) return <TrendingDown className="w-3 h-3 text-green-600" />;
    if (current > original) return <TrendingUp className="w-3 h-3 text-red-600" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-[#005EB8]" />
      : <ArrowDown className="w-3 h-3 ml-1 text-[#005EB8]" />;
  };

  const sortedRisks = useMemo(() => {
    const sorted = [...risks].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'risk':
          aValue = a.risk.toLowerCase();
          bValue = b.risk.toLowerCase();
          break;
        case 'riskType':
          const typeOrder = { principal: 0, operational: 1, project: 2 };
          aValue = typeOrder[a.riskType];
          bValue = typeOrder[b.riskType];
          break;
        case 'originalScore':
          aValue = a.originalScore;
          bValue = b.originalScore;
          break;
        case 'currentScore':
          aValue = a.currentScore;
          bValue = b.currentScore;
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'owner':
          aValue = a.owner.toLowerCase();
          bValue = b.owner.toLowerCase();
          break;
        default:
          aValue = a.currentScore;
          bValue = b.currentScore;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [risks, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={["risk-guidance", "risks-register"]} className="space-y-4">
        
        {/* PML Risk Assessment Framework */}
        <RiskAssessmentGuidance />

        {/* Project Risks Register */}
        <AccordionItem value="risks-register" className="border-0">
          <Card className="bg-white border-0 shadow-sm overflow-hidden">
            <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <div className="text-left">
                    <CardTitle className="text-lg font-semibold text-slate-900">Project Risks Register</CardTitle>
                    <p className="text-sm text-slate-500">Full risk register with PML framework – {risks.length} risks tracked</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {riskSummary.high} High
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {riskSummary.significant} Significant
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    {riskSummary.requiresEscalation} Require Escalation (≥12)
                  </Badge>
                  <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0 space-y-6 px-2 sm:px-4">
                
                {/* Risk Matrix Heatmap */}
                <RiskMatrixHeatmap risks={risks} />

                {/* Risk Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-50">
                      <TableRow className="bg-slate-50">
                        <TableHead 
                          className="w-[40px] font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center"># {getSortIcon('id')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('risk')}
                        >
                          <div className="flex items-center">Risk {getSortIcon('risk')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('riskType')}
                        >
                          <div className="flex items-center">Type {getSortIcon('riskType')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs text-center cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('originalScore')}
                        >
                          <div className="flex items-center justify-center">Original<br/>Score {getSortIcon('originalScore')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs text-center cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('currentScore')}
                        >
                          <div className="flex items-center justify-center">Current<br/>Score {getSortIcon('currentScore')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('currentScore')}
                        >
                          <div className="flex items-center">Rating {getSortIcon('currentScore')}</div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs min-w-[200px]">Key Concerns</TableHead>
                        <TableHead className="font-semibold text-xs min-w-[200px]">Mitigation</TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('owner')}
                        >
                          <div className="flex items-center">Owner {getSortIcon('owner')}</div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs">Last<br/>Reviewed</TableHead>
                        <TableHead className="font-semibold text-xs min-w-[180px]">Assurance Indicators<br/><span className="text-[10px] font-normal text-slate-500">(Progress Tracking)</span></TableHead>
                        <TableHead className="font-semibold text-xs w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRisks.map((risk) => {
                        const IconComponent = risk.icon;
                        return (
                          <TableRow key={risk.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-semibold text-slate-500 text-xs">{risk.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <IconComponent className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div>
                                  <span className="font-medium text-slate-900 text-xs">{risk.risk}</span>
                                  {risk.comments && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">{risk.comments}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${getRiskTypeBadgeStyles(risk.riskType)} text-[10px]`}>
                                {getRiskTypeLabel(risk.riskType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="text-xs text-slate-500">
                                {risk.originalLikelihood}×{risk.originalConsequence}=
                                <span className="font-semibold">{risk.originalScore}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs">
                                  {risk.currentLikelihood}×{risk.currentConsequence}=
                                  <span className="font-bold">{risk.currentScore}</span>
                                </span>
                                {getScoreChangeIndicator(risk.originalScore, risk.currentScore)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${getRatingBadgeStyles(risk.currentScore)} text-[10px]`}>
                                {getRatingFromScore(risk.currentScore)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-600">{risk.concerns}</TableCell>
                            <TableCell className="text-[11px] text-slate-600">{risk.mitigation}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{risk.owner}</TableCell>
                            <TableCell className="text-xs text-slate-500">{risk.lastReviewed}</TableCell>
                            <TableCell className="text-[11px]">
                              <div className="space-y-1.5">
                                {risk.assuranceIndicators.map((indicator) => (
                                  <div key={indicator.id} className="flex items-start gap-2">
                                    <Checkbox 
                                      id={`indicator-${risk.id}-${indicator.id}`}
                                      checked={indicator.completed}
                                      className="mt-0.5 h-3.5 w-3.5"
                                      disabled
                                    />
                                    <label 
                                      htmlFor={`indicator-${risk.id}-${indicator.id}`}
                                      className={`text-[11px] leading-tight ${indicator.completed ? 'text-green-700 line-through' : 'text-slate-600'}`}
                                    >
                                      {indicator.text}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingRisk(risk)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Risk Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{riskSummary.high}</div>
                    <div className="text-xs text-red-600">High (16-25)</div>
                    <div className="text-[10px] text-red-500 mt-1">Immediate action required</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{riskSummary.significant}</div>
                    <div className="text-xs text-amber-600">Significant (10-15)</div>
                    <div className="text-[10px] text-amber-500 mt-1">Active management</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{riskSummary.moderate}</div>
                    <div className="text-xs text-yellow-600">Moderate (5-9)</div>
                    <div className="text-[10px] text-yellow-500 mt-1">Monitor and manage</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{riskSummary.low}</div>
                    <div className="text-xs text-green-600">Low (1-4)</div>
                    <div className="text-[10px] text-green-500 mt-1">Routine monitoring</div>
                  </div>
                </div>

                {/* Escalation Notice */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Governance Escalation Required</h4>
                  </div>
                  <p className="text-sm text-purple-700">
                    <strong>{riskSummary.requiresEscalation} risks</strong> have a score of ≥12 and require review by the Programme Board and ICB per the PML Risk Assessment Framework.
                  </p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>



      </Accordion>

      <RiskEditDialog
        risk={editingRisk}
        open={!!editingRisk}
        onOpenChange={(open) => { if (!open) setEditingRisk(null); }}
        onSave={handleRiskSave}
      />
    </div>
  );
};
