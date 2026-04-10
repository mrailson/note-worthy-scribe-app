import { useState, useEffect, useMemo } from "react";
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

interface PracticeOption {
  id: string;
  name: string;
  practiceCode: string;
  orgType: string;
}

const ORG_TYPE_ORDER: Record<string, number> = {
  Practice: 1,
  PCN: 2,
  ICB: 3,
  Neighbourhood: 4,
  LMC: 5,
  Management: 6,
  "GP Practice": 7,
};

const ORG_TYPE_LABELS: Record<string, string> = {
  Practice: "GP Practices",
  "GP Practice": "GP Practices (Other)",
  PCN: "Primary Care Networks",
  ICB: "Integrated Care Board",
  Neighbourhood: "Neighbourhoods",
  LMC: "Local Medical Committee",
  Management: "Management",
};

export function SendDPIATemplateCard() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedPracticeId, setSelectedPracticeId] = useState("");
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [practices, setPractices] = useState<PracticeOption[]>([]);

  useEffect(() => {
    const fetchPractices = async () => {
      const { data } = await supabase
        .from("gp_practices")
        .select("id, name, practice_code, organisation_type")
        .order("name");
      if (data) {
        setPractices(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            practiceCode: p.practice_code || "",
            orgType: p.organisation_type || "Practice",
          }))
        );
      }
    };
    fetchPractices();
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, PracticeOption[]> = {};
    for (const p of practices) {
      const key = p.orgType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (ORG_TYPE_ORDER[a] || 99) - (ORG_TYPE_ORDER[b] || 99)
    );
  }, [practices]);

  const selectedPractice = practices.find((p) => p.id === selectedPracticeId);

  const handleSend = async () => {
    if (!recipientEmail || !recipientName) {
      toast.error("Please enter both name and email address");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-dpia-template", {
        body: {
          recipientEmail,
          recipientName,
          practiceName: selectedPractice?.name || "",
          practiceOds: selectedPractice?.practiceCode || "",
        },
      });

      if (error) throw error;

      toast.success(`Template sent successfully to ${recipientEmail}`);
      setRecipientEmail("");
      setRecipientName("");
      setSelectedPracticeId("");
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
            <Label>Practice / Organisation</Label>
            <Popover open={practiceOpen} onOpenChange={setPracticeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={practiceOpen}
                  className="w-full justify-between font-normal bg-white h-10 min-h-[44px] sm:min-h-[40px]"
                >
                  <span className="truncate">
                    {selectedPractice
                      ? `${selectedPractice.name} (${selectedPractice.practiceCode})`
                      : "Search practices…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or code…" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No organisation found.</CommandEmpty>
                    {grouped.map(([orgType, items]) => (
                      <CommandGroup key={orgType} heading={ORG_TYPE_LABELS[orgType] || orgType}>
                        {items.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.practiceCode}`}
                            onSelect={() => {
                              setSelectedPracticeId(p.id === selectedPracticeId ? "" : p.id);
                              setPracticeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedPracticeId === p.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{p.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground pl-2 shrink-0">
                              {p.practiceCode}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
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
