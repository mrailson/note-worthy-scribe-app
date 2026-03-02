import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useKO41bData } from "@/hooks/useKO41bData";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import {
  FileText, ExternalLink, ArrowLeft, CheckCircle2, AlertTriangle,
  Info, Calendar, Users, ClipboardList, Stethoscope, Printer, Loader2,
  HelpCircle, Mail, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

const FINANCIAL_YEARS = [
  { value: "2024-25", label: "2024-25 (1 Apr 2024 – 31 Mar 2025)" },
  { value: "2023-24", label: "2023-24 (1 Apr 2023 – 31 Mar 2024)" },
  { value: "2025-26", label: "2025-26 (1 Apr 2025 – 31 Mar 2026)" },
];

const SDCS_URL = "https://datacollection.sdcs.digital.nhs.uk/";

const KO41bReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [financialYear, setFinancialYear] = useState("2024-25");
  const { data, loading, error } = useKO41bData(financialYear);

  // Editable overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const getVal = (key: string, autoVal: number) => {
    return overrides[key] !== undefined ? overrides[key] : autoVal;
  };

  const setOverride = (key: string, val: string) => {
    const num = parseInt(val) || 0;
    setOverrides(prev => ({ ...prev, [key]: num }));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-md mx-auto mt-20 px-4">
          <LoginForm />
        </div>
      </div>
    );
  }

  const totalNew = data ? getVal('totalNew', data.summary.totalNew) : 0;

  // Validation helpers
  const ageTotal = data ? data.ageBands.reduce((sum, b, i) => sum + getVal(`age_${i}`, b.count), 0) : 0;
  const statusTotal = data ? (
    getVal('status_patient', data.complainantStatus.patient) +
    getVal('status_relative', data.complainantStatus.relativeCarer) +
    getVal('status_other_rep', data.complainantStatus.otherRepresentative) +
    getVal('status_unknown', data.complainantStatus.unknown)
  ) : 0;
  const subjectTotal = data ? data.subjectAreas.reduce((sum, s, i) => sum + getVal(`subject_${i}`, s.count), 0) : 0;
  const staffTotal = data ? data.staffGroups.reduce((sum, g, i) => sum + getVal(`staff_${i}`, g.count), 0) : 0;

  const ValidationBadge = ({ valid, label }: { valid: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      )}
      <span className={valid ? "text-green-700" : "text-amber-600"}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO title="KO41b Annual Return | Complaints" description="KO41b annual return report for NHS GP practices" />
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl print:p-0">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate('/complaints')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Complaints
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#003087]">KO41b Annual Return</h1>
            <p className="text-muted-foreground mt-1">Written complaints annual data collection for NHS England</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" asChild>
              <a href={SDCS_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Open SDCS Portal
              </a>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto print:hidden">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="summary" className="text-xs sm:text-sm">1. Summary</TabsTrigger>
            <TabsTrigger value="age" className="text-xs sm:text-sm">2. Age</TabsTrigger>
            <TabsTrigger value="status" className="text-xs sm:text-sm">3. Status</TabsTrigger>
            <TabsTrigger value="subject" className="text-xs sm:text-sm">4. Subject</TabsTrigger>
            <TabsTrigger value="staff" className="text-xs sm:text-sm">5. Staff</TabsTrigger>
            <TabsTrigger value="review" className="text-xs sm:text-sm">Review</TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <Card className="border-[#005EB8] border-t-4">
              <CardHeader>
                <CardTitle className="text-[#003087] flex items-center gap-2">
                  <Info className="h-5 w-5" /> What is the KO41b?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed">
                <p>
                  The <strong>KO41b</strong> is a <strong>statutory annual return</strong> to NHS England reporting written complaints
                  received by GP practices during the financial year (1 April – 31 March). It is a requirement under the
                  2009 complaints regulations.
                </p>
                <p>
                  The data collected monitors written complaints and is published annually by NHS England to support
                  transparency and service improvement across primary care.
                </p>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#005EB8]" /> Who needs to complete it?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  All GP practices must submit the KO41b return. Where practices merge after 1 April, the open/merged
                  practice should submit including complaints from the closed practice.
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#005EB8]" /> When is it due?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  The submission window is typically <strong>May to July</strong> each year. For 2025-26, the window is
                  <strong> 18 May 2026 to 10 July 2026</strong>.
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-[#005EB8]" /> What information is needed?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { num: "1", title: "Summary Information", desc: "Brought forward, new, upheld, resolved and carried forward totals" },
                    { num: "2", title: "Age of Patient", desc: "New complaints broken down by patient age band" },
                    { num: "3", title: "Status of Complainant", desc: "Whether complaint was by patient, relative/carer or other" },
                    { num: "4", title: "Subject Area", desc: "Clinical treatment, communication, premises, administration, etc." },
                    { num: "5", title: "Staff Group", desc: "Practitioner, nursing, admin/reception or other" },
                  ].map(section => (
                    <div key={section.num} className="flex gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#005EB8] text-white flex items-center justify-center text-sm font-bold">
                        {section.num}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{section.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" /> How this tool helps
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>
                  This tool <strong>automatically calculates</strong> all KO41b values from your practice's complaints data.
                  Simply review the figures, make any adjustments needed, then transfer them to the official SDCS portal.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>All fields are pre-populated and editable for manual adjustment</li>
                  <li>Validation checks ensure totals match before submission</li>
                  <li>Print or export for your records</li>
                </ul>
              </CardContent>
            </Card>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="important-notes">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Important rules & guidance</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-3">
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Only <strong>written complaints</strong> should be included. Oral complaints and suggestions that do not require investigation should not be counted.</li>
                    <li>A written complaint includes one originally made orally but subsequently <strong>recorded in writing</strong> — once recorded, treat it as written from the outset.</li>
                    <li>If a single communication contains <strong>multiple complaints</strong> requiring separate investigation, count each separately.</li>
                    <li>Where a single complaint covers <strong>several aspects of care</strong>, record it once in the summary but record each subject area and staff group separately.</li>
                    <li>Investigations by outside agencies (Police, Coroners Court) should <strong>NOT</strong> be included.</li>
                    <li>GP out-of-hours complaints should be recorded on the KO41b <strong>unless</strong> the ICB directly employs the staff (in which case they go on KO41a).</li>
                    <li>Complaints received via the ICB should be recorded by <strong>whoever investigated and responded</strong>.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="contacts">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> NHS England contact details</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p><strong>SDCS technical issues:</strong> <a href="mailto:ssd.nationalservicedesk@nhs.net" className="text-[#005EB8] underline">ssd.nationalservicedesk@nhs.net</a></p>
                  <p><strong>Data definition queries:</strong> <a href="mailto:england.nhs.comp@nhs.net" className="text-[#005EB8] underline">england.nhs.comp@nhs.net</a></p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button size="lg" onClick={() => setActiveTab("summary")} className="bg-[#005EB8] hover:bg-[#003087]">
                <FileText className="h-4 w-4 mr-2" /> Generate My KO41b Report
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={SDCS_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Go to SDCS Submission Portal
                </a>
              </Button>
            </div>
          </TabsContent>

          {/* ===== DATA SECTIONS ===== */}
          {activeTab !== "overview" && (
            <div className="mt-4 mb-4 print:hidden">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Financial Year:</label>
                <Select value={financialYear} onValueChange={setFinancialYear}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_YEARS.map(fy => (
                      <SelectItem key={fy.value} value={fy.value}>{fy.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {loading && activeTab !== "overview" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#005EB8]" />
              <span className="ml-2 text-muted-foreground">Loading complaints data…</span>
            </div>
          )}

          {error && activeTab !== "overview" && (
            <Card className="border-destructive">
              <CardContent className="py-6 text-destructive text-sm">{error}</CardContent>
            </Card>
          )}

          {data && !loading && (
            <>
              {/* Section 1: Summary */}
              <TabsContent value="summary" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#005EB8] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Section 1: Summary Information</CardTitle>
                    <CardDescription className="text-blue-100">
                      All boxes require a value. Enter 0 if no value applies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {[
                      { key: 'totalBroughtForward', label: 'Total Brought Forward', desc: 'Unresolved complaints from previous year', auto: data.summary.totalBroughtForward },
                      { key: 'totalNew', label: 'Total New', desc: 'New written complaints received in the reporting period', auto: data.summary.totalNew },
                      { key: 'numberUpheld', label: 'Number Upheld', desc: 'Substantive evidence supports the complaint', auto: data.summary.numberUpheld },
                      { key: 'numberPartiallyUpheld', label: 'Number Partially Upheld', desc: 'One or more (but not all) aspects upheld', auto: data.summary.numberPartiallyUpheld },
                      { key: 'numberNotUpheld', label: 'Number Not Upheld', desc: 'No evidence to support any aspect', auto: data.summary.numberNotUpheld },
                    ].map(field => (
                      <div key={field.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                        <div>
                          <p className="font-medium text-sm">{field.label}</p>
                          <p className="text-xs text-muted-foreground">{field.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={getVal(field.key, field.auto)}
                            onChange={e => setOverride(field.key, e.target.value)}
                          />
                          {overrides[field.key] === undefined && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <hr />

                    {/* Auto-calculated fields */}
                    {(() => {
                      const upheld = getVal('numberUpheld', data.summary.numberUpheld);
                      const partial = getVal('numberPartiallyUpheld', data.summary.numberPartiallyUpheld);
                      const notUpheld = getVal('numberNotUpheld', data.summary.numberNotUpheld);
                      const resolved = upheld + partial + notUpheld;
                      const bf = getVal('totalBroughtForward', data.summary.totalBroughtForward);
                      const newC = getVal('totalNew', data.summary.totalNew);
                      const carried = bf + newC - resolved;
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-muted/50 p-3 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">Total Resolved</p>
                              <p className="text-xs text-muted-foreground">Upheld + Partially Upheld + Not Upheld</p>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-lg font-bold">{resolved}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">Auto-calculated</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-muted/50 p-3 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">Total Carried Forward</p>
                              <p className="text-xs text-muted-foreground">(Brought Forward + New) − Resolved</p>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-lg font-bold">{carried}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">Auto-calculated</Badge>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex justify-end pt-4 print:hidden">
                      <Button onClick={() => setActiveTab("age")} className="bg-[#005EB8] hover:bg-[#003087]">
                        Save and Continue →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 2: Age of Patient */}
              <TabsContent value="age" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#005EB8] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Section 2: Age of Patient</CardTitle>
                    <CardDescription className="text-blue-100">
                      For new complaints only. Each box requires a value (enter 0 if none).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    {data.ageBands.map((band, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                        <p className="text-sm font-medium">{band.label}</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={getVal(`age_${i}`, band.count)}
                            onChange={e => setOverride(`age_${i}`, e.target.value)}
                          />
                          {overrides[`age_${i}`] === undefined && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <hr />
                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Age Total: <span className="text-lg font-bold">{ageTotal}</span></p>
                        <p className="text-xs text-muted-foreground">Total New Complaints: {totalNew}</p>
                      </div>
                      <ValidationBadge valid={ageTotal === totalNew} label={ageTotal === totalNew ? "Totals match" : `Must equal ${totalNew}`} />
                    </div>

                    <div className="flex justify-between pt-4 print:hidden">
                      <Button variant="outline" onClick={() => setActiveTab("summary")}>← Back</Button>
                      <Button onClick={() => setActiveTab("status")} className="bg-[#005EB8] hover:bg-[#003087]">Save and Continue →</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 3: Status of Complainant */}
              <TabsContent value="status" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#005EB8] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Section 3: Status of Complainant</CardTitle>
                    <CardDescription className="text-blue-100">
                      For new complaints only. Who made the complaint?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    {[
                      { key: 'status_patient', label: 'Patient', auto: data.complainantStatus.patient },
                      { key: 'status_relative', label: 'Relative / Carer', auto: data.complainantStatus.relativeCarer },
                      { key: 'status_other_rep', label: 'Other Representative', auto: data.complainantStatus.otherRepresentative },
                      { key: 'status_unknown', label: 'Unknown', auto: data.complainantStatus.unknown },
                    ].map(item => (
                      <div key={item.key} className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                        <p className="text-sm font-medium">{item.label}</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={getVal(item.key, item.auto)}
                            onChange={e => setOverride(item.key, e.target.value)}
                          />
                          {overrides[item.key] === undefined && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <hr />
                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Status Total: <span className="text-lg font-bold">{statusTotal}</span></p>
                        <p className="text-xs text-muted-foreground">Total New Complaints: {totalNew}</p>
                      </div>
                      <ValidationBadge valid={statusTotal === totalNew} label={statusTotal === totalNew ? "Totals match" : `Must equal ${totalNew}`} />
                    </div>

                    <div className="flex justify-between pt-4 print:hidden">
                      <Button variant="outline" onClick={() => setActiveTab("age")}>← Back</Button>
                      <Button onClick={() => setActiveTab("subject")} className="bg-[#005EB8] hover:bg-[#003087]">Save and Continue →</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 4: Subject Area */}
              <TabsContent value="subject" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#005EB8] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Section 4: Subject Area</CardTitle>
                    <CardDescription className="text-blue-100">
                      For new complaints only. A complaint may cover more than one subject area.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    {data.subjectAreas.map((subject, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                        <p className="text-sm font-medium">{subject.label}</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={getVal(`subject_${i}`, subject.count)}
                            onChange={e => setOverride(`subject_${i}`, e.target.value)}
                          />
                          {overrides[`subject_${i}`] === undefined && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <hr />
                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Subject Area Total: <span className="text-lg font-bold">{subjectTotal}</span></p>
                        <p className="text-xs text-muted-foreground">Total New Complaints: {totalNew} (total must be ≥ this value)</p>
                      </div>
                      <ValidationBadge valid={subjectTotal >= totalNew} label={subjectTotal >= totalNew ? "Valid" : `Must be ≥ ${totalNew}`} />
                    </div>

                    <div className="flex justify-between pt-4 print:hidden">
                      <Button variant="outline" onClick={() => setActiveTab("status")}>← Back</Button>
                      <Button onClick={() => setActiveTab("staff")} className="bg-[#005EB8] hover:bg-[#003087]">Save and Continue →</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 5: Staff Group */}
              <TabsContent value="staff" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#005EB8] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Section 5: Staff Group</CardTitle>
                    <CardDescription className="text-blue-100">
                      For new complaints only. A complaint may involve more than one staff group.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    {data.staffGroups.map((group, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                        <p className="text-sm font-medium">{group.label}</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={getVal(`staff_${i}`, group.count)}
                            onChange={e => setOverride(`staff_${i}`, e.target.value)}
                          />
                          {overrides[`staff_${i}`] === undefined && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <hr />
                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Staff Group Total: <span className="text-lg font-bold">{staffTotal}</span></p>
                        <p className="text-xs text-muted-foreground">Total New Complaints: {totalNew} (total must be ≥ this value)</p>
                      </div>
                      <ValidationBadge valid={staffTotal >= totalNew} label={staffTotal >= totalNew ? "Valid" : `Must be ≥ ${totalNew}`} />
                    </div>

                    <div className="flex justify-between pt-4 print:hidden">
                      <Button variant="outline" onClick={() => setActiveTab("subject")}>← Back</Button>
                      <Button onClick={() => setActiveTab("review")} className="bg-[#005EB8] hover:bg-[#003087]">Save and Continue →</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Review Tab */}
              <TabsContent value="review" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="bg-[#003087] text-white rounded-t-lg">
                    <CardTitle className="text-lg">Check Your Answers Before Submitting</CardTitle>
                    <CardDescription className="text-blue-200">
                      Review all sections below. Click "Change" to return to any section.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">

                    {/* Summary Review */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#003087]">1. Summary Information</h3>
                        <Button variant="link" size="sm" onClick={() => setActiveTab("summary")} className="print:hidden">Change</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        <span>Total Brought Forward:</span><span className="font-medium">{getVal('totalBroughtForward', data.summary.totalBroughtForward)}</span>
                        <span>Total New:</span><span className="font-medium">{getVal('totalNew', data.summary.totalNew)}</span>
                        <span>Number Upheld:</span><span className="font-medium">{getVal('numberUpheld', data.summary.numberUpheld)}</span>
                        <span>Number Partially Upheld:</span><span className="font-medium">{getVal('numberPartiallyUpheld', data.summary.numberPartiallyUpheld)}</span>
                        <span>Number Not Upheld:</span><span className="font-medium">{getVal('numberNotUpheld', data.summary.numberNotUpheld)}</span>
                        <span>Total Resolved:</span><span className="font-bold">{getVal('numberUpheld', data.summary.numberUpheld) + getVal('numberPartiallyUpheld', data.summary.numberPartiallyUpheld) + getVal('numberNotUpheld', data.summary.numberNotUpheld)}</span>
                        <span>Total Carried Forward:</span><span className="font-bold">{getVal('totalBroughtForward', data.summary.totalBroughtForward) + getVal('totalNew', data.summary.totalNew) - (getVal('numberUpheld', data.summary.numberUpheld) + getVal('numberPartiallyUpheld', data.summary.numberPartiallyUpheld) + getVal('numberNotUpheld', data.summary.numberNotUpheld))}</span>
                      </div>
                    </div>

                    {/* Age Review */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#003087]">2. Age of Patient</h3>
                        <Button variant="link" size="sm" onClick={() => setActiveTab("age")} className="print:hidden">Change</Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        {data.ageBands.map((b, i) => (
                          <div key={i}><span className="text-muted-foreground">{b.label}:</span> <span className="font-medium">{getVal(`age_${i}`, b.count)}</span></div>
                        ))}
                      </div>
                      <ValidationBadge valid={ageTotal === totalNew} label={`Total: ${ageTotal} (must equal ${totalNew})`} />
                    </div>

                    {/* Status Review */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#003087]">3. Status of Complainant</h3>
                        <Button variant="link" size="sm" onClick={() => setActiveTab("status")} className="print:hidden">Change</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        <span>Patient:</span><span className="font-medium">{getVal('status_patient', data.complainantStatus.patient)}</span>
                        <span>Relative / Carer:</span><span className="font-medium">{getVal('status_relative', data.complainantStatus.relativeCarer)}</span>
                        <span>Other Representative:</span><span className="font-medium">{getVal('status_other_rep', data.complainantStatus.otherRepresentative)}</span>
                        <span>Unknown:</span><span className="font-medium">{getVal('status_unknown', data.complainantStatus.unknown)}</span>
                      </div>
                      <ValidationBadge valid={statusTotal === totalNew} label={`Total: ${statusTotal} (must equal ${totalNew})`} />
                    </div>

                    {/* Subject Review */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#003087]">4. Subject Area</h3>
                        <Button variant="link" size="sm" onClick={() => setActiveTab("subject")} className="print:hidden">Change</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        {data.subjectAreas.map((s, i) => (
                          <><span key={`l${i}`}>{s.label}:</span><span key={`v${i}`} className="font-medium">{getVal(`subject_${i}`, s.count)}</span></>
                        ))}
                      </div>
                      <ValidationBadge valid={subjectTotal >= totalNew} label={`Total: ${subjectTotal} (must be ≥ ${totalNew})`} />
                    </div>

                    {/* Staff Review */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#003087]">5. Staff Group</h3>
                        <Button variant="link" size="sm" onClick={() => setActiveTab("staff")} className="print:hidden">Change</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        {data.staffGroups.map((g, i) => (
                          <><span key={`l${i}`}>{g.label}:</span><span key={`v${i}`} className="font-medium">{getVal(`staff_${i}`, g.count)}</span></>
                        ))}
                      </div>
                      <ValidationBadge valid={staffTotal >= totalNew} label={`Total: ${staffTotal} (must be ≥ ${totalNew})`} />
                    </div>

                    <hr />

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 print:hidden">
                      <Button variant="outline" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" /> Print for Records
                      </Button>
                      <Button size="lg" asChild className="bg-[#005EB8] hover:bg-[#003087]">
                        <a href={SDCS_URL} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Submit via SDCS Portal
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default KO41bReport;
