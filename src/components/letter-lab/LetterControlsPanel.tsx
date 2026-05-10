import React, { useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { showShadcnToast } from '@/utils/toastWrapper';

export type Tone = 'formal' | 'empathetic' | 'firm';
export type Length = 'concise' | 'standard' | 'detailed';
export type LetterTypeKind = 'acknowledgement' | 'outcome';

export interface SignatoryOption {
  id: string;
  name: string;
  job_title: string | null;
  signature_image_url: string | null;
}

export interface ControlsValue {
  tone: Tone;
  length: Length;
  signatoryIds: string[];
  letterDate: Date;
  responseDueDate: Date | null;
  agreedTimeframe: string | null;
  referenceNumber: string;
}

interface Props {
  letterType: LetterTypeKind;
  value: ControlsValue;
  onChange: (patch: Partial<ControlsValue>) => void;
  signatories: SignatoryOption[];
  signatoriesLoading: boolean;
  settingsChanged: boolean;
  onRegenerate: () => void;
  onInsertSnippet: (text: string) => void;
}

const TONE_OPTIONS: { value: Tone; label: string; help: string }[] = [
  { value: 'formal', label: 'Formal', help: 'Professional, neutral, NHS standard' },
  { value: 'empathetic', label: 'Empathetic', help: 'Warmer, acknowledging distress, patient-first' },
  { value: 'firm', label: 'Firm', help: 'Clear and direct, used where boundaries need stating' },
];

const LENGTH_OPTIONS: { value: Length; label: string; help: string }[] = [
  { value: 'concise', label: 'Concise', help: '~150 words, the essentials' },
  { value: 'standard', label: 'Standard', help: '~300 words, balanced detail' },
  { value: 'detailed', label: 'Detailed', help: '~500 words, thorough explanation' },
];

const SNIPPETS: {
  category: string;
  required?: boolean;
  items: { label: string; text: string; required?: boolean }[];
}[] = [
  {
    category: 'Apologies',
    items: [
      {
        label: 'Sincere apology for distress',
        text: 'I am very sorry for the distress that this experience has caused you and your family. Please accept our sincere apologies.',
      },
      {
        label: 'Apology for delay in care',
        text: 'I would like to apologise for the delay in your care. We understand the impact this will have had and are sorry that we did not meet the standards you should expect from us.',
      },
      {
        label: 'Apology for communication breakdown',
        text: 'I am sorry that our communication with you fell short of the standard we aim for. We recognise how unsettling this must have been.',
      },
    ],
  },
  {
    category: 'Acknowledgement phrases',
    items: [
      {
        label: 'Thank you for raising this',
        text: 'Thank you for taking the time to raise these concerns with us. Feedback of this kind is essential to helping us improve the service we provide.',
      },
      {
        label: 'We take all complaints seriously',
        text: 'Please be assured that we take all complaints seriously and will investigate the matters you have raised in line with the NHS Complaints Procedure.',
      },
      {
        label: 'Confirming receipt and next steps',
        text: 'I am writing to confirm receipt of your complaint dated [DATE]. We will now begin our investigation and will write to you again with our full response within the agreed timeframe.',
      },
    ],
  },
  {
    category: 'Investigation language',
    items: [
      {
        label: 'We have investigated the matters raised',
        text: 'We have carefully investigated the matters you raised, including reviewing your clinical record and speaking with the staff involved.',
      },
      {
        label: 'Our findings are as follows',
        text: 'Our findings are set out below, addressing each of the points you raised in turn.',
      },
      {
        label: 'We were unable to substantiate',
        text: 'On the basis of the evidence reviewed, we were unable to substantiate this element of your complaint. I have set out the reasoning in detail below.',
      },
    ],
  },
  {
    category: 'Learning & action',
    items: [
      {
        label: 'Action we are taking as a result',
        text: 'As a direct result of your complaint, we are taking the following action to prevent a recurrence:',
      },
      {
        label: 'Changes to our processes',
        text: 'We have reviewed the processes involved and are making the following changes to improve patient experience and safety:',
      },
      {
        label: 'Learning shared with the team',
        text: 'The learning from your complaint has been shared with the wider team through our governance meeting and recorded on our practice learning log.',
      },
    ],
  },
  {
    category: 'Escalation rights (required)',
    items: [
      {
        label: 'Right to refer to PHSO',
        required: true,
        text:
          'If you remain dissatisfied with our response, you have the right to ask the Parliamentary and Health Service Ombudsman (PHSO) to review your complaint. The PHSO is independent of the NHS and the Government. You should contact the Ombudsman within 12 months of the events you are complaining about.\n\nParliamentary and Health Service Ombudsman\nMillbank Tower, Millbank, London SW1P 4QP\nTelephone: 0345 015 4033\nWebsite: www.ombudsman.org.uk',
      },
      {
        label: 'Right to advocacy',
        required: true,
        text:
          'You also have the right to access free, independent NHS Complaints Advocacy support. Your local advocacy provider can help you put your concerns into writing and represent your views. We can provide details of the local advocacy service on request.',
      },
    ],
  },
  {
    category: 'Closing',
    items: [
      {
        label: 'Standard formal sign-off',
        text: 'Yours sincerely,',
      },
      {
        label: 'Empathetic sign-off',
        text: 'Once again, please accept our sincere apologies for the distress this has caused. We remain committed to learning from your experience.\n\nYours sincerely,',
      },
      {
        label: 'Open-door sign-off',
        text: 'If you would like to discuss any part of this letter, please do contact me directly using the details at the top of this letter.\n\nYours sincerely,',
      },
    ],
  },
];

function addWorkingDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

export const LetterControlsPanel: React.FC<Props> = ({
  letterType,
  value,
  onChange,
  signatories,
  signatoriesLoading,
  settingsChanged,
  onRegenerate,
  onInsertSnippet,
}) => {
  const [snippetsOpen, setSnippetsOpen] = useState(true);

  const computedDue = useMemo(() => {
    if (letterType === 'acknowledgement') {
      return addWorkingDays(value.letterDate, 3);
    }
    const d = new Date(value.letterDate);
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [letterType, value.letterDate]);

  React.useEffect(() => {
    onChange({ responseDueDate: computedDue });
  }, [computedDue.getTime()]);

  const toggleSignatory = (id: string) => {
    const has = value.signatoryIds.includes(id);
    let next: string[];
    if (has) {
      next = value.signatoryIds.filter((s) => s !== id);
    } else {
      if (value.signatoryIds.length >= 3) {
        showShadcnToast({
          title: 'Maximum 3 signatories',
          description: 'Remove one before adding another.',
          variant: 'destructive',
        });
        return;
      }
      next = [...value.signatoryIds, id];
    }
    onChange({ signatoryIds: next });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 text-sm">
        {settingsChanged && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            <span>Settings changed — current draft no longer matches the controls.</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRegenerate}>
              <Sparkles className="h-3 w-3 mr-1" /> Regenerate letter
            </Button>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tone</Label>
            {settingsChanged && (
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onRegenerate}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerate with new tone
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ tone: opt.value })}
                className={cn(
                  'text-left rounded-md border-2 p-2 transition',
                  value.tone === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted',
                )}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.help}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
            Length
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ length: opt.value })}
                className={cn(
                  'text-left rounded-md border-2 p-2 transition',
                  value.length === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted',
                )}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.help}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Signatories
            </Label>
            <span className="text-[10px] text-muted-foreground">
              {value.signatoryIds.length}/3
            </span>
          </div>
          {signatoriesLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : signatories.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">
              No signatures configured for this practice.
            </div>
          ) : (
            <div className="space-y-1 max-h-56 overflow-auto pr-1">
              {signatories.map((s) => {
                const selected = value.signatoryIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSignatory(s.id)}
                    className={cn(
                      'w-full text-left rounded-md border px-2 py-1.5 text-xs transition flex items-center justify-between gap-2',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <span>
                      <span className="font-medium">{s.name}</span>
                      {s.job_title && (
                        <span className="text-muted-foreground"> — {s.job_title}</span>
                      )}
                    </span>
                    {selected && <Badge variant="secondary" className="text-[10px]">Selected</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Deadlines
          </Label>

          <div>
            <Label className="text-xs">Letter date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left h-8 mt-1">
                  <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                  {format(value.letterDate, 'd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.letterDate}
                  onSelect={(d) => d && onChange({ letterDate: d })}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="rounded-md border bg-muted/40 p-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                Response due by
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {letterType === 'acknowledgement'
                      ? 'NHS Complaints Regulations 2009: complaints must be acknowledged within 3 working days. Excludes weekends; check bank holidays manually.'
                      : 'NHS Complaints Regulations 2009: outcome response is expected within 6 months as the regulatory maximum. An earlier agreed timeframe should be used where possible.'}
                  </TooltipContent>
                </Tooltip>
              </Label>
              <span className="text-xs font-medium">{format(computedDue, 'd MMM yyyy')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {letterType === 'acknowledgement'
                ? 'Excludes weekends; check bank holidays manually.'
                : 'Regulatory maximum — set an earlier agreed timeframe below if appropriate.'}
            </p>
          </div>

          {letterType === 'outcome' && (
            <div>
              <Label className="text-xs">Agreed timeframe (override)</Label>
              <Input
                value={value.agreedTimeframe ?? ''}
                onChange={(e) => onChange({ agreedTimeframe: e.target.value })}
                placeholder="e.g. 28 working days"
                className="h-8 mt-1 text-xs"
              />
            </div>
          )}
        </section>

        <section>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">
            Reference number
          </Label>
          <Input
            value={value.referenceNumber}
            onChange={(e) => onChange({ referenceNumber: e.target.value })}
            placeholder="BMC-CMP-2026-A3F2"
            className="h-8 text-xs font-mono"
          />
        </section>

        <section>
          <Collapsible open={snippetsOpen} onOpenChange={setSnippetsOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground py-1">
                <span>Template snippets</span>
                {snippetsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {SNIPPETS.map((group) => (
                <div key={group.category}>
                  <div className="text-[11px] font-semibold text-foreground mb-1">
                    {group.category}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => onInsertSnippet(item.text)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted transition"
                        title={item.text}
                      >
                        {item.label}
                        {item.required && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">
                            Required
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>
    </TooltipProvider>
  );
};

export default LetterControlsPanel;
