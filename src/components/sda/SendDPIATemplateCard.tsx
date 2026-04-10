import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Send, Loader2, FileText, Download, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { NRES_PRACTICES, NRES_ODS_CODES, type NRESPracticeKey } from "@/data/nresPractices";
import { ENN_PRACTICES, ENN_ODS_CODES, type ENNPracticeKey } from "@/data/ennPractices";

// Build a combined list of all practices with ODS codes
const ALL_PRACTICES = [
  ...Object.entries(NRES_PRACTICES).map(([key, name]) => ({
    key,
    name: name as string,
    ods: NRES_ODS_CODES[key as NRESPracticeKey],
    group: "NRES" as const,
  })),
  ...Object.entries(ENN_PRACTICES).map(([key, name]) => ({
    key,
    name: name as string,
    ods: ENN_ODS_CODES[key as ENNPracticeKey],
    group: "ENN" as const,
  })),
];

export function SendDPIATemplateCard() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedPracticeKey, setSelectedPracticeKey] = useState("");
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedPractice = useMemo(
    () => ALL_PRACTICES.find((p) => p.key === selectedPracticeKey),
    [selectedPracticeKey]
  );

  const practiceName = selectedPractice
    ? `${selectedPractice.name} (${selectedPractice.ods})`
    : "";

  const handleSend = async () => {
    if (!recipientEmail || !recipientName) {
      toast.error("Please enter both name and email address");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-dpia-template", {
        body: {
          recipientEmail,
          recipientName,
          practiceName: selectedPractice?.name || "",
          practiceOds: selectedPractice?.ods || "",
        },
      });

      if (error) throw error;

      toast.success(`Template sent successfully to ${recipientEmail}`);
      setRecipientEmail("");
      setRecipientName("");
      setSelectedPracticeKey("");
    } catch (err: any) {
      console.error("Send error:", err);
      toast.error(err.message || "Failed to send template");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-[#005EB8]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5 text-[#005EB8]" />
          Send DPIA Data Collection Template
        </CardTitle>
        <CardDescription>
          Send the blank DPIA practice data collection template to a Practice Manager.
          They complete it and return to <strong>Malcolm.railson@nhs.net</strong> for account creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pm-name">Practice Manager Name</Label>
            <Input
              id="pm-name"
              placeholder="e.g. Jane Smith"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-email">Email Address</Label>
            <Input
              id="pm-email"
              type="email"
              placeholder="e.g. jane.smith@nhs.net"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Practice Name</Label>
            <Popover open={practiceOpen} onOpenChange={setPracticeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={practiceOpen}
                  className="w-full justify-between font-normal bg-white h-10 min-h-[44px] sm:min-h-[40px]"
                >
                  {selectedPractice
                    ? `${selectedPractice.name} (${selectedPractice.ods})`
                    : "Search practices…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or ODS code…" />
                  <CommandList>
                    <CommandEmpty>No practice found.</CommandEmpty>
                    <CommandGroup heading="NRES Practices">
                      {ALL_PRACTICES.filter((p) => p.group === "NRES").map((p) => (
                        <CommandItem
                          key={p.key}
                          value={`${p.name} ${p.ods}`}
                          onSelect={() => {
                            setSelectedPracticeKey(p.key === selectedPracticeKey ? "" : p.key);
                            setPracticeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPracticeKey === p.key ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{p.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{p.ods}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="ENN Practices">
                      {ALL_PRACTICES.filter((p) => p.group === "ENN").map((p) => (
                        <CommandItem
                          key={p.key}
                          value={`${p.name} ${p.ods}`}
                          onSelect={() => {
                            setSelectedPracticeKey(p.key === selectedPracticeKey ? "" : p.key);
                            setPracticeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPracticeKey === p.key ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{p.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{p.ods}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSend} disabled={sending || !recipientEmail || !recipientName}>
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Send Template</>
            )}
          </Button>

          <a
            href="/templates/Notewell_AI_DPIA_Practice_Data_Template_V1.1.docx"
            download
            className="inline-flex items-center gap-1.5 text-sm text-[#005EB8] hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download template
          </a>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              The PM will receive a branded email with the template attached, asking them to complete and return it to you.
              Once returned, use the <strong>Onboard Service</strong> DPIA generator to create their account.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
