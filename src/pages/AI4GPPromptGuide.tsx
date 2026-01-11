import React, { useState, useMemo } from 'react';
import { SEO } from '@/components/SEO';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, Check, Search, FileText, Share2, Monitor, Image, Calendar, QrCode, Newspaper, Heart, BarChart3, ArrowLeft, Stethoscope, ClipboardList, GraduationCap, MessageCircle, Pill, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface PromptExample {
  id: number;
  useCase: string;
  prompt: string;
  category: string;
}

const promptExamples: PromptExample[] = [
  // Patient Leaflets & Information (1-8)
  { id: 1, category: 'Patient Leaflets', useCase: 'Diabetes management leaflet', prompt: 'Create a patient leaflet explaining Type 2 diabetes management including diet, exercise, and medication adherence' },
  { id: 2, category: 'Patient Leaflets', useCase: 'Post-operative care', prompt: 'Create an A4 patient information leaflet for post-minor surgery wound care' },
  { id: 3, category: 'Patient Leaflets', useCase: 'Medication side effects', prompt: 'Create a leaflet explaining common side effects of Metformin and when to seek help' },
  { id: 4, category: 'Patient Leaflets', useCase: 'Childhood vaccinations', prompt: 'Create a parent-friendly leaflet about the childhood vaccination schedule' },
  { id: 5, category: 'Patient Leaflets', useCase: 'Mental health support', prompt: 'Create a patient leaflet about anxiety management techniques and local support services' },
  { id: 6, category: 'Patient Leaflets', useCase: 'Asthma action plan', prompt: 'Create a visual asthma action plan leaflet with green/amber/red zones' },
  { id: 7, category: 'Patient Leaflets', useCase: 'Pregnancy advice', prompt: 'Create an early pregnancy advice leaflet covering first trimester care' },
  { id: 8, category: 'Patient Leaflets', useCase: 'Long-term condition management', prompt: 'Create a COPD patient information leaflet with breathing exercises' },

  // Social Media Posts (9-16)
  { id: 9, category: 'Social Media', useCase: 'Flu vaccine campaign', prompt: 'Create a social media image promoting flu vaccinations - book your appointment now' },
  { id: 10, category: 'Social Media', useCase: 'Extended hours promotion', prompt: 'Create a social media post announcing our new Saturday morning appointments' },
  { id: 11, category: 'Social Media', useCase: 'Mental health awareness', prompt: 'Create a social media graphic for Mental Health Awareness Week' },
  { id: 12, category: 'Social Media', useCase: 'New staff welcome', prompt: 'Create a social media welcome post for our new GP Dr Sarah Johnson' },
  { id: 13, category: 'Social Media', useCase: 'Online services promotion', prompt: 'Create a social media post encouraging patients to use the NHS App for repeat prescriptions' },
  { id: 14, category: 'Social Media', useCase: 'Seasonal health advice', prompt: 'Create a summer health tips social media post - heat, sun safety, hydration' },
  { id: 15, category: 'Social Media', useCase: 'Practice milestone', prompt: 'Create a celebratory social media post - our practice is 50 years old!' },
  { id: 16, category: 'Social Media', useCase: 'Community event', prompt: 'Create a social media post for our practice open day event on 15th March' },

  // Waiting Room Displays (17-22)
  { id: 17, category: 'Waiting Room', useCase: 'Did not attend reminder', prompt: 'Create a waiting room poster about DNA rates and how missed appointments affect others' },
  { id: 18, category: 'Waiting Room', useCase: 'Reception team respect', prompt: 'Create a waiting room poster asking patients to be respectful to reception staff' },
  { id: 19, category: 'Waiting Room', useCase: 'Prescription turnaround', prompt: 'Create a waiting room display explaining prescription turnaround times - 48 hours' },
  { id: 20, category: 'Waiting Room', useCase: 'Self-care guidance', prompt: 'Create a waiting room poster about self-care for minor illnesses - pharmacy first' },
  { id: 21, category: 'Waiting Room', useCase: 'Practice services', prompt: 'Create a waiting room display listing all services we offer including travel vaccines' },
  { id: 22, category: 'Waiting Room', useCase: 'PPG recruitment', prompt: 'Create a waiting room poster recruiting members for our Patient Participation Group' },

  // Posters & Notices (23-30)
  { id: 23, category: 'Posters & Notices', useCase: 'Staff room health', prompt: 'Create a staff wellbeing poster promoting the Employee Assistance Programme' },
  { id: 24, category: 'Posters & Notices', useCase: 'Infection control', prompt: 'Create a hand hygiene poster for clinical rooms' },
  { id: 25, category: 'Posters & Notices', useCase: 'Fire safety', prompt: 'Create a fire evacuation route poster for the waiting room' },
  { id: 26, category: 'Posters & Notices', useCase: 'Confidentiality reminder', prompt: 'Create a staff poster about patient confidentiality and GDPR' },
  { id: 27, category: 'Posters & Notices', useCase: 'Flu campaign for staff', prompt: 'Create a poster encouraging all staff to get their flu vaccination' },
  { id: 28, category: 'Posters & Notices', useCase: 'Training announcement', prompt: 'Create a poster announcing mandatory BLS training on 20th January' },
  { id: 29, category: 'Posters & Notices', useCase: 'CQC inspection prep', prompt: 'Create a poster reminding staff about our CQC inspection preparation checklist' },
  { id: 30, category: 'Posters & Notices', useCase: 'Zero tolerance', prompt: 'Create a zero tolerance poster about abuse towards NHS staff' },

  // Health Campaigns (31-36)
  { id: 31, category: 'Health Campaigns', useCase: 'Blood pressure awareness', prompt: 'Create a health campaign poster for Know Your Numbers blood pressure week' },
  { id: 32, category: 'Health Campaigns', useCase: 'Cervical screening', prompt: 'Create a cervical screening awareness campaign image - book your smear test' },
  { id: 33, category: 'Health Campaigns', useCase: 'Bowel cancer screening', prompt: 'Create a campaign poster encouraging patients to complete their FIT test' },
  { id: 34, category: 'Health Campaigns', useCase: 'NHS Health Checks', prompt: 'Create a campaign poster for our free NHS Health Checks for patients aged 40-74' },
  { id: 35, category: 'Health Campaigns', useCase: 'Smoking cessation', prompt: 'Create a Stoptober campaign poster with local quit smoking support details' },
  { id: 36, category: 'Health Campaigns', useCase: 'Alcohol awareness', prompt: 'Create a Dry January campaign poster with tips for reducing alcohol intake' },

  // Infographics & Data (37-41)
  { id: 37, category: 'Infographics', useCase: 'QOF performance', prompt: 'Create an infographic showing our QOF achievement rates for the past year' },
  { id: 38, category: 'Infographics', useCase: 'Patient survey results', prompt: 'Create an infographic summarising our Friends and Family Test results' },
  { id: 39, category: 'Infographics', useCase: 'Appointment statistics', prompt: 'Create an infographic showing our appointment availability and DNA rates' },
  { id: 40, category: 'Infographics', useCase: 'Practice demographics', prompt: 'Create an infographic showing our patient population demographics' },
  { id: 41, category: 'Infographics', useCase: 'Referral pathways', prompt: 'Create an infographic showing the 2-week wait cancer referral pathway' },

  // Calendars & Schedules (42-45)
  { id: 42, category: 'Calendars', useCase: 'Clinic schedule', prompt: 'Create a weekly clinic schedule showing all specialist clinics and times' },
  { id: 43, category: 'Calendars', useCase: 'Vaccination calendar', prompt: 'Create a childhood immunisation schedule calendar from birth to 18' },
  { id: 44, category: 'Calendars', useCase: 'Staff training calendar', prompt: 'Create a quarterly training calendar for mandatory training sessions' },
  { id: 45, category: 'Calendars', useCase: 'Bank holiday schedule', prompt: 'Create a calendar showing practice opening hours over Christmas and New Year' },

  // QR Codes (46-48)
  { id: 46, category: 'QR Codes', useCase: 'Website link', prompt: 'Create a QR code linking to our practice website' },
  { id: 47, category: 'QR Codes', useCase: 'Patient feedback', prompt: 'Create a QR code for our online feedback form' },
  { id: 48, category: 'QR Codes', useCase: 'NHS App registration', prompt: 'Create a QR code linking to the NHS App download page' },

  // Newsletters & Headers (49-50)
  { id: 49, category: 'Newsletters', useCase: 'Practice newsletter', prompt: 'Create a winter newsletter header with seasonal imagery' },
  { id: 50, category: 'Newsletters', useCase: 'Monthly update', prompt: 'Create a January 2026 practice update newsletter header' },
];

// GP & Clinician prompts (51-75)
const gpPromptExamples: PromptExample[] = [
  // Patient Education (51-55)
  { id: 51, category: 'Patient Education', useCase: 'Red flag symptoms', prompt: 'Create a visual patient handout explaining red flag symptoms for headaches and when to seek urgent help' },
  { id: 52, category: 'Patient Education', useCase: 'Treatment options diagram', prompt: 'Create a diagram comparing treatment options for knee osteoarthritis including lifestyle, medication, and surgical options' },
  { id: 53, category: 'Patient Education', useCase: 'Explaining test results', prompt: 'Create a visual aid explaining what HbA1c levels mean and target ranges for diabetic patients' },
  { id: 54, category: 'Patient Education', useCase: 'Medication mechanism', prompt: 'Create a simple diagram showing how ACE inhibitors work in controlling blood pressure' },
  { id: 55, category: 'Patient Education', useCase: 'Lifestyle modification', prompt: 'Create a patient handout with visual tips for reducing cardiovascular risk through diet and exercise' },

  // Clinical Protocols (56-59)
  { id: 56, category: 'Clinical Protocols', useCase: 'Chest pain algorithm', prompt: 'Create a clinical decision flowchart for assessing acute chest pain in primary care' },
  { id: 57, category: 'Clinical Protocols', useCase: 'Sepsis screening', prompt: 'Create a visual sepsis screening tool with NEWS2 scoring and escalation criteria' },
  { id: 58, category: 'Clinical Protocols', useCase: 'Antibiotic guidelines', prompt: 'Create a quick-reference antibiotic prescribing guide for common UTI presentations' },
  { id: 59, category: 'Clinical Protocols', useCase: 'Diabetes management pathway', prompt: 'Create a Type 2 diabetes treatment escalation pathway from diagnosis to insulin initiation' },

  // Teaching & Training (60-64)
  { id: 60, category: 'Teaching & Training', useCase: 'Dermatology teaching', prompt: 'Create a visual teaching slide comparing benign vs suspicious skin lesions using the ABCDE criteria' },
  { id: 61, category: 'Teaching & Training', useCase: 'ECG interpretation', prompt: 'Create an educational poster showing common ECG abnormalities with example tracings' },
  { id: 62, category: 'Teaching & Training', useCase: 'Consultation structure', prompt: 'Create a training infographic showing the Calgary-Cambridge consultation model' },
  { id: 63, category: 'Teaching & Training', useCase: 'Examination technique', prompt: 'Create a step-by-step visual guide for performing a cardiovascular examination' },
  { id: 64, category: 'Teaching & Training', useCase: 'Case-based learning', prompt: 'Create a case presentation template for significant event analysis discussions' },

  // Consultation Aids (65-69)
  { id: 65, category: 'Consultation Aids', useCase: 'Pain scale visual', prompt: 'Create a visual pain scale chart with faces and descriptions for use in consultations' },
  { id: 66, category: 'Consultation Aids', useCase: 'Body diagram', prompt: 'Create a blank body diagram for patients to mark areas of pain or symptoms' },
  { id: 67, category: 'Consultation Aids', useCase: 'Medication review checklist', prompt: 'Create a visual checklist for structured medication reviews in polypharmacy patients' },
  { id: 68, category: 'Consultation Aids', useCase: 'Capacity assessment', prompt: 'Create a visual guide for assessing mental capacity using the MCA framework' },
  { id: 69, category: 'Consultation Aids', useCase: 'Breaking bad news', prompt: 'Create a visual reference card for the SPIKES protocol for breaking bad news' },

  // Prescribing Information (70-72)
  { id: 70, category: 'Prescribing Information', useCase: 'Drug interaction warning', prompt: 'Create a visual quick-reference card showing common warfarin drug interactions' },
  { id: 71, category: 'Prescribing Information', useCase: 'Opioid conversion chart', prompt: 'Create an opioid equianalgesic conversion chart for palliative care prescribing' },
  { id: 72, category: 'Prescribing Information', useCase: 'Steroid equivalence', prompt: 'Create a corticosteroid equivalence chart with typical dosing for common conditions' },

  // Referral Support (73-75)
  { id: 73, category: 'Referral Support', useCase: '2-week wait criteria', prompt: 'Create a visual summary of 2-week wait cancer referral criteria for suspected lung cancer' },
  { id: 74, category: 'Referral Support', useCase: 'NICE referral thresholds', prompt: 'Create an infographic showing NICE NG12 suspected cancer referral pathways' },
  { id: 75, category: 'Referral Support', useCase: 'MSK pathway', prompt: 'Create a flowchart showing when to refer for physiotherapy, MSK, or orthopaedics' },
];

const categoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Patient Leaflets': {
    icon: <FileText className="h-5 w-5" />,
    description: 'A4 and A5 patient information materials for conditions, treatments, and self-care guidance',
    colour: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'Social Media': {
    icon: <Share2 className="h-5 w-5" />,
    description: 'Engaging graphics for Facebook, Instagram, Twitter and practice social channels',
    colour: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  },
  'Waiting Room': {
    icon: <Monitor className="h-5 w-5" />,
    description: 'Digital and print displays for patient waiting areas',
    colour: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  },
  'Posters & Notices': {
    icon: <Image className="h-5 w-5" />,
    description: 'Staff and patient-facing posters for various practice needs',
    colour: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'Health Campaigns': {
    icon: <Heart className="h-5 w-5" />,
    description: 'NHS awareness campaigns and screening promotion materials',
    colour: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  'Infographics': {
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'Data visualisation and statistics presentation',
    colour: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
  },
  'Calendars': {
    icon: <Calendar className="h-5 w-5" />,
    description: 'Schedules, timetables, and calendar-based materials',
    colour: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  },
  'QR Codes': {
    icon: <QrCode className="h-5 w-5" />,
    description: 'Quick-scan codes linking to digital resources',
    colour: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
  },
  'Newsletters': {
    icon: <Newspaper className="h-5 w-5" />,
    description: 'Newsletter headers, banners, and publication graphics',
    colour: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
  }
};

const gpCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Patient Education': {
    icon: <Stethoscope className="h-5 w-5" />,
    description: 'Visual aids and handouts for explaining conditions and treatments to patients',
    colour: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  },
  'Clinical Protocols': {
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'Reference guides for clinical pathways, algorithms, and protocols',
    colour: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  },
  'Teaching & Training': {
    icon: <GraduationCap className="h-5 w-5" />,
    description: 'Materials for medical students, trainees, and peer education',
    colour: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200'
  },
  'Consultation Aids': {
    icon: <MessageCircle className="h-5 w-5" />,
    description: 'Visual tools and reference cards for use during consultations',
    colour: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  },
  'Prescribing Information': {
    icon: <Pill className="h-5 w-5" />,
    description: 'Medication information, conversions, and prescribing guidance',
    colour: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
  },
  'Referral Support': {
    icon: <Send className="h-5 w-5" />,
    description: 'Materials to support referral decisions and pathway guidance',
    colour: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
  }
};

const categories = Object.keys(categoryConfig);
const gpCategories = Object.keys(gpCategoryConfig);
const allPrompts = [...promptExamples, ...gpPromptExamples];

const AI4GPPromptGuide = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredStaffPrompts = useMemo(() => {
    if (!searchTerm.trim()) return promptExamples;
    const term = searchTerm.toLowerCase();
    return promptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredGpPrompts = useMemo(() => {
    if (!searchTerm.trim()) return gpPromptExamples;
    const term = searchTerm.toLowerCase();
    return gpPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredAllPrompts = useMemo(() => {
    return [...filteredStaffPrompts, ...filteredGpPrompts];
  }, [filteredStaffPrompts, filteredGpPrompts]);

  const promptsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category] = filteredStaffPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredStaffPrompts]);

  const gpPromptsByCategory = useMemo(() => {
    return gpCategories.reduce((acc, category) => {
      acc[category] = filteredGpPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredGpPrompts]);

  const handleCopy = async (prompt: string, id: number) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(id);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy prompt');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="AI4GP Prompt Guide | 75 Example Prompts for GP Practices | NoteWell AI"
        description="Comprehensive guide with 75 example prompts for practice staff and clinicians - patient leaflets, social media, clinical protocols, consultation aids, and more using AI4GP."
        canonical="https://www.gpnotewell.co.uk/ai4gp-prompts"
        keywords="AI4GP prompts, GP practice prompts, patient leaflet examples, NHS social media, clinical protocols, consultation aids, prescribing guidance"
      />
      
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/ai4gp" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to AI4GP</span>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI4GP Prompt Guide</h1>
              <p className="text-muted-foreground mt-1">75 example prompts for GP practice staff and clinicians</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Introduction */}
        <section aria-labelledby="intro-heading" className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle id="intro-heading">How to Use This Guide</CardTitle>
            <CardDescription>
                This page contains 75 example prompts organised by category - 50 for practice staff and 25 for GPs and clinicians. Use these as starting points for creating your own materials, or copy them directly into AI4GP.
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Click any prompt to copy it to your clipboard</li>
                <li>Customise prompts with your practice name and specific details</li>
                <li>Use the search box to find prompts by keyword</li>
                <li>Expand categories to view all related prompts</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Search */}
        <section aria-label="Search prompts" className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search prompts by keyword, category, or use case..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Search prompts"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {filteredAllPrompts.length} prompt{filteredAllPrompts.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </p>
          )}
        </section>

        {/* Staff Categories */}
        <section aria-labelledby="staff-categories-heading" className="mb-12">
          <h2 id="staff-categories-heading" className="text-xl font-semibold text-foreground mb-4">Practice Staff Prompts</h2>
          <p className="text-muted-foreground mb-6">50 prompts for reception, admin, and practice management teams</p>
          
          <Accordion type="multiple" defaultValue={categories} className="space-y-4">
            {categories.map((category) => {
              const config = categoryConfig[category];
              const categoryPrompts = promptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{category}</h3>
                        <p className="text-sm text-muted-foreground font-normal">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-4">
                        {categoryPrompts.length} prompt{categoryPrompts.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" role="table">
                        <caption className="sr-only">{category} prompts</caption>
                        <thead>
                          <tr className="border-b">
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground w-8">#</th>
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground w-48">Use Case</th>
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground">Example Prompt</th>
                            <th scope="col" className="text-right py-2 font-medium text-muted-foreground w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryPrompts.map((example) => (
                            <tr 
                              key={example.id} 
                              className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 pr-4 text-muted-foreground">{example.id}</td>
                              <td className="py-3 pr-4 font-medium text-foreground">{example.useCase}</td>
                              <td className="py-3 pr-4 text-foreground">{example.prompt}</td>
                              <td className="py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(example.prompt, example.id)}
                                  aria-label={`Copy prompt: ${example.useCase}`}
                                  className="h-8 w-8 p-0"
                                >
                                  {copiedId === example.id ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>

        {/* GP & Clinician Categories */}
        <section aria-labelledby="gp-categories-heading" className="mb-12">
          <h2 id="gp-categories-heading" className="text-xl font-semibold text-foreground mb-4">GP & Clinician Use Cases</h2>
          <p className="text-muted-foreground mb-6">25 prompts for clinical, educational, and professional development materials</p>
          
          <Accordion type="multiple" defaultValue={gpCategories} className="space-y-4">
            {gpCategories.map((category) => {
              const config = gpCategoryConfig[category];
              const categoryPrompts = gpPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{category}</h3>
                        <p className="text-sm text-muted-foreground font-normal">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-4">
                        {categoryPrompts.length} prompt{categoryPrompts.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" role="table">
                        <caption className="sr-only">{category} prompts</caption>
                        <thead>
                          <tr className="border-b">
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground w-8">#</th>
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground w-48">Use Case</th>
                            <th scope="col" className="text-left py-2 pr-4 font-medium text-muted-foreground">Example Prompt</th>
                            <th scope="col" className="text-right py-2 font-medium text-muted-foreground w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryPrompts.map((example) => (
                            <tr 
                              key={example.id} 
                              className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 pr-4 text-muted-foreground">{example.id}</td>
                              <td className="py-3 pr-4 font-medium text-foreground">{example.useCase}</td>
                              <td className="py-3 pr-4 text-foreground">{example.prompt}</td>
                              <td className="py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(example.prompt, example.id)}
                                  aria-label={`Copy prompt: ${example.useCase}`}
                                  className="h-8 w-8 p-0"
                                >
                                  {copiedId === example.id ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>

        {/* Quick Reference Table - for LLM consumption */}
        <section aria-labelledby="full-list-heading" className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle id="full-list-heading">Complete Prompt Reference</CardTitle>
              <CardDescription>
                All 75 prompts in a single searchable table for quick reference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <caption className="sr-only">Complete list of all AI4GP example prompts</caption>
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th scope="col" className="text-left py-3 px-3 font-semibold text-foreground">#</th>
                      <th scope="col" className="text-left py-3 px-3 font-semibold text-foreground">Category</th>
                      <th scope="col" className="text-left py-3 px-3 font-semibold text-foreground">Use Case</th>
                      <th scope="col" className="text-left py-3 px-3 font-semibold text-foreground">Example Prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPrompts.map((example) => (
                      <tr 
                        key={example.id} 
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2 px-3 text-muted-foreground">{example.id}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {example.category}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">{example.useCase}</td>
                        <td className="py-2 px-3 text-foreground">{example.prompt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tips Section */}
        <section aria-labelledby="tips-heading" className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle id="tips-heading">Tips for Better Results</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Be specific</strong> - Include exact details like dates, times, and contact information</li>
                <li><strong className="text-foreground">Mention your practice</strong> - Add your practice name for branded materials</li>
                <li><strong className="text-foreground">Specify the format</strong> - Mention A4, A5, landscape, or portrait as needed</li>
                <li><strong className="text-foreground">Include accessibility needs</strong> - Request large text or high contrast if required</li>
                <li><strong className="text-foreground">Add branding</strong> - Include your practice logo and colours for consistency</li>
                <li><strong className="text-foreground">Request NHS branding</strong> - Mention NHS colours or branding where appropriate</li>
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground border-t pt-8">
          <p>This guide is part of <strong>AI4GP by NoteWell AI</strong></p>
          <p className="mt-1">For more information, visit <a href="https://www.gpnotewell.co.uk" className="text-primary hover:underline">gpnotewell.co.uk</a></p>
        </footer>
      </main>
    </div>
  );
};

export default AI4GPPromptGuide;
