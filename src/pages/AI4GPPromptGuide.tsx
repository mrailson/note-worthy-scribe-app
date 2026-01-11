import React, { useState, useMemo } from 'react';
import { SEO } from '@/components/SEO';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, Check, Search, FileText, Share2, Monitor, Image, Calendar, QrCode, Newspaper, Heart, BarChart3, ArrowLeft, Stethoscope, ClipboardList, GraduationCap, MessageCircle, Pill, Send, Users, MapPin, Compass, HandHeart, Activity, Sparkles, Syringe, ShieldCheck, Thermometer, HeartPulse, BookOpen, Bandage, FlaskConical, AlertTriangle, Scale, Repeat, ClipboardCheck, Building2, Briefcase, FileCheck, Landmark, ClipboardPen, Droplet, Gauge, Scissors, UserCheck } from 'lucide-react';
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

// Social Prescribing Link Worker prompts (76-100)
const splwPromptExamples: PromptExample[] = [
  // Community Resources (76-80)
  { id: 76, category: 'Community Resources', useCase: 'Local services directory', prompt: 'Create a visual directory of local community services including food banks, befriending services, and debt advice' },
  { id: 77, category: 'Community Resources', useCase: 'Walking groups map', prompt: 'Create a leaflet showing local walking groups with meeting times, locations, and contact details' },
  { id: 78, category: 'Community Resources', useCase: 'Community centre guide', prompt: 'Create a guide to our local community centres with activities, opening hours, and accessibility information' },
  { id: 79, category: 'Community Resources', useCase: 'Volunteer opportunities', prompt: 'Create a poster promoting local volunteering opportunities and how to get involved' },
  { id: 80, category: 'Community Resources', useCase: 'Support groups directory', prompt: 'Create a patient handout listing local support groups for bereavement, carers, and long-term conditions' },

  // Wellbeing Support (81-85)
  { id: 81, category: 'Wellbeing Support', useCase: 'Five ways to wellbeing', prompt: 'Create a visual poster explaining the Five Ways to Wellbeing - Connect, Be Active, Take Notice, Keep Learning, Give' },
  { id: 82, category: 'Wellbeing Support', useCase: 'Loneliness support', prompt: 'Create a patient leaflet about combating loneliness with local befriending and social activities' },
  { id: 83, category: 'Wellbeing Support', useCase: 'Sleep hygiene tips', prompt: 'Create a patient handout with practical tips for improving sleep quality' },
  { id: 84, category: 'Wellbeing Support', useCase: 'Stress management', prompt: 'Create a visual guide to stress management techniques including breathing exercises and mindfulness' },
  { id: 85, category: 'Wellbeing Support', useCase: 'Self-care wheel', prompt: 'Create a self-care wheel diagram showing different areas of wellbeing patients can focus on' },

  // Group Activities (86-90)
  { id: 86, category: 'Group Activities', useCase: 'Art therapy sessions', prompt: 'Create a poster promoting our weekly art therapy sessions - no experience needed' },
  { id: 87, category: 'Group Activities', useCase: 'Gardening group', prompt: 'Create a leaflet promoting our community gardening project with benefits and how to join' },
  { id: 88, category: 'Group Activities', useCase: 'Coffee morning', prompt: 'Create a social media post for our monthly coffee morning - reducing isolation through connection' },
  { id: 89, category: 'Group Activities', useCase: 'Exercise classes', prompt: 'Create a poster showing our weekly exercise class schedule including chair-based exercise and gentle yoga' },
  { id: 90, category: 'Group Activities', useCase: 'Cooking on a budget', prompt: 'Create a leaflet for our healthy eating on a budget workshops with dates and registration details' },

  // Patient Engagement (91-94)
  { id: 91, category: 'Patient Engagement', useCase: 'What is social prescribing', prompt: 'Create a patient leaflet explaining what social prescribing is and how it can help' },
  { id: 92, category: 'Patient Engagement', useCase: 'First appointment guide', prompt: 'Create a handout explaining what to expect at your first social prescribing appointment' },
  { id: 93, category: 'Patient Engagement', useCase: 'Goal setting worksheet', prompt: 'Create a visual goal-setting worksheet for patients to identify what matters most to them' },
  { id: 94, category: 'Patient Engagement', useCase: 'Progress tracker', prompt: 'Create a simple wellbeing progress tracker patients can use between appointments' },

  // Signposting Materials (95-97)
  { id: 95, category: 'Signposting Materials', useCase: 'Benefits advice', prompt: 'Create a leaflet about accessing free benefits advice and support with PIP, UC, and attendance allowance' },
  { id: 96, category: 'Signposting Materials', useCase: 'Housing support', prompt: 'Create a signposting handout for housing support services including repairs, adaptations, and tenancy advice' },
  { id: 97, category: 'Signposting Materials', useCase: 'Carer support', prompt: 'Create a leaflet for unpaid carers explaining available support, respite services, and carers assessments' },

  // Impact & Outcomes (98-100)
  { id: 98, category: 'Impact & Outcomes', useCase: 'Service impact report', prompt: 'Create an infographic showing social prescribing outcomes - number of patients helped, activities accessed, wellbeing improvements' },
  { id: 99, category: 'Impact & Outcomes', useCase: 'Patient testimonials', prompt: 'Create a poster featuring anonymous patient testimonials about how social prescribing has helped them' },
  { id: 100, category: 'Impact & Outcomes', useCase: 'PCN presentation', prompt: 'Create presentation slides for PCN meetings showing social prescribing activity and impact data' },
];

// Clinical Pharmacist prompts (101-120)
const pharmacistPromptExamples: PromptExample[] = [
  // Medication Reviews (101-104)
  { id: 101, category: 'Medication Reviews', useCase: 'Structured medication review', prompt: 'Create a visual checklist for conducting a structured medication review in elderly polypharmacy patients' },
  { id: 102, category: 'Medication Reviews', useCase: 'Deprescribing guide', prompt: 'Create a patient-friendly leaflet explaining deprescribing and why reducing medications can improve health' },
  { id: 103, category: 'Medication Reviews', useCase: 'High-risk medication review', prompt: 'Create a quick-reference card for reviewing DOACs, anticonvulsants, and other high-risk medications' },
  { id: 104, category: 'Medication Reviews', useCase: 'Anticholinergic burden', prompt: 'Create an infographic showing anticholinergic burden scoring with common culprit medications' },

  // Medicines Optimisation (105-108)
  { id: 105, category: 'Medicines Optimisation', useCase: 'Inhaler technique', prompt: 'Create step-by-step visual guides comparing MDI, DPI, and soft mist inhaler techniques' },
  { id: 106, category: 'Medicines Optimisation', useCase: 'Statin optimisation', prompt: 'Create a patient handout explaining statin therapy, benefits, and managing common side effects' },
  { id: 107, category: 'Medicines Optimisation', useCase: 'Diabetes medication guide', prompt: 'Create a comparison chart of oral diabetes medications with key counselling points for each' },
  { id: 108, category: 'Medicines Optimisation', useCase: 'Pain management pathway', prompt: 'Create a visual pain management stepladder with non-pharmacological and pharmacological options' },

  // Medicines Safety (109-112)
  { id: 109, category: 'Medicines Safety', useCase: 'Drug interaction alerts', prompt: 'Create a quick-reference poster showing clinically significant drug interactions in primary care' },
  { id: 110, category: 'Medicines Safety', useCase: 'STOPP/START criteria', prompt: 'Create an infographic summarising key STOPP/START criteria for inappropriate prescribing in older adults' },
  { id: 111, category: 'Medicines Safety', useCase: 'Monitoring requirements', prompt: 'Create a monitoring schedule chart for shared care medications including bloods and frequency' },
  { id: 112, category: 'Medicines Safety', useCase: 'AKI sick day rules', prompt: 'Create a patient sick day rules card for medications to temporarily stop during acute illness' },

  // Patient Education (113-116)
  { id: 113, category: 'Pharmacist Patient Education', useCase: 'New medication counselling', prompt: 'Create a patient information template for starting a new long-term medication' },
  { id: 114, category: 'Pharmacist Patient Education', useCase: 'Warfarin patient guide', prompt: 'Create a comprehensive warfarin patient guide covering INR, diet interactions, and safety tips' },
  { id: 115, category: 'Pharmacist Patient Education', useCase: 'DOAC counselling', prompt: 'Create a patient leaflet comparing DOACs with key counselling points for each medication' },
  { id: 116, category: 'Pharmacist Patient Education', useCase: 'Methotrexate safety', prompt: 'Create a methotrexate patient safety card with dosing reminders and warning signs' },

  // Prescribing Support (117-120)
  { id: 117, category: 'Prescribing Support', useCase: 'Antibiotic stewardship', prompt: 'Create an antibiotic choice guide aligned with local formulary for common infections' },
  { id: 118, category: 'Prescribing Support', useCase: 'Repeat prescribing audit', prompt: 'Create an infographic showing repeat prescribing audit findings and quality improvement actions' },
  { id: 119, category: 'Prescribing Support', useCase: 'Formulary switching guide', prompt: 'Create a quick-reference guide for formulary medication switches with equivalent dosing' },
  { id: 120, category: 'Prescribing Support', useCase: 'Cost-effective alternatives', prompt: 'Create a comparison chart showing brand vs generic medication costs for common high-cost drugs' },
];

// Practice Manager prompts (146-165)
const practiceManagerPromptExamples: PromptExample[] = [
  // CQC & Compliance (146-149)
  { id: 146, category: 'CQC & Compliance', useCase: 'CQC preparation checklist', prompt: 'Create a comprehensive CQC inspection preparation checklist covering all five key lines of enquiry' },
  { id: 147, category: 'CQC & Compliance', useCase: 'Evidence portfolio template', prompt: 'Create an evidence portfolio template for demonstrating compliance with CQC fundamental standards' },
  { id: 148, category: 'CQC & Compliance', useCase: 'Inspection readiness guide', prompt: 'Create a staff briefing document on what to expect during a CQC inspection and how to prepare' },
  { id: 149, category: 'CQC & Compliance', useCase: 'Policy review tracker', prompt: 'Create a policy review tracker spreadsheet template with review dates, owners, and version control' },

  // Workforce & HR (150-153)
  { id: 150, category: 'Workforce & HR', useCase: 'Staff rota template', prompt: 'Create a weekly staff rota template for a GP practice covering clinical and admin roles' },
  { id: 151, category: 'Workforce & HR', useCase: 'Recruitment advertisement', prompt: 'Create a job advertisement for a Practice Nurse position including person specification and benefits' },
  { id: 152, category: 'Workforce & HR', useCase: 'Appraisal preparation guide', prompt: 'Create a staff appraisal preparation guide with self-assessment questions and goal-setting framework' },
  { id: 153, category: 'Workforce & HR', useCase: 'Induction checklist', prompt: 'Create a new starter induction checklist covering first day, first week, and first month activities' },

  // Finance & Contracts (154-157)
  { id: 154, category: 'Finance & Contracts', useCase: 'PCN DES funding summary', prompt: 'Create an infographic explaining PCN DES funding streams and what they cover for practice staff' },
  { id: 155, category: 'Finance & Contracts', useCase: 'QOF performance tracker', prompt: 'Create a monthly QOF performance dashboard template showing achievement rates by clinical domain' },
  { id: 156, category: 'Finance & Contracts', useCase: 'Budget summary template', prompt: 'Create a practice budget summary template for partner meetings with income and expenditure breakdown' },
  { id: 157, category: 'Finance & Contracts', useCase: 'Contract comparison guide', prompt: 'Create a comparison table of GMS, PMS, and APMS contracts highlighting key differences and requirements' },

  // Operations & Planning (158-161)
  { id: 158, category: 'Operations & Planning', useCase: 'Business continuity plan', prompt: 'Create a business continuity plan template for GP practices covering IT failure, staff absence, and premises issues' },
  { id: 159, category: 'Operations & Planning', useCase: 'Capacity and demand analysis', prompt: 'Create a capacity and demand analysis template to help balance appointment availability with patient need' },
  { id: 160, category: 'Operations & Planning', useCase: 'Workflow optimisation guide', prompt: 'Create a workflow improvement guide for reducing prescription turnaround time from 48 to 24 hours' },
  { id: 161, category: 'Operations & Planning', useCase: 'Meeting agenda template', prompt: 'Create a partners meeting agenda template with standard items for quarterly practice business meetings' },

  // Complaints & Governance (162-165)
  { id: 162, category: 'Complaints & Governance', useCase: 'Complaint response template', prompt: 'Create a formal complaint response letter template following NHS complaints procedure requirements' },
  { id: 163, category: 'Complaints & Governance', useCase: 'Significant event template', prompt: 'Create a significant event analysis template with root cause analysis and learning outcomes sections' },
  { id: 164, category: 'Complaints & Governance', useCase: 'Patient feedback summary', prompt: 'Create a patient feedback summary report template for presenting Friends and Family Test results to the team' },
  { id: 165, category: 'Complaints & Governance', useCase: 'Risk register template', prompt: 'Create a practice risk register template with likelihood, impact, mitigation actions, and review dates' },
];

// Healthcare Assistant prompts (166-185)
const hcaPromptExamples: PromptExample[] = [
  // Phlebotomy & Specimens (166-169)
  { id: 166, category: 'Phlebotomy & Specimens', useCase: 'Blood collection guide', prompt: 'Create a patient information leaflet explaining what to expect during a blood test appointment' },
  { id: 167, category: 'Phlebotomy & Specimens', useCase: 'Specimen labelling reminder', prompt: 'Create a clinical room poster showing correct specimen labelling requirements and common errors to avoid' },
  { id: 168, category: 'Phlebotomy & Specimens', useCase: 'Fasting instructions', prompt: 'Create a patient handout explaining fasting blood test requirements - what you can and cannot have before your test' },
  { id: 169, category: 'Phlebotomy & Specimens', useCase: 'Blood tube guide', prompt: 'Create a quick-reference guide showing blood collection tube colours and their uses for HCA training' },

  // NHS Health Checks (170-173)
  { id: 170, category: 'NHS Health Checks', useCase: 'Health Check invitation', prompt: 'Create a patient invitation letter for NHS Health Checks explaining benefits and what to expect' },
  { id: 171, category: 'NHS Health Checks', useCase: 'QRISK explanation', prompt: 'Create a patient-friendly handout explaining what QRISK scores mean and how to reduce cardiovascular risk' },
  { id: 172, category: 'NHS Health Checks', useCase: 'Lifestyle advice handout', prompt: 'Create a lifestyle advice leaflet covering diet, exercise, smoking, and alcohol following an NHS Health Check' },
  { id: 173, category: 'NHS Health Checks', useCase: 'Health Check process guide', prompt: 'Create a visual step-by-step guide for HCAs conducting NHS Health Checks from invitation to follow-up' },

  // Vital Signs & Observations (174-177)
  { id: 174, category: 'Vital Signs & Observations', useCase: 'BP measurement guide', prompt: 'Create a patient leaflet explaining how to prepare for accurate blood pressure measurement at home and in clinic' },
  { id: 175, category: 'Vital Signs & Observations', useCase: 'Weight management diary', prompt: 'Create a weight management diary template for patients attending weight monitoring appointments' },
  { id: 176, category: 'Vital Signs & Observations', useCase: 'Peak flow technique', prompt: 'Create a step-by-step visual guide showing correct peak flow meter technique for asthma patients' },
  { id: 177, category: 'Vital Signs & Observations', useCase: 'Vital signs record card', prompt: 'Create a patient-held vital signs record card for chronic disease monitoring between appointments' },

  // Clinical Procedures (178-181)
  { id: 178, category: 'Clinical Procedures', useCase: 'ECG preparation guide', prompt: 'Create a patient information leaflet explaining what happens during an ECG and how to prepare' },
  { id: 179, category: 'Clinical Procedures', useCase: 'Spirometry instructions', prompt: 'Create a patient handout with instructions for spirometry testing and breathing technique tips' },
  { id: 180, category: 'Clinical Procedures', useCase: 'Ear irrigation aftercare', prompt: 'Create an aftercare advice leaflet for patients following ear irrigation with warning signs' },
  { id: 181, category: 'Clinical Procedures', useCase: 'Wound care basics', prompt: 'Create a basic wound care information leaflet for patients with minor wounds and dressing changes' },

  // Patient Support (182-185)
  { id: 182, category: 'Patient Support', useCase: 'New patient registration', prompt: 'Create a new patient registration pack welcome leaflet explaining practice services and how to access them' },
  { id: 183, category: 'Patient Support', useCase: 'Chronic disease recall letter', prompt: 'Create a recall letter template inviting patients for their annual chronic disease review appointment' },
  { id: 184, category: 'Patient Support', useCase: 'Appointment preparation', prompt: 'Create a patient handout explaining how to prepare for routine chronic disease monitoring appointments' },
  { id: 185, category: 'Patient Support', useCase: 'Chaperone information', prompt: 'Create a patient information leaflet explaining what a chaperone is and your right to request one' },
];

// Advanced Nurse Practitioner / ACP prompts (186-210)
const anpPromptExamples: PromptExample[] = [
  // Minor Illness Management (186-190)
  { id: 186, category: 'Minor Illness', useCase: 'Sore throat assessment', prompt: 'Create a patient handout explaining FeverPAIN scoring for sore throats and when antibiotics are needed' },
  { id: 187, category: 'Minor Illness', useCase: 'UTI self-care', prompt: 'Create a patient leaflet on managing uncomplicated UTI symptoms and when to seek further help' },
  { id: 188, category: 'Minor Illness', useCase: 'Childhood rashes', prompt: 'Create a visual guide helping parents identify common childhood rashes and when to worry' },
  { id: 189, category: 'Minor Illness', useCase: 'Ear infection advice', prompt: 'Create a patient information leaflet about otitis media management and safety-netting advice' },
  { id: 190, category: 'Minor Illness', useCase: 'Cough management', prompt: 'Create a handout explaining expected duration of coughs and self-care measures' },

  // Chronic Disease Management (191-195)
  { id: 191, category: 'Chronic Disease', useCase: 'Hypertension monitoring', prompt: 'Create a home blood pressure monitoring diary with instructions for patients' },
  { id: 192, category: 'Chronic Disease', useCase: 'COPD action plan', prompt: 'Create a personalised COPD action plan template with rescue medication guidance' },
  { id: 193, category: 'Chronic Disease', useCase: 'Diabetes foot care', prompt: 'Create a patient leaflet on diabetic foot care and daily foot check routine' },
  { id: 194, category: 'Chronic Disease', useCase: 'Asthma inhaler technique', prompt: 'Create a step-by-step visual guide for correct MDI inhaler technique with spacer' },
  { id: 195, category: 'Chronic Disease', useCase: 'Heart failure self-management', prompt: 'Create a patient handout on heart failure warning signs and daily weight monitoring' },

  // Clinical Assessments (196-200)
  { id: 196, category: 'Clinical Assessments', useCase: 'ABCDE assessment', prompt: 'Create a quick-reference card for systematic ABCDE patient assessment in acute presentations' },
  { id: 197, category: 'Clinical Assessments', useCase: 'Respiratory examination', prompt: 'Create a visual checklist for comprehensive respiratory examination findings' },
  { id: 198, category: 'Clinical Assessments', useCase: 'Abdominal assessment', prompt: 'Create a systematic abdominal examination guide with red flag findings' },
  { id: 199, category: 'Clinical Assessments', useCase: 'Mental state examination', prompt: 'Create a mental state examination prompt card for use in depression and anxiety assessments' },
  { id: 200, category: 'Clinical Assessments', useCase: 'Falls risk assessment', prompt: 'Create a falls risk assessment checklist for elderly patients' },

  // Prescribing Support (201-204)
  { id: 201, category: 'ANP Prescribing', useCase: 'Antibiotic choice guide', prompt: 'Create a quick-reference guide for first-line antibiotic choices in common infections' },
  { id: 202, category: 'ANP Prescribing', useCase: 'Pain ladder', prompt: 'Create a visual WHO pain ladder with medication examples for each step' },
  { id: 203, category: 'ANP Prescribing', useCase: 'Inhaler formulary', prompt: 'Create an inhaler comparison chart showing device types, costs, and carbon footprint' },
  { id: 204, category: 'ANP Prescribing', useCase: 'Drug monitoring', prompt: 'Create a reference card for common drug monitoring requirements - bloods, timing, and frequency' },

  // Wound Care & Procedures (205-207)
  { id: 205, category: 'Wound Care', useCase: 'Wound assessment', prompt: 'Create a wound assessment documentation template using TIME framework' },
  { id: 206, category: 'Wound Care', useCase: 'Dressing selection', prompt: 'Create a wound dressing selection guide based on wound type and exudate level' },
  { id: 207, category: 'Wound Care', useCase: 'Leg ulcer pathway', prompt: 'Create a leg ulcer assessment and management pathway including ABPI guidance' },

  // Professional Development (208-210)
  { id: 208, category: 'ANP Development', useCase: 'CPD portfolio', prompt: 'Create a CPD reflection template for advanced practice competency development' },
  { id: 209, category: 'ANP Development', useCase: 'Clinical supervision', prompt: 'Create a clinical supervision session record template for ANP practice' },
  { id: 210, category: 'ANP Development', useCase: 'Competency framework', prompt: 'Create an infographic showing the four pillars of advanced practice' },
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

const splwCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Community Resources': {
    icon: <MapPin className="h-5 w-5" />,
    description: 'Local services, directories, and community asset guides',
    colour: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200'
  },
  'Wellbeing Support': {
    icon: <Sparkles className="h-5 w-5" />,
    description: 'Mental health, self-care, and holistic wellbeing materials',
    colour: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200'
  },
  'Group Activities': {
    icon: <Users className="h-5 w-5" />,
    description: 'Promoting group sessions, classes, and community events',
    colour: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  },
  'Patient Engagement': {
    icon: <HandHeart className="h-5 w-5" />,
    description: 'Materials to support patient conversations and goal-setting',
    colour: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'Signposting Materials': {
    icon: <Compass className="h-5 w-5" />,
    description: 'Handouts for benefits, housing, and specialist support services',
    colour: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
  },
  'Impact & Outcomes': {
    icon: <Activity className="h-5 w-5" />,
    description: 'Reporting, presentations, and showcasing service impact',
    colour: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  }
};

const pharmacistCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Medication Reviews': {
    icon: <ClipboardCheck className="h-5 w-5" />,
    description: 'Structured medication reviews and deprescribing guidance',
    colour: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  },
  'Medicines Optimisation': {
    icon: <FlaskConical className="h-5 w-5" />,
    description: 'Optimising medication efficacy and patient outcomes',
    colour: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  },
  'Medicines Safety': {
    icon: <AlertTriangle className="h-5 w-5" />,
    description: 'Drug interactions, monitoring, and safety protocols',
    colour: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'Pharmacist Patient Education': {
    icon: <MessageCircle className="h-5 w-5" />,
    description: 'Patient counselling and medication information materials',
    colour: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
  },
  'Prescribing Support': {
    icon: <Scale className="h-5 w-5" />,
    description: 'Formulary guidance, audits, and prescribing quality',
    colour: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200'
  }
};

const practiceManagerCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'CQC & Compliance': {
    icon: <FileCheck className="h-5 w-5" />,
    description: 'CQC preparation, evidence portfolios, and compliance tracking',
    colour: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'Workforce & HR': {
    icon: <Briefcase className="h-5 w-5" />,
    description: 'Staff rotas, recruitment, appraisals, and HR documentation',
    colour: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200'
  },
  'Finance & Contracts': {
    icon: <Landmark className="h-5 w-5" />,
    description: 'PCN funding, QOF tracking, budgets, and contract guidance',
    colour: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  },
  'Operations & Planning': {
    icon: <Building2 className="h-5 w-5" />,
    description: 'Business continuity, capacity planning, and workflow optimisation',
    colour: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  },
  'Complaints & Governance': {
    icon: <ClipboardPen className="h-5 w-5" />,
    description: 'Complaints handling, significant events, and governance documentation',
    colour: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
  }
};

const hcaCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Phlebotomy & Specimens': {
    icon: <Droplet className="h-5 w-5" />,
    description: 'Blood collection guidance, specimen handling, and patient preparation',
    colour: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  'NHS Health Checks': {
    icon: <Heart className="h-5 w-5" />,
    description: 'NHS Health Check invitations, QRISK explanations, and lifestyle advice',
    colour: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
  },
  'Vital Signs & Observations': {
    icon: <Gauge className="h-5 w-5" />,
    description: 'Blood pressure, weight monitoring, peak flow, and observations',
    colour: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
  },
  'Clinical Procedures': {
    icon: <Scissors className="h-5 w-5" />,
    description: 'ECG preparation, spirometry, ear irrigation, and wound care',
    colour: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'Patient Support': {
    icon: <UserCheck className="h-5 w-5" />,
    description: 'Patient registration, recall letters, and appointment preparation',
    colour: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  }
};

const anpCategoryConfig: Record<string, { icon: React.ReactNode; description: string; colour: string }> = {
  'Minor Illness': {
    icon: <Thermometer className="h-5 w-5" />,
    description: 'Patient information for common minor illness presentations',
    colour: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  },
  'Chronic Disease': {
    icon: <HeartPulse className="h-5 w-5" />,
    description: 'Long-term condition management and self-care materials',
    colour: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  'Clinical Assessments': {
    icon: <ShieldCheck className="h-5 w-5" />,
    description: 'Examination checklists and assessment frameworks',
    colour: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'ANP Prescribing': {
    icon: <Syringe className="h-5 w-5" />,
    description: 'Prescribing guidance, formularies, and drug information',
    colour: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  },
  'Wound Care': {
    icon: <Bandage className="h-5 w-5" />,
    description: 'Wound assessment, dressing selection, and procedure guides',
    colour: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
  },
  'ANP Development': {
    icon: <BookOpen className="h-5 w-5" />,
    description: 'CPD, supervision, and professional development materials',
    colour: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
  }
};

const categories = Object.keys(categoryConfig);
const gpCategories = Object.keys(gpCategoryConfig);
const splwCategories = Object.keys(splwCategoryConfig);
const pharmacistCategories = Object.keys(pharmacistCategoryConfig);
const practiceManagerCategories = Object.keys(practiceManagerCategoryConfig);
const hcaCategories = Object.keys(hcaCategoryConfig);
const anpCategories = Object.keys(anpCategoryConfig);
const allPrompts = [...promptExamples, ...gpPromptExamples, ...splwPromptExamples, ...pharmacistPromptExamples, ...practiceManagerPromptExamples, ...hcaPromptExamples, ...anpPromptExamples];

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

  const filteredSplwPrompts = useMemo(() => {
    if (!searchTerm.trim()) return splwPromptExamples;
    const term = searchTerm.toLowerCase();
    return splwPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredPharmacistPrompts = useMemo(() => {
    if (!searchTerm.trim()) return pharmacistPromptExamples;
    const term = searchTerm.toLowerCase();
    return pharmacistPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredAnpPrompts = useMemo(() => {
    if (!searchTerm.trim()) return anpPromptExamples;
    const term = searchTerm.toLowerCase();
    return anpPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredPracticeManagerPrompts = useMemo(() => {
    if (!searchTerm.trim()) return practiceManagerPromptExamples;
    const term = searchTerm.toLowerCase();
    return practiceManagerPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredHcaPrompts = useMemo(() => {
    if (!searchTerm.trim()) return hcaPromptExamples;
    const term = searchTerm.toLowerCase();
    return hcaPromptExamples.filter(
      p => p.useCase.toLowerCase().includes(term) || 
           p.prompt.toLowerCase().includes(term) ||
           p.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredAllPrompts = useMemo(() => {
    return [...filteredStaffPrompts, ...filteredGpPrompts, ...filteredSplwPrompts, ...filteredPharmacistPrompts, ...filteredPracticeManagerPrompts, ...filteredHcaPrompts, ...filteredAnpPrompts];
  }, [filteredStaffPrompts, filteredGpPrompts, filteredSplwPrompts, filteredPharmacistPrompts, filteredPracticeManagerPrompts, filteredHcaPrompts, filteredAnpPrompts]);

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

  const splwPromptsByCategory = useMemo(() => {
    return splwCategories.reduce((acc, category) => {
      acc[category] = filteredSplwPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredSplwPrompts]);

  const pharmacistPromptsByCategory = useMemo(() => {
    return pharmacistCategories.reduce((acc, category) => {
      acc[category] = filteredPharmacistPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredPharmacistPrompts]);

  const anpPromptsByCategory = useMemo(() => {
    return anpCategories.reduce((acc, category) => {
      acc[category] = filteredAnpPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredAnpPrompts]);

  const practiceManagerPromptsByCategory = useMemo(() => {
    return practiceManagerCategories.reduce((acc, category) => {
      acc[category] = filteredPracticeManagerPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredPracticeManagerPrompts]);

  const hcaPromptsByCategory = useMemo(() => {
    return hcaCategories.reduce((acc, category) => {
      acc[category] = filteredHcaPrompts.filter(p => p.category === category);
      return acc;
    }, {} as Record<string, PromptExample[]>);
  }, [filteredHcaPrompts]);

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
        title="AI4GP Prompt Guide | 210 Example Prompts for GP Practices | NoteWell AI"
        description="Comprehensive guide with 210 example prompts for practice staff, practice managers, GPs, HCAs, clinical pharmacists, nurse practitioners, and social prescribers - clinical protocols, patient education, and more using AI4GP."
        canonical="https://www.gpnotewell.co.uk/ai4gp-prompts"
        keywords="AI4GP prompts, GP practice prompts, practice manager prompts, HCA prompts, clinical pharmacist prompts, ANP prompts, nurse practitioner, social prescribing, SPLW prompts, clinical protocols, patient education, CQC compliance"
      />
      
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <Link to="/ai4gp" className="text-muted-foreground hover:text-foreground transition-colors mt-1 sm:mt-0">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to AI4GP</span>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">AI4GP Prompt Guide</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">210 example prompts for GP practice teams</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Introduction */}
        <section aria-labelledby="intro-heading" className="mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle id="intro-heading" className="text-lg sm:text-xl">How to Use This Guide</CardTitle>
              <CardDescription className="text-sm">
                This page contains 210 example prompts organised by role and category - 50 for practice staff, 20 for practice managers, 25 for GPs, 25 for social prescribers, 20 for clinical pharmacists, 20 for HCAs, and 25 for nurse practitioners (ANP/ACP). Copy them directly into AI4GP or customise for your needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-0">
              <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-muted-foreground text-sm">
                <li>Tap any prompt to copy it to your clipboard</li>
                <li>Customise prompts with your practice name and specific details</li>
                <li>Use the search box to find prompts by keyword</li>
                <li>Expand categories to view all related prompts</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Search */}
        <section aria-label="Search prompts" className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
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
        <section aria-labelledby="staff-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="staff-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Practice Staff Prompts</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">50 prompts for reception, admin, and practice management teams</p>
          
          <Accordion type="multiple" defaultValue={categories} className="space-y-3 sm:space-y-4">
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
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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
        <section aria-labelledby="gp-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="gp-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">GP & Clinician Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">25 prompts for clinical, educational, and professional development materials</p>
          
          <Accordion type="multiple" defaultValue={gpCategories} className="space-y-3 sm:space-y-4">
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
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Social Prescribing Link Worker Categories */}
        <section aria-labelledby="splw-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="splw-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Social Prescribing Link Worker (SPLW) Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">25 prompts for community signposting, wellbeing support, and patient engagement</p>
          
          <Accordion type="multiple" defaultValue={splwCategories} className="space-y-3 sm:space-y-4">
            {splwCategories.map((category) => {
              const config = splwCategoryConfig[category];
              const categoryPrompts = splwPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Clinical Pharmacist Categories */}
        <section aria-labelledby="pharmacist-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="pharmacist-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Clinical Pharmacist Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">20 prompts for medication reviews, medicines optimisation, safety, and prescribing support</p>
          
          <Accordion type="multiple" defaultValue={pharmacistCategories} className="space-y-3 sm:space-y-4">
            {pharmacistCategories.map((category) => {
              const config = pharmacistCategoryConfig[category];
              const categoryPrompts = pharmacistPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Practice Manager Categories */}
        <section aria-labelledby="pm-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="pm-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Practice Manager Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">20 prompts for CQC compliance, workforce management, finance, operations, and governance</p>
          
          <Accordion type="multiple" defaultValue={practiceManagerCategories} className="space-y-3 sm:space-y-4">
            {practiceManagerCategories.map((category) => {
              const config = practiceManagerCategoryConfig[category];
              const categoryPrompts = practiceManagerPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Healthcare Assistant (HCA) Categories */}
        <section aria-labelledby="hca-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="hca-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Healthcare Assistant (HCA) Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">20 prompts for phlebotomy, NHS Health Checks, vital signs, clinical procedures, and patient support</p>
          
          <Accordion type="multiple" defaultValue={hcaCategories} className="space-y-3 sm:space-y-4">
            {hcaCategories.map((category) => {
              const config = hcaCategoryConfig[category];
              const categoryPrompts = hcaPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Advanced Nurse Practitioner / ACP Categories */}
        <section aria-labelledby="anp-categories-heading" className="mb-8 sm:mb-12">
          <h2 id="anp-categories-heading" className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-4">Advanced Nurse Practitioner (ANP/ACP) Use Cases</h2>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">25 prompts for minor illness, chronic disease management, clinical assessments, and prescribing</p>
          
          <Accordion type="multiple" defaultValue={anpCategories} className="space-y-3 sm:space-y-4">
            {anpCategories.map((category) => {
              const config = anpCategoryConfig[category];
              const categoryPrompts = anpPromptsByCategory[category];
              
              if (categoryPrompts.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={category} 
                  value={category}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${config.colour}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base">{category}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-normal line-clamp-1">{config.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2 sm:mr-4 shrink-0 text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {categoryPrompts.map((example) => (
                        <div 
                          key={example.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">#{example.id}</span>
                              <h4 className="font-medium text-foreground text-sm">{example.useCase}</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(example.prompt, example.id)}
                              aria-label={`Copy prompt: ${example.useCase}`}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              {copiedId === example.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80">{example.prompt}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block overflow-x-auto">
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

        {/* Quick Reference Table - for LLM consumption - hidden on mobile */}
        <section aria-labelledby="full-list-heading" className="mt-8 sm:mt-12 hidden sm:block">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle id="full-list-heading" className="text-lg sm:text-xl">Complete Prompt Reference</CardTitle>
              <CardDescription className="text-sm">
                All 210 prompts in a single searchable table for quick reference
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
        <section aria-labelledby="tips-heading" className="mt-6 sm:mt-8">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle id="tips-heading" className="text-lg sm:text-xl">Tips for Better Results</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-0">
              <ol className="list-decimal pl-4 sm:pl-5 space-y-2 text-muted-foreground text-sm">
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
        <footer className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-muted-foreground border-t pt-6 sm:pt-8 pb-4">
          <p>This guide is part of <strong>AI4GP by NoteWell AI</strong></p>
          <p className="mt-1">For more information, visit <a href="https://www.gpnotewell.co.uk" className="text-primary hover:underline">gpnotewell.co.uk</a></p>
        </footer>
      </main>
    </div>
  );
};

export default AI4GPPromptGuide;
