import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { AmazonTranscribeMedicalTest } from '@/components/AmazonTranscribeMedicalTest';

const TestTranscripts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedTranscripts, setCopiedTranscripts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('medical-test');

  // Handle URL fragments to open the correct tab
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    const tabMapping: Record<string, string> = {
      'medical-test': 'medical-test',
      'consultations': 'consultations',
      'partnership': 'partnership', 
      'pcn': 'pcn',
      'lmc': 'lmc'
    };
    
    if (hash && tabMapping[hash]) {
      setActiveTab(tabMapping[hash]);
    }
  }, [location.hash]);

  const copyToClipboard = async (text: string, transcriptId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTranscripts(prev => new Set(prev).add(transcriptId));
      toast("Transcript copied to clipboard");
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedTranscripts(prev => {
          const newSet = new Set(prev);
          newSet.delete(transcriptId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const gpPartnershipTranscripts = [
    {
      id: 'gp-partnership-1',
      title: 'Monthly Partnership Meeting - November 2024',
      description: 'Partnership meeting discussing finances, staffing, and CQC preparation',
      transcript: `PARTNERSHIP MEETING TRANSCRIPT
Date: 15th November 2024, 7:30 PM
Location: Main Practice Conference Room
Attendees: Dr Sarah Mitchell (Senior Partner), Dr James Wilson (Partner), Dr Priya Patel (Partner), Lisa Thompson (Practice Manager)

Dr Mitchell: Good evening everyone. Let's start with the financial review. Lisa, could you present the October figures?

Lisa Thompson: Thank you, Sarah. October showed a 3% increase in overall revenue compared to September. Our QOF performance is at 94% which puts us on track for full achievement. However, we're seeing increased locum costs due to Dr Henderson's extended sick leave.

Dr Wilson: What's the total locum spend for October?

Lisa Thompson: £12,400, which is £4,000 over budget. We need to consider either recruiting a permanent replacement or restructuring the appointment system.

Dr Patel: I've been covering extra sessions, but it's becoming unsustainable. Are we actively recruiting?

Lisa Thompson: We have three candidates shortlisted for interview next week. Two are experienced GPs, one is a recently qualified GP looking for their first permanent position.

Dr Mitchell: Good. Let's move to the CQC preparation. Lisa, where are we with the evidence folders?

Lisa Thompson: Most domains are complete. We're still gathering evidence for the 'Well-led' domain, particularly around partnership governance and succession planning.

Dr Wilson: We need to formalize our partnership agreement review process. It hasn't been updated since 2019.

Dr Patel: Agreed. Also, we should document our clinical supervision arrangements more clearly.

Dr Mitchell: I'll arrange a meeting with our solicitor next month. Any other business?

Dr Wilson: The car park resurfacing quote came in at £8,500. Given our current financial position, should we proceed?

Lisa Thompson: I'd recommend deferring until Q1 next year when we have clearer cash flow projections.

Dr Mitchell: Agreed. Meeting adjourned at 8:45 PM. Next meeting scheduled for 20th December 2024.

Action Points:
- Interview candidates for permanent GP position (Lisa - by 22nd Nov)
- Arrange partnership agreement review meeting (Sarah - by 15th Dec)  
- Complete CQC evidence folders (All partners - by 30th Nov)
- Review car park resurfacing in Q1 2025 (Lisa - Jan 2025)`
    },
    {
      id: 'gp-partnership-2',
      title: 'Emergency Partnership Meeting - Staff Issue',
      description: 'Urgent meeting to discuss practice nurse complaint and resolution',
      transcript: `EMERGENCY PARTNERSHIP MEETING TRANSCRIPT
Date: 3rd October 2024, 12:30 PM
Location: Dr Mitchell's Office (Virtual attendance for Dr Wilson)
Attendees: Dr Sarah Mitchell (Senior Partner), Dr James Wilson (Partner - Teams), Dr Priya Patel (Partner), Lisa Thompson (Practice Manager)

Dr Mitchell: Thank you all for making time at short notice. Lisa, please brief us on the situation with Emma.

Lisa Thompson: This morning, Emma Richardson, our senior practice nurse, submitted a formal grievance. She's alleging workplace bullying from Dr Peterson and is threatening to resign.

Dr Patel: This is serious. What specifically is she claiming?

Lisa Thompson: She states that Dr Peterson has been dismissive of her clinical decisions, made derogatory comments about her diabetes management protocols, and questioned her competence in front of patients on three occasions.

Dr Wilson: [via Teams] Have we documented these incidents previously?

Lisa Thompson: That's part of the problem. Emma says she raised concerns informally in July, but we have no written record. Dr Peterson denies the allegations.

Dr Mitchell: We need to handle this properly. What's our next step legally?

Lisa Thompson: I've spoken to our HR consultant. We need to initiate a formal investigation within 7 days. This means appointing an investigating officer and following our grievance procedure.

Dr Patel: Can we appoint someone externally? Given the small team, internal investigation might be problematic.

Lisa Thompson: Yes, I recommend we use an external HR consultant. It will cost approximately £2,500 but ensures impartiality.

Dr Wilson: [via Teams] Agreed. We can't afford to lose Emma - she's integral to our diabetes clinic and has excellent patient feedback.

Dr Mitchell: I'll speak to Dr Peterson this afternoon to make him aware of the formal process. We need to ensure all interactions are documented going forward.

Dr Patel: Should we consider mediation as an alternative?

Lisa Thompson: We can offer it, but Emma seems quite distressed. She's already been in contact with her union representative.

Dr Mitchell: Let's proceed with the external investigation. Lisa, please arrange this today. We'll suspend any direct working relationship between Emma and Dr Peterson pending resolution.

Dr Wilson: [via Teams] How will this affect our appointment capacity?

Dr Patel: I can cover the diabetes clinics temporarily. We might need to reduce routine bookings for two weeks.

Lisa Thompson: I'll prepare a rota adjustment and communicate with patients who might be affected.

Dr Mitchell: This is a priority. Our practice reputation and team morale depend on resolving this properly. Meeting closed at 1:15 PM.

Action Points:
- Appoint external HR consultant for investigation (Lisa - by 4th Oct)
- Speak to Dr Peterson regarding formal process (Sarah - 3rd Oct PM)
- Adjust clinical rota to separate Emma and Dr Peterson (Lisa - by 4th Oct)
- Prepare patient communication for clinic changes (Lisa - by 5th Oct)`
    }
  ];

  const pcnTranscripts = [
    {
      id: 'pcn-1',
      title: 'PCN Clinical Directors Meeting - December 2024',
      description: 'Monthly PCN meeting covering DES requirements and ARRS staffing',
      transcript: `PCN CLINICAL DIRECTORS MEETING TRANSCRIPT
Date: 12th December 2024, 6:00 PM
Location: Northgate Medical Centre, Conference Room
PCN: Riverside Primary Care Network
Attendees: Dr Sarah Mitchell (Clinical Director), Dr Michael Barnes (Deputy), Dr Jennifer Walsh (Practice Lead), Dr Anil Kumar (Practice Lead), Susan Peters (PCN Manager), Dr Lisa Chen (Practice Lead)

Dr Mitchell: Good evening, everyone. First item - DES performance update. Susan, where do we stand?

Susan Peters: We're performing well across most indicators. IIF achievement is at 87%, which exceeds the national average. However, we're struggling with the medication review targets - currently at 73%.

Dr Barnes: Which practices are behind on medication reviews?

Susan Peters: Primarily Elmwood Surgery and Riverside Health Centre. They're reporting capacity issues with their clinical pharmacists.

Dr Kumar: Our pharmacist is covering two practices since David left in September. It's simply not sustainable.

Dr Mitchell: This brings us to ARRS recruitment. Susan, update on new appointments?

Susan Peters: Good news - we've successfully recruited a mental health practitioner starting in January. The social prescriber post has been advertised but no suitable candidates yet.

Dr Walsh: What about the additional physiotherapist position?

Susan Peters: Still pending ICB approval. They're questioning the business case, particularly the projected patient demand figures.

Dr Chen: Our referral data clearly shows the need. Southside Practice alone has a three-week wait for MSK appointments.

Dr Mitchell: I'll escalate this to the ICB Primary Care Board. Moving on - winter pressures planning.

Dr Barnes: A&E diversion scheme is working well. We've managed 145 same-day urgent appointments this month, preventing approximately 40 A&E attendances.

Dr Kumar: The extended hours service is popular, but we're seeing reduced attendance at weekend slots.

Susan Peters: Saturday morning slots are 89% utilization, but Sunday slots only 45%. Should we reallocate?

Dr Walsh: Yes, move Sunday capacity to weekday evenings. Patients prefer that timing.

Dr Mitchell: Agreed. Susan, please adjust the rota from January. Any other business?

Dr Chen: The shared care protocol for ADHD medications - when does this go live?

Susan Peters: ICB confirmed 1st February 2025. All practices will need updated protocols and staff training.

Dr Barnes: Are we getting additional funding for this increased workload?

Dr Mitchell: Not specifically, but it's captured under the mental health investment standard. We should see benefits through reduced specialist referrals long-term.

Dr Kumar: Speaking of funding, what's the update on the PCN premises development?

Susan Peters: Northgate extension is approved - construction starts March 2025. This will house the expanded ARRS team and provide additional clinical space.

Dr Walsh: Excellent. That will solve our space constraints for the mental health practitioner.

Dr Mitchell: Great progress everyone. Next meeting is 16th January 2025. Meeting closed at 7:30 PM.

Action Points:
- Escalate physiotherapist approval to ICB Primary Care Board (Sarah - by 20th Dec)
- Adjust extended hours rota for January (Susan - by 22nd Dec)
- Arrange ADHD shared care protocol training (Susan - by 31st Jan)
- Coordinate medication review capacity across practices (Susan - ongoing)`
    }
  ];

  const lmcTranscripts = [
    {
      id: 'lmc-1',
      title: 'Local Medical Committee Meeting - Contract Negotiations',
      description: 'LMC meeting discussing GP contract changes and industrial action',
      transcript: `LOCAL MEDICAL COMMITTEE MEETING TRANSCRIPT
Date: 28th November 2024, 7:00 PM
Location: Medical Centre Conference Room
LMC: Northshire Local Medical Committee
Attendees: Dr Robert Hayes (Chair), Dr Sarah Mitchell (Secretary), Dr David Park (Vice Chair), Dr Amanda Foster, Dr James Wilson, Dr Priya Patel, Dr Michael Barnes (8 members present)

Dr Hayes: Good evening, colleagues. Thank you for attending during these challenging times. Our main agenda tonight is the proposed GP contract changes for 2025-26.

Dr Park: The proposed changes are simply unacceptable. Additional administrative burden without corresponding funding increase will break practices.

Dr Mitchell: I've prepared a summary of the key changes: mandatory social prescribing documentation, extended QOF indicators, and new patient safety reporting requirements - all without additional resource allocation.

Dr Foster: Our practice calculated it would require an additional 2.5 hours per week per GP to meet these requirements. That's unsustainable.

Dr Wilson: Has the BMA provided guidance on collective response?

Dr Hayes: The BMA has indicated potential for coordinated action if negotiations fail. However, we need to exhaust all diplomatic channels first.

Dr Barnes: What about the proposed changes to the Directed Enhanced Services?

Dr Mitchell: The PCN DES modifications actually look more favorable - additional funding for ARRS roles and some flexibility in service delivery models.

Dr Patel: But they're balancing that against cuts to core GMS funding. It's robbing Peter to pay Paul.

Dr Hayes: I've scheduled a meeting with the ICB Medical Director next week. Dr Park and Dr Mitchell will attend with me to present our concerns formally.

Dr Park: Good. We need to emphasize the patient safety implications. Rushed consultations due to administrative overload directly impact care quality.

Dr Foster: Are other LMCs taking similar positions?

Dr Hayes: I've been in contact with neighboring LMCs - there's broad consensus that these changes are unworkable as currently proposed.

Dr Wilson: What about the pension tax implications of the proposed changes to superannuation?

Dr Mitchell: That's a complex area. I recommend individual practices seek specialist accountancy advice. The BMA has published guidance, but it's quite technical.

Dr Barnes: We should consider organizing a local meeting for practice managers. They're struggling to understand the administrative implications.

Dr Hayes: Excellent suggestion. Dr Mitchell, could you coordinate this?

Dr Mitchell: Yes, I'll arrange a session for early January. We could invite the ICB's practice support team.

Dr Patel: Any update on the premises costs controversy?

Dr Hayes: The ICB has agreed to review the reimbursement rates, but no timeline has been provided. Several practices are facing significant shortfalls.

Dr Foster: Our practice is £800 per month short on actual costs versus reimbursement. It's not sustainable long-term.

Dr Hayes: I'll raise this specifically in next week's meeting. Any other urgent business?

Dr Park: The locum shortage is becoming critical. Two practices in our area are struggling to maintain safe staffing levels.

Dr Wilson: The BMA's locum guidance suggests we need to discuss minimum rates collectively to ensure service sustainability.

Dr Hayes: That's a sensitive area legally. We should seek BMA guidance on appropriate collective approaches.

Dr Mitchell: I'll contact the BMA's LMC support team for advice on this.

Dr Hayes: Thank you all. These are challenging times, but united representation gives us the best chance of protecting patient care and practice sustainability. Next meeting: 19th December 2024.

Action Points:
- Meet with ICB Medical Director regarding contract concerns (Robert, David, Sarah - 5th Dec)
- Organize practice manager meeting on contract changes (Sarah - early Jan)
- Seek BMA guidance on locum rate discussions (Sarah - by 10th Dec)
- Follow up on premises cost reimbursement review (Robert - ongoing)`
    }
  ];

  const patientConsultationTranscripts = [
    {
      id: 'consultation-1',
      title: 'Type 2 Diabetes Review - Complex Case',
      description: 'Annual diabetes review with multiple comorbidities and medication adjustments',
      transcript: `PATIENT CONSULTATION TRANSCRIPT
Date: 14th November 2024, 10:30 AM
GP: Dr Sarah Mitchell
Patient: Margaret Thompson (DOB: 15/03/1956, Age: 68)
Consultation Type: Annual Diabetes Review

Dr Mitchell: Good morning, Mrs Thompson. How are you feeling today?

Mrs Thompson: Morning, Doctor. I'm alright, though my feet have been bothering me more lately.

Dr Mitchell: I see from your notes that you're here for your annual diabetes check. Let's start with how you've been managing your blood sugars.

Mrs Thompson: Well, I've been testing like you said, twice a day. The morning ones are usually around 8 or 9, but sometimes they go up to 12 after meals.

Dr Mitchell: Those morning readings are a bit higher than we'd like. Are you taking your metformin regularly?

Mrs Thompson: Yes, every morning with breakfast. Though I sometimes forget the evening dose if I'm watching TV.

Dr Mitchell: That might explain the higher morning readings. The evening dose is important for overnight glucose control. Let me check your recent blood test results... Your HbA1c has increased from 58 to 67 mmol/mol since last year.

Mrs Thompson: Is that bad, Doctor?

Dr Mitchell: It's not ideal - we aim for under 58. This suggests your diabetes control has slipped a bit. Combined with your blood pressure being 165/95 today, we need to make some adjustments.

Mrs Thompson: My blood pressure's high too? I've been taking those tablets you gave me.

Dr Mitchell: Yes, the amlodipine. When did you last take it?

Mrs Thompson: This morning, about 8 o'clock with my breakfast.

Dr Mitchell: Good. Let me examine your feet since you mentioned they're bothering you. Can you remove your shoes and socks for me?

[Examination]

Dr Mitchell: I can see some hard skin on your heels and your circulation seems a bit reduced. When did you last see the podiatrist?

Mrs Thompson: Oh, it's been months. They sent me a letter but I lost it.

Dr Mitchell: We need to get you back with podiatry. I'm also concerned about some reduced sensation in your toes - this is common with diabetes but needs monitoring.

Mrs Thompson: Does that mean it's getting worse, Doctor?

Dr Mitchell: Not necessarily worse, but it shows we need better control of your blood sugar. I'm going to increase your metformin to 1000mg twice daily and add another medication called gliclazide.

Mrs Thompson: More tablets? I'm already taking so many.

Dr Mitchell: I understand your concern. Let's review what you're currently taking: metformin, amlodipine, simvastatin, and aspirin. The gliclazide will help bring your blood sugar down.

Mrs Thompson: Will it have side effects?

Dr Mitchell: The main risk is low blood sugar, especially if you don't eat regularly. I'll give you a leaflet about the warning signs. You'll need to test your blood sugar more frequently initially.

Mrs Thompson: How often?

Dr Mitchell: Four times daily for the first two weeks, then we can reduce it. I'd like to see you again in 4 weeks to check how you're getting on.

Mrs Thompson: Alright, Doctor. What about my feet?

Dr Mitchell: I'm referring you back to podiatry - they should see you within 6 weeks. In the meantime, check your feet daily for any cuts or sores, keep them clean and dry, and wear properly fitting shoes.

Mrs Thompson: Should I be worried about anything else?

Dr Mitchell: Continue with your eye screening appointments - you're due for one next month. Keep taking your other medications as prescribed. If you feel unwell, dizzy, or very thirsty, contact us immediately.

Mrs Thompson: Thank you, Doctor. Will my diabetes get better?

Dr Mitchell: With good control, we can prevent complications and help you feel better. The foot discomfort should improve with better sugar control. Diet and gentle exercise remain important too.

Mrs Thompson: I'll try my best with the tablets.

Dr Mitchell: That's all we can ask. The practice nurse will call you next week to discuss the new medication and arrange your follow-up blood tests.

Examination findings:
- BP: 165/95 mmHg
- Weight: 78kg (BMI 32)
- Foot examination: Reduced sensation distally, hard skin on heels, palpable pedal pulses
- No acute concerns

Plan:
1. Increase metformin to 1000mg BD
2. Start gliclazide 40mg OD
3. Refer to podiatry (urgent)
4. Follow-up appointment in 4 weeks
5. Nurse appointment next week for medication counselling
6. Blood tests in 2 weeks (glucose, HbA1c)

Safety netting: Contact practice if unwell, dizzy, or symptoms of hypo/hyperglycemia`
    },
    {
      id: 'consultation-2',
      title: 'Mental Health Consultation - First Presentation',
      description: 'Patient presenting with anxiety and low mood following work stress',
      transcript: `PATIENT CONSULTATION TRANSCRIPT
Date: 20th November 2024, 2:15 PM
GP: Dr James Wilson
Patient: David Richards (DOB: 22/07/1985, Age: 39)
Consultation Type: Mental Health Assessment

Dr Wilson: Good afternoon, Mr Richards. I understand you wanted to discuss how you've been feeling recently?

Mr Richards: Yes, Doctor. I've been struggling for a few weeks now. My wife made me come in because she's worried about me.

Dr Wilson: Can you tell me what's been troubling you?

Mr Richards: It's hard to explain. I just feel... overwhelmed. Everything seems too much at the moment. Work, bills, the kids - I can't seem to cope like I used to.

Dr Wilson: That sounds very difficult. When did you first notice these feelings?

Mr Richards: Probably about 6 weeks ago. There were some redundancies at work - I kept my job, but the workload doubled. I'm doing the work of three people now.

Dr Wilson: That's a significant amount of stress. How is this affecting your daily life?

Mr Richards: I'm not sleeping well - I lie awake worrying about work, money, whether I'll be next for redundancy. I'm tired all the time but can't switch off.

Dr Wilson: What about your appetite and energy levels?

Mr Richards: Not eating much. My wife says I've lost weight. I just don't feel hungry, and when I do eat, my stomach feels tight and nervous.

Dr Wilson: Are you still enjoying things you used to like doing?

Mr Richards: Not really. I used to go to the gym three times a week, play football on Sundays. Haven't done either for weeks now. Just don't see the point.

Dr Wilson: Have you had any thoughts about harming yourself or that life isn't worth living?

Mr Richards: [long pause] Sometimes I think everyone would be better off without me. But I wouldn't do anything - I've got my kids to think about.

Dr Wilson: I'm glad you feel you can tell me that, and that you're thinking about your children. Have you ever felt this way before?

Mr Richards: When I was at university, I had a bad patch during exams. But nothing like this. This feels different, more intense.

Dr Wilson: Did you get any help at university?

Mr Richards: I saw a counselor a few times. It helped, but I was young then. This feels more serious somehow.

Dr Wilson: You mentioned your wife is worried. How are things at home?

Mr Richards: She's been great, really supportive. But I can see she's frustrated too. I'm snappy with the kids, can't concentrate on conversations. I feel like I'm letting everyone down.

Dr Wilson: It sounds like you're being very hard on yourself. These feelings you're describing - the low mood, anxiety, sleep problems, loss of interest - they're symptoms of depression and anxiety.

Mr Richards: Am I depressed, Doctor? I always thought I was quite resilient.

Dr Wilson: Depression can affect anyone, regardless of how strong they usually are. Significant life stress, like work pressure, can trigger it in people who've never experienced it before.

Mr Richards: What can be done about it?

Dr Wilson: There are several options. We could consider talking therapy, medication, or both. There are also self-help strategies that can be effective.

Mr Richards: I'm not sure about taking tablets. Will they change my personality?

Dr Wilson: Antidepressants don't change your personality - they help restore your normal mood and thinking patterns. However, we don't have to start with medication if you'd prefer to try other approaches first.

Mr Richards: What about counseling?

Dr Wilson: I can refer you to our practice counselor or the NHS talking therapies service. There's usually a 4-6 week wait, but they offer cognitive behavioral therapy which is very effective for anxiety and depression.

Mr Richards: How long does it take to feel better?

Dr Wilson: It varies, but with the right support, most people start feeling some improvement within 6-8 weeks. The key is finding what works best for you.

Mr Richards: What can I do while I'm waiting for counseling?

Dr Wilson: Exercise can be very helpful - even gentle walking. Try to maintain a routine, eat regularly, and avoid alcohol. I'll give you some self-help leaflets and details of online resources.

Mr Richards: Should I tell work?

Dr Wilson: That's your choice. If you need time off, I can provide a sick note. Many employers have occupational health services that can help with workplace stress.

Mr Richards: I think I'd like to try the counseling first, if that's okay?

Dr Wilson: Absolutely. I'll make the referral today. I'd also like to see you again in two weeks to see how you're getting on.

Mr Richards: Thank you, Doctor. I feel a bit better just talking about it.

Dr Wilson: That's a positive sign. Remember, this is treatable, and asking for help shows strength, not weakness.

Assessment:
- PHQ-9 score: 16 (moderately severe depression)
- GAD-7 score: 14 (moderate anxiety)
- No immediate suicide risk but some passive thoughts
- Good insight and motivation for treatment

Plan:
1. Refer to NHS talking therapies (IAPT)
2. Self-help resources and lifestyle advice
3. Review in 2 weeks
4. Consider medication if no improvement or deterioration
5. Safety netting: contact practice if thoughts of self-harm worsen

Safety netting: Contact practice immediately if thoughts of self-harm increase, or call Samaritans (116 123) for immediate support`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/ai4gp')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to AI4GP
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Test Transcripts</h1>
            <p className="text-muted-foreground">
              Realistic example transcripts for testing AI tools and transcription services
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="medical-test">Medical Test</TabsTrigger>
            <TabsTrigger value="consultations">Patient Consultations</TabsTrigger>
            <TabsTrigger value="partnership">GP Partnership</TabsTrigger>
            <TabsTrigger value="pcn">PCN Meetings</TabsTrigger>
            <TabsTrigger value="lmc">LMC Meetings</TabsTrigger>
          </TabsList>

          <TabsContent value="medical-test" className="space-y-6">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold">Amazon Transcribe Medical Test</h2>
                <p className="text-muted-foreground">
                  Test clinical-grade speech-to-text with medical vocabulary and speaker identification
                </p>
              </div>
              <AmazonTranscribeMedicalTest />
            </div>
          </TabsContent>

          <TabsContent value="consultations" className="space-y-6">
            <div className="grid gap-6">
              {patientConsultationTranscripts.map((transcript) => (
                <Card key={transcript.id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{transcript.title}</CardTitle>
                        <CardDescription>{transcript.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transcript.transcript, transcript.id)}
                        className="flex items-center gap-2"
                      >
                        {copiedTranscripts.has(transcript.id) ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      {transcript.transcript}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="partnership" className="space-y-6">
            <div className="grid gap-6">
              {gpPartnershipTranscripts.map((transcript) => (
                <Card key={transcript.id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{transcript.title}</CardTitle>
                        <CardDescription>{transcript.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transcript.transcript, transcript.id)}
                        className="flex items-center gap-2"
                      >
                        {copiedTranscripts.has(transcript.id) ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      {transcript.transcript}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pcn" className="space-y-6">
            <div className="grid gap-6">
              {pcnTranscripts.map((transcript) => (
                <Card key={transcript.id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{transcript.title}</CardTitle>
                        <CardDescription>{transcript.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transcript.transcript, transcript.id)}
                        className="flex items-center gap-2"
                      >
                        {copiedTranscripts.has(transcript.id) ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      {transcript.transcript}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="lmc" className="space-y-6">
            <div className="grid gap-6">
              {lmcTranscripts.map((transcript) => (
                <Card key={transcript.id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{transcript.title}</CardTitle>
                        <CardDescription>{transcript.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transcript.transcript, transcript.id)}
                        className="flex items-center gap-2"
                      >
                        {copiedTranscripts.has(transcript.id) ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      {transcript.transcript}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TestTranscripts;