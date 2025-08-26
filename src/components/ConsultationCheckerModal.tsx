import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Stethoscope, ChevronDown, ChevronRight } from 'lucide-react';

interface ConsultationCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
}

const consultationTypes = {
  'diabetes-review': {
    name: 'Diabetes Annual Review',
    notes: `Patient: John Smith, 58M, Type 2 Diabetes
Presenting: Annual diabetes check-up

History:
- Diagnosed T2DM 2019, on metformin 500mg BD + gliclazide 80mg OD
- Generally good adherence to medication
- Occasional missed doses when travelling
- Reports some tingling in feet, worse evenings
- No visual symptoms, chest pain, or breathlessness
- Diet fairly good, occasional treats
- Walks dog daily 30 mins

Examination:
- BMI 31.2 (was 32.1 last year)
- BP 142/88 mmHg
- Feet: some loss of sensation to 10g monofilament both feet
- Pulses present bilaterally
- No ulcers or deformity
- Fundoscopy: mild background retinopathy

Results today:
- HbA1c 58 mmol/mol (was 62 last year)
- eGFR 78 (baseline ~80)
- ACR 2.8 mg/mmol
- Total cholesterol 4.2 mmol/L

Plan:
- Continue current medication
- Refer to podiatry for neuropathy assessment
- Annual eye screening due
- Discussed foot care
- See in 6 months`
  },
  'chest-pain': {
    name: 'Acute Chest Pain',
    notes: `Patient: Sarah Williams, 45F
Presenting: Central chest pain, started 2 hours ago

History:
- Sharp central chest pain, 7/10 severity
- Started suddenly while at rest watching TV
- No radiation to arms/jaw/back
- No associated SOB, nausea, sweating
- No palpitations
- Pain worse on deep inspiration and movement
- Recent URTI last week, still coughing
- No previous cardiac history
- Non-smoker, occasional alcohol
- Family history: father MI age 65

Examination:
- Appears comfortable at rest
- Obs: HR 88 reg, BP 128/76, Sats 98% RA, Temp 36.8°C
- Chest: clear air entry bilaterally, no wheeze
- Heart sounds: dual, no murmurs
- No peripheral oedema
- Chest wall tender over left parasternal area

Assessment:
- Most likely musculoskeletal/pleuritic pain
- Low cardiac risk given age, presentation, examination
- Recent viral illness may have caused costochondritis

Plan:
- Safety net advice re: cardiac symptoms
- Ibuprofen 400mg TDS for inflammation
- Return if worsening or new symptoms
- Routine f/u if not settling in 1 week`
  },
  'mental-health': {
    name: 'Mental Health Assessment',
    notes: `Patient: Michael Thompson, 34M
Presenting: Low mood and anxiety for 6 weeks

History:
- Gradual onset low mood following redundancy 8 weeks ago
- Describes feeling "flat", loss of enjoyment in activities
- Sleep pattern disrupted - early morning waking 5am
- Appetite reduced, lost about 3kg
- Concentration poor, affecting job search
- Anxiety about finances, future employment
- Denies suicidal ideation but says "what's the point sometimes"
- No previous mental health history
- No substance misuse
- Lives with partner, supportive relationship
- Usually active and sociable

Mental State Examination:
- Appearance: casually dressed, good hygiene
- Behaviour: cooperative, some psychomotor retardation
- Speech: reduced rate and volume
- Mood: "pretty low" subjectively, appears depressed
- Thought: no formal thought disorder, preoccupied with work situation
- Perception: no abnormal perceptions
- Cognition: concentration impaired, otherwise intact
- Insight: good understanding of current difficulties

PHQ-9 score: 16 (moderate-severe depression)
GAD-7 score: 12 (moderate anxiety)

Plan:
- Explain diagnosis of moderate depression with anxiety
- Discussed treatment options: therapy vs medication
- Patient prefers to try talking therapy initially
- Refer to IAPT service
- Self-help resources and exercise advice
- Safety net and follow-up in 2 weeks
- Consider antidepressant if no improvement`
  },
  'pediatric-fever': {
    name: 'Pediatric Fever Assessment',
    notes: `Patient: Emma Jones, 18 months old
Presenting: Fever and irritability for 2 days, brought by mother

History:
- Temperature up to 39.2°C at home
- Started 2 days ago, intermittent fever
- More clingy and irritable than usual
- Eating less but still taking fluids
- No cough, runny nose initially but now has clear nasal discharge
- No rash noticed
- No vomiting or diarrhoea
- Urine normal colour and frequency
- Attends nursery 3 days/week
- Immunisations up to date
- Generally healthy child
- No recent travel or sick contacts initially but now mum mentions nursery had "bugs going around"

Examination:
- Alert but a bit grizzly, consolable by mum
- Temperature 38.4°C, HR 110, RR 28
- Weight 11.2kg (50th centile)
- HEENT: red throat, no exudate, no lymphadenopathy
- Ears: right TM slightly red and bulging
- Chest: clear air entry, no wheeze or creps  
- Heart: dual sounds, no murmurs
- Abdomen: soft, no masses or tenderness
- No rash or focal signs
- Capillary refill <2 seconds
- Good eye contact and interaction

Assessment:
- Likely viral URTI with possible early otitis media
- Well child with fever, no red flag symptoms
- Traffic light system: GREEN

Plan:
- Reassurance about viral illness
- Paracetamol/ibuprofen for fever and comfort
- Plenty of fluids
- Return if any red flag symptoms develop
- Should improve over 3-5 days
- No antibiotics indicated at present`
  },
  'contraception': {
    name: 'Contraception Consultation',
    notes: `Patient: Lisa Brown, 26F
Presenting: Requesting contraception advice, wants to switch from condoms

History:
- Currently using condoms with long-term partner (3 years)
- Wants more reliable contraception
- Had issues with combined pill previously (nausea, mood changes)
- Interested in LARC options
- No current plans for pregnancy, maybe in 2-3 years
- Regular periods, 28-day cycle, moderate flow
- No intermenstrual bleeding or PCB
- Last smear 2 years ago - normal
- No STI history, monogamous relationship

Past Medical History:
- No significant medical history
- No family history of thrombosis or breast/ovarian cancer
- Takes no regular medications
- NKDA

Examination:
- BMI 24, BP 118/72
- General examination normal

Discussion:
- Explained contraceptive options available
- Discussed COCP, POP, injection, implant, IUD/IUS
- Patient particularly interested in IUS (Mirena)
- Explained benefits: highly effective, 5-year duration, may reduce periods
- Discussed risks: irregular bleeding initially, small perforation risk
- Also discussed implant as alternative
- Patient wants time to consider options

Plan:
- Information leaflets provided for IUS and implant  
- Book appointment in 2 weeks to discuss decision
- If chooses IUS, arrange insertion appointment
- Continue condoms meanwhile
- Routine contraception follow-up as needed`
  }
};

export const ConsultationCheckerModal: React.FC<ConsultationCheckerModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [customNotes, setCustomNotes] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const handleSubmit = () => {
    let consultationText = '';
    
    if (useCustom && customNotes.trim()) {
      consultationText = customNotes.trim();
    } else if (selectedType && consultationTypes[selectedType as keyof typeof consultationTypes]) {
      consultationText = consultationTypes[selectedType as keyof typeof consultationTypes].notes;
    }

    if (consultationText) {
      const prompt = `Please analyze this GP consultation transcript and provide:

• **Clean SOAP Notes** + timeline
• **Documentation Quality Check** with recommendations  
• **Follow-up Actions & Tests** needed
• **Patient Letter** (plain English summary)
• **Patient SMS** (key points reminder)
• **EHR-Ready Paste Blocks** (structured for clinical systems)
• **Clinical Scores** (where applicable - e.g., PHQ-9, QRISK, etc.)
• **Safety Netting** advice and red flags

**Consultation Transcript:**

${consultationText}`;

      onSubmit(prompt);
      onClose();
      
      // Reset form
      setSelectedType('');
      setCustomNotes('');
      setUseCustom(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form when closing
    setSelectedType('');
    setCustomNotes('');
    setUseCustom(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            GP Consultation Scribe & Checker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            This tool analyzes consultation notes and provides structured documentation, quality checks, patient communications, and clinical scores.
          </div>

          {/* Option 1: Paste Your Own Notes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="custom"
                name="consultation-type"
                checked={useCustom}
                onChange={() => setUseCustom(true)}
                className="w-4 h-4 text-primary"
              />
              <Label htmlFor="custom" className="font-medium">Paste Your Own Consultation Notes</Label>
            </div>
            
            {useCustom && (
              <Textarea
                placeholder="Paste your consultation transcript here..."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* Option 2: Use Demo Consultation */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="demo"
                name="consultation-type"
                checked={!useCustom}
                onChange={() => setUseCustom(false)}
                className="w-4 h-4 text-primary"
              />
              <Label htmlFor="demo" className="font-medium">Try a Demo Consultation</Label>
            </div>
            
            {!useCustom && (
              <div className="space-y-3">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a consultation type to demo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(consultationTypes).map(([key, type]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedType && (
                  <Collapsible open={previewExpanded} onOpenChange={setPreviewExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {previewExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        {previewExpanded ? 'Hide' : 'Show'} consultation preview
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-muted/30 p-4 rounded-lg border mt-2">
                        <div className="font-medium text-sm mb-2">Preview:</div>
                        <div className="text-xs font-mono text-muted-foreground max-h-32 overflow-y-auto">
                          {consultationTypes[selectedType as keyof typeof consultationTypes].notes.substring(0, 300)}...
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!((useCustom && customNotes.trim()) || (!useCustom && selectedType))}
              className="bg-primary hover:bg-primary-hover"
            >
              Analyze Consultation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};