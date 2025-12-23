import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, ChevronDown, Info, AlertTriangle, ShieldCheck, AlertCircle } from "lucide-react";

const likelihoodScale = [
  { level: 1, descriptor: "Rare", probability: "<5%", description: "May occur only in exceptional circumstances" },
  { level: 2, descriptor: "Unlikely", probability: "5-25%", description: "Could occur but not expected" },
  { level: 3, descriptor: "Possible", probability: "25-50%", description: "Might occur at some time" },
  { level: 4, descriptor: "Likely", probability: "50-75%", description: "Will probably occur in most circumstances" },
  { level: 5, descriptor: "Almost Certain", probability: ">75%", description: "Expected to occur in most circumstances" },
];

const consequenceDescriptors = [
  { 
    level: 1, 
    descriptor: "Negligible",
    service: "Minimal impact, easily absorbed",
    financial: "<£10k",
    reputation: "Minor local concern",
    safety: "No harm"
  },
  { 
    level: 2, 
    descriptor: "Minor",
    service: "Short-term disruption, service continues",
    financial: "£10k-£50k",
    reputation: "Local media/patient concern",
    safety: "Near miss or minor injury"
  },
  { 
    level: 3, 
    descriptor: "Moderate",
    service: "Significant disruption, temporary reduced service",
    financial: "£50k-£250k",
    reputation: "Regional concern, formal complaints",
    safety: "Moderate harm, extended treatment"
  },
  { 
    level: 4, 
    descriptor: "Major",
    service: "Major service loss, extended period",
    financial: "£250k-£1m",
    reputation: "National media, regulatory scrutiny",
    safety: "Serious harm, permanent injury"
  },
  { 
    level: 5, 
    descriptor: "Catastrophic",
    service: "Complete service failure, organisational viability",
    financial: ">£1m",
    reputation: "Major national concern, intervention",
    safety: "Death or multiple serious injuries"
  },
];

const riskMatrix = [
  { likelihood: 5, consequences: [5, 10, 15, 20, 25] },
  { likelihood: 4, consequences: [4, 8, 12, 16, 20] },
  { likelihood: 3, consequences: [3, 6, 9, 12, 15] },
  { likelihood: 2, consequences: [2, 4, 6, 8, 10] },
  { likelihood: 1, consequences: [1, 2, 3, 4, 5] },
];

const getRiskLevelConfig = (score: number) => {
  if (score >= 16) return { level: "High", color: "bg-red-500", textColor: "text-white", description: "Immediate action required" };
  if (score >= 10) return { level: "Significant", color: "bg-amber-500", textColor: "text-white", description: "Active management required" };
  if (score >= 5) return { level: "Moderate", color: "bg-yellow-400", textColor: "text-slate-900", description: "Monitor and manage" };
  return { level: "Low", color: "bg-green-500", textColor: "text-white", description: "Accept with routine monitoring" };
};

export const RiskAssessmentGuidance = () => {
  return (
    <AccordionItem value="risk-guidance" className="border-0">
      <Card className="bg-white border-0 shadow-sm border-t-4 border-t-purple-600">
        <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
          <div className="flex items-center justify-between flex-wrap gap-4 w-full pr-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <CardTitle className="text-lg font-semibold text-slate-900">PML Risk Assessment Framework (DCB0129 Aligned)</CardTitle>
                <p className="text-sm text-slate-500">Scoring guidance, thresholds, and governance rules – Version 1.2</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Reference Guide
              </Badge>
              <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-6 pt-0">
            
            {/* Governance Rules */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">Governance Escalation Rules</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-sm text-slate-900">Score ≥12</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Must be reviewed by <strong>Programme Board</strong> and <strong>ICB</strong>. Requires formal escalation, documented mitigations, and Board approval of risk appetite.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-sm text-slate-900">Score &lt;12</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Managed by <strong>Project/Workstream Leads</strong> with quarterly reporting to Programme Board. Routine monitoring with local mitigation plans.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 5x5 Risk Matrix */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Risk Scoring Matrix (Likelihood × Consequence)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-left">Likelihood</th>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-center">1</th>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-center">2</th>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-center">3</th>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-center">4</th>
                        <th className="border border-slate-300 bg-slate-100 p-2 text-center">5</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskMatrix.map((row) => (
                        <tr key={row.likelihood}>
                          <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">{row.likelihood}</td>
                          {row.consequences.map((score, idx) => {
                            const config = getRiskLevelConfig(score);
                            return (
                              <td 
                                key={idx} 
                                className={`border border-slate-300 p-2 text-center font-bold ${config.color} ${config.textColor}`}
                              >
                                {score}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-slate-300 bg-slate-100 p-2 font-semibold">Consequence →</td>
                        <td className="border border-slate-300 bg-slate-100 p-2 text-center text-[10px]">Negligible</td>
                        <td className="border border-slate-300 bg-slate-100 p-2 text-center text-[10px]">Minor</td>
                        <td className="border border-slate-300 bg-slate-100 p-2 text-center text-[10px]">Moderate</td>
                        <td className="border border-slate-300 bg-slate-100 p-2 text-center text-[10px]">Major</td>
                        <td className="border border-slate-300 bg-slate-100 p-2 text-center text-[10px]">Catastrophic</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Risk Level Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span><strong>Low (1-4)</strong>: Accept with routine monitoring</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded bg-yellow-400"></div>
                    <span><strong>Moderate (5-9)</strong>: Monitor and manage</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span><strong>Significant (10-15)</strong>: Active management</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span><strong>High (16-25)</strong>: Immediate action required</span>
                  </div>
                </div>
              </div>

              {/* Likelihood Scale */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Likelihood Scale</h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">Level</TableHead>
                      <TableHead className="text-xs font-semibold">Descriptor</TableHead>
                      <TableHead className="text-xs font-semibold">Probability</TableHead>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {likelihoodScale.map((item) => (
                      <TableRow key={item.level}>
                        <TableCell className="text-xs font-bold">{item.level}</TableCell>
                        <TableCell className="text-xs font-medium">{item.descriptor}</TableCell>
                        <TableCell className="text-xs">{item.probability}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Consequence Descriptors */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Consequence Descriptors</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">Level</TableHead>
                      <TableHead className="text-xs font-semibold">Descriptor</TableHead>
                      <TableHead className="text-xs font-semibold">Service Impact</TableHead>
                      <TableHead className="text-xs font-semibold">Financial</TableHead>
                      <TableHead className="text-xs font-semibold">Reputation</TableHead>
                      <TableHead className="text-xs font-semibold">Safety</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consequenceDescriptors.map((item) => (
                      <TableRow key={item.level}>
                        <TableCell className="text-xs font-bold">{item.level}</TableCell>
                        <TableCell className="text-xs font-medium">{item.descriptor}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.service}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.financial}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.reputation}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.safety}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Risk Types */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-3">Risk Classification Types</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <Badge className="bg-red-100 text-red-700 border-red-200 mb-2">Principal Risk</Badge>
                  <p className="text-xs text-slate-600">
                    Threatens strategic business objectives across the organisation. Requires Board oversight and executive action.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-2">Operational Risk</Badge>
                  <p className="text-xs text-slate-600">
                    Threatens SDA innovation at service delivery level. Managed by operational leads with Programme Board reporting.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-2">Project Risk</Badge>
                  <p className="text-xs text-slate-600">
                    Limited to specific team, workstream, or project. Managed locally with escalation if score increases.
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
};
