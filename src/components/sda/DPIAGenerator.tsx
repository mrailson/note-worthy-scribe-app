import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Download, Mail, Printer, Plus, Pencil, Trash2,
  Eye, RefreshCw, Loader2, ArrowLeft, Shield, CheckCircle2
} from "lucide-react";
import { DPIA_EXTRACT_PROMPT, DPIA_GENERATE_PROMPT } from "@/lib/dpia-prompts";

// ---- Types ----
interface DPIAPractice {
  id: string;
  practice_name: string;
  practice_address: string;
  ods_code: string;
  practice_tel: string;
  pm_name: string;
  pm_email: string;
  ico_reg: string;
  dspt_status: string;
  cg_name: string;
  cg_role: string;
  cg_email: string;
  dpo_name: string;
  dpo_org: string;
  dpo_email: string;
  dpo_tel: string;
  source_file: string | null;
  completed_by: string;
  completed_role: string;
  completed_date: string;
  dpia_generated: boolean;
  dpia_date: string | null;
  dpia_html: string | null;
  user_id?: string;
}

const EMPTY_PRACTICE: Omit<DPIAPractice, "id"> = {
  practice_name: "", practice_address: "", ods_code: "", practice_tel: "",
  pm_name: "", pm_email: "", ico_reg: "", dspt_status: "Standards Met",
  cg_name: "", cg_role: "", cg_email: "",
  dpo_name: "", dpo_org: "", dpo_email: "", dpo_tel: "",
  source_file: null, completed_by: "", completed_role: "", completed_date: "",
  dpia_generated: false, dpia_date: null, dpia_html: null,
};

const FORM_SECTIONS = [
  { title: "Practice Information", fields: [
    { key: "practice_name", label: "Practice Name", required: true },
    { key: "practice_address", label: "Address", required: true, wide: true },
    { key: "ods_code", label: "ODS Code", required: true },
    { key: "practice_tel", label: "Telephone" },
    { key: "pm_name", label: "Practice Manager", required: true },
    { key: "pm_email", label: "PM Email", required: true },
  ]},
  { title: "Information Governance", fields: [
    { key: "ico_reg", label: "ICO Registration", required: true },
    { key: "dspt_status", label: "DSPT Status", type: "select" as const,
      options: ["Standards Met", "Standards Not Met", "Approaching Standards"] },
  ]},
  { title: "Caldicott Guardian", fields: [
    { key: "cg_name", label: "Name", required: true },
    { key: "cg_role", label: "Role" },
    { key: "cg_email", label: "Email", required: true },
  ]},
  { title: "Data Protection Officer", fields: [
    { key: "dpo_name", label: "Name", required: true },
    { key: "dpo_org", label: "Organisation" },
    { key: "dpo_email", label: "Email", required: true },
    { key: "dpo_tel", label: "Telephone" },
  ]},
];

// ---- AI call helper — routes through gpt5-fast-clinical ----
async function callAI(prompt: string, maxTokens = 4096): Promise<string> {
  const { data, error } = await supabase.functions.invoke("gpt5-fast-clinical", {
    body: {
      messages: [{ role: "system", content: "You are a data extraction assistant. Return only what is asked, no web search needed." }, { role: "user", content: prompt }],
      max_tokens: maxTokens,
      skipWebSearch: true,
    },
  });
  if (error) throw new Error(error.message || "AI request failed");

  // data may be: a string, an object with .response/.text/.choices, or null
  if (!data) throw new Error("No response from AI");
  if (typeof data === "string") return data;
  
  const raw = data.response || data.text || data.choices?.[0]?.message?.content;
  if (typeof raw === "string") return raw;
  if (raw != null) return JSON.stringify(raw);
  
  // Last resort: stringify the entire data object
  return JSON.stringify(data);
}

// ---- File parser ----
async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ---- Word download helper ----
function downloadAsWord(html: string, practiceName: string) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<title>DPIA - Notewell AI - ${practiceName}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #212b32; line-height: 1.6; }
  h1 { color: #005EB8; font-size: 18pt; border-bottom: 2px solid #005EB8; padding-bottom: 6px; }
  h2 { color: #003087; font-size: 14pt; margin-top: 20px; }
  h3 { color: #005EB8; font-size: 12pt; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 6px 10px; font-size: 10pt; vertical-align: top; }
  th { background: #005EB8; color: white; text-align: left; font-weight: bold; }
  tr:nth-child(even) { background: #f5f7fa; }
</style>
</head><body>${html}</body></html>`;

  const blob = new Blob([doc], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DPIA_Notewell_AI_${practiceName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Main Component ----
export default function DPIAGenerator() {
  const { toast } = useToast();
  const [practices, setPractices] = useState<DPIAPractice[]>([]);
  const [view, setView] = useState<"list" | "form" | "preview">("list");
  const [current, setCurrent] = useState<DPIAPractice | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [dpiaHtml, setDpiaHtml] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load practices
  const loadPractices = useCallback(async () => {
    const { data, error } = await supabase
      .from("dpia_practices")
      .select("*")
      .order("practice_name");
    if (!error && data) setPractices(data as unknown as DPIAPractice[]);
  }, []);

  useEffect(() => { loadPractices(); }, [loadPractices]);

  // ---- File upload & parse ----
  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast({ title: "Please upload a .docx file", variant: "destructive" });
      return;
    }
    setBusy(true);
    setBusyMsg("Reading document…");
    try {
      const text = await extractTextFromDocx(file);
      if (text.length < 50) throw new Error("Could not extract text from document");

      setBusyMsg("Extracting practice details with AI…");
      const json = await callAI(DPIA_EXTRACT_PROMPT(text.slice(0, 6000)));
      const cleaned = json.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const practice: DPIAPractice = {
        ...EMPTY_PRACTICE,
        id: crypto.randomUUID(),
        practice_name: parsed.practiceName || "",
        practice_address: parsed.practiceAddress || "",
        ods_code: parsed.odsCode || "",
        practice_tel: parsed.practiceTel || "",
        pm_name: parsed.pmName || "",
        pm_email: parsed.pmEmail || "",
        ico_reg: parsed.icoReg || "",
        dspt_status: parsed.dsptStatus || "Standards Met",
        cg_name: parsed.cgName || "",
        cg_role: parsed.cgRole || "",
        cg_email: parsed.cgEmail || "",
        dpo_name: parsed.dpoName || "",
        dpo_org: parsed.dpoOrg || "",
        dpo_email: parsed.dpoEmail || "",
        dpo_tel: parsed.dpoTel || "",
        source_file: file.name,
        completed_by: parsed.completedBy || "",
        completed_role: parsed.completedRole || "",
        completed_date: parsed.completedDate || "",
      };

      setCurrent(practice);
      setView("form");
      toast({ title: `Extracted details for ${practice.practice_name}` });
    } catch (err: any) {
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // ---- Save practice ----
  const savePractice = async () => {
    if (!current) return;
    const required = ["practice_name", "ods_code", "pm_name", "pm_email", "ico_reg", "cg_name", "cg_email", "dpo_name", "dpo_email"];
    const missing = required.filter(k => !(current as any)[k]?.trim());
    if (missing.length) {
      toast({ title: "Missing required fields", description: missing.join(", "), variant: "destructive" });
      return;
    }

    setBusy(true);
    setBusyMsg("Saving…");
    try {
      const existing = practices.find(p => p.id === current.id);
      if (existing) {
        const { id: _id, user_id: _uid, ...updateData } = current;
        const { error } = await supabase.from("dpia_practices").update(updateData).eq("id", current.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { id: _id2, ...insertData } = current;
        const { error } = await supabase.from("dpia_practices").insert({ ...insertData, user_id: user?.id });
        if (error) throw error;
      }

      await loadPractices();
      setView("list");
      toast({ title: `${current.practice_name} saved` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // ---- Generate DPIA ----
  const generateDPIA = async (practice: DPIAPractice) => {
    setBusy(true);
    setBusyMsg(`Generating DPIA for ${practice.practice_name}…`);
    try {
      const html = await callAI(DPIA_GENERATE_PROMPT(practice), 8000);
      const dateStr = new Date().toLocaleDateString("en-GB");

      await supabase.from("dpia_practices").update({
        dpia_generated: true,
        dpia_date: dateStr,
        dpia_html: html,
      }).eq("id", practice.id);

      setDpiaHtml(html);
      setCurrent({ ...practice, dpia_generated: true, dpia_date: dateStr, dpia_html: html });
      await loadPractices();
      setView("preview");
      toast({ title: "DPIA generated successfully" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // ---- View existing DPIA ----
  const viewDPIA = (practice: DPIAPractice) => {
    if (practice.dpia_html) {
      setDpiaHtml(practice.dpia_html);
      setCurrent(practice);
      setView("preview");
    } else {
      toast({ title: "No DPIA found — please generate first", variant: "destructive" });
    }
  };

  // ---- Delete ----
  const deletePractice = async (id: string) => {
    if (!confirm("Delete this practice record and any generated DPIA?")) return;
    await supabase.from("dpia_practices").delete().eq("id", id);
    await loadPractices();
    toast({ title: "Practice deleted" });
  };

  // ---- Email ----
  const emailDPIA = () => {
    if (!current) return;
    const to = encodeURIComponent(current.pm_email || "");
    const cc = encodeURIComponent(current.cg_email || "");
    const subj = encodeURIComponent(`DPIA — Notewell AI — ${current.practice_name}`);
    const body = encodeURIComponent(
      `Dear ${current.pm_name},\n\n` +
      `Please find the Data Protection Impact Assessment for ${current.practice_name} ` +
      `regarding the deployment of Notewell AI.\n\n` +
      `Please download the document from the NRES Dashboard, review, and arrange sign-off ` +
      `with your Caldicott Guardian (${current.cg_name}) and DPO (${current.dpo_name}).\n\n` +
      `Kind regards,\nMalcolm Railson\nDigital & Transformation Lead\nNRES Programme`
    );
    window.open(`mailto:${to}?cc=${cc}&subject=${subj}&body=${body}`);
  };

  // ---- Loading overlay ----
  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#005EB8]" />
        <p className="text-sm text-slate-600 font-medium">{busyMsg}</p>
      </div>
    );
  }

  // ========== LIST VIEW ==========
  if (view === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#005EB8]" />
            <h2 className="text-lg font-semibold text-slate-800">DPIA Generator</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload Template
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCurrent({ ...EMPTY_PRACTICE, id: crypto.randomUUID() } as DPIAPractice);
                setView("form");
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Manually
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Drop zone */}
        <Card
          className="border-2 border-dashed border-slate-300 hover:border-[#005EB8]/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Upload className="w-8 h-8 text-slate-400" />
            <p className="text-sm text-slate-500">Drop a completed DPIA Data Collection Template (.docx) here</p>
            <p className="text-xs text-slate-400">or click to browse</p>
          </CardContent>
        </Card>

        {/* Practice list */}
        {practices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              No practices yet. Upload a completed template or add manually.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {practices.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-800 truncate">{p.practice_name}</h3>
                      <Badge variant="outline" className="text-xs shrink-0">{p.ods_code}</Badge>
                      {p.dpia_generated ? (
                        <Badge className="bg-green-100 text-green-800 text-xs shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          DPIA Generated
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      PM: {p.pm_name} · CG: {p.cg_name} · DPO: {p.dpo_name}
                      {p.dpia_date && ` · Generated: ${p.dpia_date}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    {p.dpia_generated && (
                      <Button variant="ghost" size="icon" onClick={() => viewDPIA(p)} title="View DPIA">
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => generateDPIA(p)}
                      title={p.dpia_generated ? "Regenerate DPIA" : "Generate DPIA"}
                    >
                      {p.dpia_generated ? <RefreshCw className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setCurrent(p); setView("form"); }} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePractice(p.id)} title="Delete" className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ========== FORM VIEW ==========
  if (view === "form" && current) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-lg font-semibold text-slate-800">
            {current.practice_name || "New Practice"}
          </h2>
          {current.source_file && (
            <Badge variant="outline" className="text-xs">
              Source: {current.source_file}
            </Badge>
          )}
        </div>

        {FORM_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold text-[#005EB8]">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map((field) => (
                  <div key={field.key} className={field.wide ? "sm:col-span-2" : ""}>
                    <Label className="text-xs text-slate-600">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    {field.type === "select" ? (
                      <Select
                        value={(current as any)[field.key] || ""}
                        onValueChange={(v) => setCurrent({ ...current, [field.key]: v })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-8 text-sm mt-1"
                        value={(current as any)[field.key] || ""}
                        onChange={(e) => setCurrent({ ...current, [field.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
          <Button onClick={savePractice}>Save Practice</Button>
        </div>
      </div>
    );
  }

  // ========== PREVIEW VIEW ==========
  if (view === "preview" && current) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView("list")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h2 className="text-lg font-semibold text-slate-800">
              DPIA — {current.practice_name}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadAsWord(dpiaHtml, current.practice_name)}>
              <Download className="w-4 h-4 mr-1" />
              Word
            </Button>
            <Button variant="outline" size="sm" onClick={emailDPIA}>
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(`<html><head><title>DPIA — ${current.practice_name}</title>
                  <style>
                    body { font-family: Arial, sans-serif; font-size: 11pt; color: #212b32; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2cm; }
                    h1 { color: #005EB8; } h2 { color: #003087; } h3 { color: #005EB8; }
                    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                    th, td { border: 1px solid #999; padding: 6px 10px; font-size: 10pt; }
                    th { background: #005EB8; color: white; }
                    @media print { body { padding: 0; } }
                  </style>
                </head><body>${dpiaHtml}</body></html>`);
                w.document.close();
                w.print();
              }
            }}>
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
            <Button size="sm" onClick={() => generateDPIA(current)}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div
              className="prose prose-sm max-w-none dpia-preview"
              dangerouslySetInnerHTML={{ __html: dpiaHtml }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
