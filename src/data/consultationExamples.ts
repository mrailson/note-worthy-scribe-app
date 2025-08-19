export interface ConsultationExample {
  id: string;
  title: string;
  type: string;
  duration: string;
  transcript: string;
  summary: string;
  patientCopy: string;
  aiReview: string;
  referralNeeded: boolean;
  referralLetter?: string;
}

export const consultationExamples: ConsultationExample[] = [
  {
    id: "urti-example",
    title: "Upper Respiratory Tract Infection",
    type: "Acute Illness",
    duration: "9:50",
    transcript: `00:00 Clinician: Hello, I'm Dr Patel. Before we start, can I quickly confirm your full name and date of birth?
00:06 Patient: Yes, Alex Jones, born 12th March 1989.
00:10 Clinician: Thanks Alex. Is it okay if I use a digital scribe to generate a summary of today's consultation?
00:16 Patient: Yes, I'm happy with that.
00:18 Clinician: Great. What's brought you in today and what would you like us to focus on?
00:23 Patient: I've had a sore throat and a blocked nose for about three days. The cough started dry but today I'm coughing up a bit of clear stuff.
00:33 Clinician: Any fever or chills? Ear pain, sinus pressure or tooth pain?
00:38 Patient: I felt shivery yesterday evening and a bit sweaty overnight, but no earache or tooth pain. My face feels heavy.
00:46 Clinician: Any shortness of breath, chest pain, wheeze, or coughing up blood?
00:50 Patient: No to all of those. Breathing's fine, just the annoying cough.
00:54 Clinician: How's your throat—any difficulty swallowing, drooling, voice changes or severe one‑sided pain?
01:00 Patient: It's sore when I swallow but manageable. No drooling or voice problems.
01:05 Clinician: Have you lost your sense of taste or smell? Any sickness or diarrhoea?
01:10 Patient: Taste and smell are okay. No sickness or diarrhoea.
01:14 Clinician: What have you tried for it so far?
01:16 Patient: Paracetamol every 6 hours and honey with lemon. Helps a bit.
01:21 Clinician: Any allergies to medicines?
01:23 Patient: No allergies.
01:25 Clinician: Any medical problems or regular medicines? Inhalers, tablets, anything like that?
01:30 Patient: Mild asthma—blue inhaler a few times a year, not used it this week. Otherwise healthy.
01:36 Clinician: Anyone around you unwell—work or home? Have you travelled recently?
01:40 Patient: My son had a cold last week. I'm a teacher so lots of colds around. No recent travel.
01:46 Clinician: Do you smoke or vape? Alcohol in a typical week?
01:49 Patient: Non‑smoker. I might have a glass of wine once or twice a week.
01:53 Clinician: What are your main concerns today—anything you're worried we might miss, and what were you hoping for from the appointment?
02:00 Patient: I'm worried it could be strep throat or even pneumonia. I was wondering if I need antibiotics because I'm back in the classroom tomorrow.
02:09 Clinician: Thanks—that's helpful. We'll check you over, talk about when antibiotics help, and make a plan for school. I'll examine your ears, throat, glands and chest. Is that okay?
02:18 Patient: Yes, that's fine.
02:20 Clinician: Before I examine you—any history of rheumatic fever, immune problems, or recent contact with scarlet fever?
02:26 Patient: No.
02:28 Clinician: Alright, I'll take your observations first.
02:30 Other: [Hands washed, PPE used. Taking temperature, pulse, blood pressure and oxygen saturation.]
02:46 Clinician: Temperature 37.7°C, pulse 88 and regular, blood pressure 128 over 78, oxygen saturations 98% on room air, respiratory rate 14.
02:58 Clinician: I'll examine your throat, ears and neck now.
03:00 Other: [Oropharyngeal exam and otoscopy performed.]
03:10 Clinician: Throat looks red, tonsils mildly swollen with no pus or white spots. Uvula central. A few small tender glands at the front of the neck.
03:20 Clinician: I'll listen to your chest.
03:22 Other: [Chest examined—inspection, percussion and auscultation.]
03:30 Clinician: Chest is clear—no wheeze or crackles. No signs of pneumonia.
03:35 Patient: Okay, that's good.
03:37 Clinician: I'll also check your nose and sinuses.
03:39 Other: [Anterior rhinoscopy and sinus palpation.]
03:46 Clinician: Nasal lining is swollen and a bit pale with clear discharge; mild tenderness over the cheeks—common with a cold.
03:54 Clinician: Let me summarise: three days of sore throat, blocked nose and cough; low‑grade fever yesterday; your observations are reassuring and chest is clear. Overall this fits a **viral upper respiratory infection**.
04:09 Patient: So not strep then?
04:11 Clinician: Strep throat usually has higher fever, no cough, and pus on the tonsils. We can score it—on the Centor/FeverPAIN system your score is low, so antibiotics wouldn't help and could cause side effects.
04:25 Patient: That makes sense. What can I do to get better quicker?
04:28 Clinician: Best evidence is supportive care: regular paracetamol or ibuprofen if you can take it, fluids, rest, warm drinks with honey, and saline or menthol steam for the nose. A decongestant spray can help for up to 3–5 days—avoid longer to prevent rebound congestion.
04:48 Patient: Can I use throat lozenges?
04:50 Clinician: Yes. Salt‑water gargles or anaesthetic lozenges can ease the soreness briefly.
04:55 Patient: Do I need a COVID test?
04:57 Clinician: Not routinely if you're otherwise well and symptoms are consistent with a cold. If you later develop high fever or new loss of taste/smell you could test, but it isn't necessary now.
05:09 Clinician: I'll give you a short information leaflet with self‑care and warning signs. Would you like a work note or are you okay to work if you feel up to it?
05:17 Patient: If I'm fever‑free I'll go in tomorrow. Hand‑washing and tissues, I know the drill.
05:24 Clinician: Perfect. Keep hydrated and rest when you can.
05:27 Clinician: Any history of sinus problems, hay fever, or reflux that flares with colds?
05:32 Patient: I get hay fever in summer but nothing at the moment.
05:36 Clinician: Thanks. I'll just check your asthma—the blue inhaler hasn't been needed? Any wheeze with this illness?
05:42 Patient: No wheeze and I haven't used it.
05:45 Clinician: Great. If the cough becomes tight or wheezy, you can use it as needed.
05:50 Clinician: I'll run through safety‑netting now so you know when to seek help:
05:53 Clinician: — If breathing becomes difficult, chest pain develops, you cough blood, you feel confused, or the fever persists beyond five days, seek urgent care.
06:07 Clinician: — If you're not improving after about a week to ten days, or symptoms worsen, contact us for review.
06:16 Patient: Okay, I'll keep an eye on those.
06:19 Clinician: How are symptoms affecting sleep and eating? Any dehydration—dry mouth, passing less urine?
06:25 Patient: Sleep was rough last night. I'm drinking okay and peeing normally.
06:30 Clinician: Good. Try to keep sipping fluids—warm drinks can soothe the throat. You can alternate paracetamol and ibuprofen if needed and tolerated.
06:40 Patient: What about antibiotics just in case, for work?
06:43 Clinician: Understandable, but antibiotics don't reduce the duration of viral colds, and they can cause side effects and resistance. If you developed features of bacterial tonsillitis we'd reassess.
06:55 Patient: Fair enough.
06:57 Clinician: Do you have any upcoming travel or anyone vulnerable at home—pregnant, elderly, or immunocompromised?
07:03 Patient: My dad has COPD but I won't see him until I'm better.
07:07 Clinician: That's sensible—hand hygiene and tissues reduce spread.
07:10 Clinician: I'll note your scores: FeverPAIN 1/5 (fever yesterday only), Centor 0–1 (cough present, no pus, tender nodes mild). That supports no antibiotics.
07:23 Patient: Good to know. How long will the cough last?
07:26 Clinician: The sore throat often settles in 3–5 days; the cough and congestion can linger up to 2–3 weeks but should gradually improve. Clear phlegm is common; seek help if it turns dark with breathlessness or chest pain.
07:41 Patient: If my nose stays blocked, can I use a nasal steroid?
07:44 Clinician: You can use saline irrigation first; if congestion persists beyond 10–14 days we can consider a steroid spray, but most colds resolve without it.
07:54 Patient: Got it.
07:56 Clinician: Any questions about ibuprofen—stomach ulcers, kidney problems, or other reasons you shouldn't take it?
08:02 Patient: No, I'm fine with ibuprofen.
08:05 Clinician: Okay—take with food. For dosing: paracetamol up to 1 gram four‑times‑daily; ibuprofen 200–400 mg three‑times‑daily if needed, maximum as per the box. Don't take cold remedies that duplicate paracetamol.
08:22 Patient: I'll check the labels.
08:24 Clinician: I'll send the information and your summary to the patient app now.
08:27 Other: [Summary and self‑care leaflet sent via patient app; printed copy offered.]
08:34 Clinician: Let me re‑check your throat comfort after a sip of water.
08:36 Other: [Patient drinks water.]
08:39 Patient: Still scratchy but okay.
08:41 Clinician: Try warm liquids and avoid smoking or vaping; steam from a shower can help loosen mucus.
08:49 Patient: I don't smoke, so that's easy.
08:52 Clinician: Great. I'll document that we've discussed return to work when you feel well enough and fever‑free for 24 hours.
08:59 Patient: Thanks.
09:01 Clinician: If you need a brief fit note, let me know via the app; for now self‑certification should be fine.
09:07 Patient: Okay.
09:09 Clinician: Just to confirm—no rash, no severe ear pain, and you're keeping fluids down?
09:13 Patient: Yes to all of that.
09:16 Clinician: Excellent.
09:18 Clinician: I'll quickly check your oxygen again after talking.
09:21 Other: [Pulse oximetry re‑checked.]
09:24 Clinician: Still 98% on air, which is normal.
09:27 Patient: Good to hear.
09:29 Clinician: I'll wrap up: today's findings fit a viral upper respiratory tract infection; no signs of pneumonia or severe tonsillitis. Self‑care and safety‑net discussed; no antibiotics indicated.
09:43 Patient: Okay, I'm reassured.
09:45 Clinician: Any other questions before we finish?
09:47 Patient: No, that's everything. Thank you.
09:50 Clinician: You're very welcome. I'll be here if things change—send a message if you're not improving by day 7 to 10 or sooner if you're worried.`,
    summary: `**Patient:** Alex Jones, DOB: 12/03/1989

**Chief Complaint:** Upper respiratory tract symptoms for 3 days

**History of Presenting Complaint:**
- 3-day history of sore throat, blocked nose, and cough
- Cough initially dry, now productive of clear sputum
- Subjective fever and chills yesterday evening with night sweats
- Facial heaviness (sinus symptoms)
- Sore throat manageable, no dysphagia or voice changes
- No loss of taste/smell, no GI symptoms
- Current treatment: Paracetamol 6-hourly, honey with lemon

**Past Medical History:**
- Mild asthma (salbutamol inhaler PRN, not used recently)
- NKDA

**Social History:**
- Teacher, non-smoker, minimal alcohol (1-2 glasses wine/week)
- Recent exposure: Son had cold last week, work environment

**Patient Concerns:**
- Worried about strep throat or pneumonia
- Needs to return to work (teaching)

**Examination:**
- Observations: T 37.7°C, HR 88 reg, BP 128/78, O2 sats 98% RA, RR 14
- Throat: Erythematous, tonsils mildly swollen, no exudate, uvula central
- Neck: Small tender anterior cervical lymph nodes
- Chest: Clear to auscultation, no wheeze or crackles
- ENT: Swollen pale nasal mucosa with clear discharge, mild sinus tenderness

**Clinical Scores:**
- FeverPAIN: 1/5 (fever yesterday only)
- Centor: 0-1 (cough present, no exudate, mild lymphadenopathy)

**Assessment:**
Viral upper respiratory tract infection (common cold)
Low probability of streptococcal pharyngitis

**Management:**
- Symptomatic treatment: Paracetamol/ibuprofen (with food)
- Supportive care: Rest, fluids, warm drinks with honey
- Nasal decongestant spray (maximum 3-5 days)
- Throat lozenges/salt water gargles
- Return to work when fever-free for 24 hours
- No antibiotics indicated

**Safety Netting:**
- Seek urgent care if: breathing difficulties, chest pain, haemoptysis, confusion, persistent fever >5 days
- Review if not improving by 7-10 days or symptoms worsen
- Information leaflet and patient app summary provided`,
    patientCopy: `Hi Alex, you have a viral upper respiratory tract infection (common cold). Take paracetamol or ibuprofen, rest, drink fluids, and use throat lozenges. Return to work when fever-free for 24 hours. Contact us if symptoms worsen or persist beyond 7-10 days, or if you develop breathing difficulties.`,
    aiReview: `**Consultation Review and Analysis**

The consultation regarding the patient with symptoms of an upper respiratory tract infection (URTI) was generally well-conducted. However, there are areas for improvement in history taking, examination, and management plan.

**Areas of Strength:**
1. **Systematic History Taking:** Good progression through key symptoms including timeline, character of cough, and associated symptoms
2. **Appropriate Examination:** Focused examination of throat, lymph nodes, and chest auscultation
3. **Clear Explanation:** Well-explained diagnosis and rationale for viral vs bacterial infection
4. **Appropriate Management:** Correct advice about antibiotics not being indicated
5. **Safety Netting:** Good advice about when to return if symptoms worsen

**Areas for Improvement:**

**History Taking:**
1. **Past Medical History:** No exploration of relevant PMH (asthma, COPD, immunocompromise)
2. **Drug History:** Only asked about current medications for symptoms, not regular medications or allergies
3. **Social History:** No inquiry about smoking status, alcohol, or occupational factors
4. **Fever Assessment:** Should have taken temperature reading rather than relying on subjective report

**Examination:**
1. **Vital Signs:** Temperature, blood pressure, pulse, and respiratory rate not documented
2. **ENT Examination:** Could have examined ears (otoscopy) as part of URTI assessment

**Management:**
1. **Symptom Relief:** Could have suggested nasal decongestants for blocked nose
2. **Sick Note:** Patient asked about work - should have offered sick note documentation

**Learning Points:**
1. Always document vital signs, especially temperature in febrile illness
2. Complete medication and allergy history is essential
3. Consider wider differential diagnosis (streptococcal pharyngitis screening)
4. More structured approach to safety netting with specific timeframes

**Overall Assessment:** Competent management of a common condition with room for more comprehensive assessment and documentation.`,
    referralNeeded: false
  },
  {
    id: "chest-pain-example",
    title: "Chest Pain Assessment",
    type: "Acute Assessment",
    duration: "12:45",
    transcript: `Doctor: Good afternoon, Mr. Smith. I understand you've come in with chest pain. Can you tell me about it?

Patient: Yes, Doctor. I started getting this chest pain about two hours ago. It came on quite suddenly while I was walking to the shops.

Doctor: Can you describe the pain for me? What does it feel like?

Patient: It's a heavy, crushing feeling right in the center of my chest. It feels like someone's sitting on my chest.

Doctor: That sounds concerning. Does the pain go anywhere else?

Patient: Yes, it seems to go up into my neck and down my left arm. My jaw feels a bit uncomfortable too.

Doctor: On a scale of 1 to 10, how would you rate the pain?

Patient: I'd say it's about a 7 out of 10. It's quite bad.

Doctor: Have you had chest pain like this before?

Patient: Never like this. I've had some mild chest discomfort when I've been rushing around, but nothing this severe.

Doctor: Tell me about that previous discomfort. When did that happen?

Patient: Well, maybe in the last month or two, if I'm walking quickly or going upstairs, I sometimes get a bit of tightness across my chest. But it goes away when I rest.

Doctor: How long does it take to go away when you rest?

Patient: Usually just a minute or two. But this pain today hasn't gone away at all, even though I'm sitting here.

Doctor: Are you getting any other symptoms with the chest pain? Shortness of breath, nausea, sweating?

Patient: Yes, I do feel a bit sick, and I noticed I was sweating when the pain started. I'm not really short of breath though.

Doctor: Do you have any medical conditions that I should know about?

Patient: I have high blood pressure, and my cholesterol was a bit high last time it was checked. I take ramipril for the blood pressure.

Doctor: Do you smoke?

Patient: I used to smoke heavily - about 20 a day for 30 years. I stopped about 5 years ago.

Doctor: Any family history of heart problems?

Patient: My father had a heart attack when he was 55. My brother had heart bypass surgery a few years back.

Doctor: I need to examine you now. Let me check your pulse and blood pressure first... Your pulse is regular but a bit fast at 95. Your blood pressure is 150 over 90, which is a bit high. Let me listen to your heart and lungs... I can hear your heart clearly, and your lungs sound clear.

Patient: What do you think it could be, Doctor?

Doctor: Given your symptoms, your risk factors, and the nature of this pain, I'm concerned this could be related to your heart. We need to take this very seriously and get some tests done urgently.

Patient: Do you think I'm having a heart attack?

Doctor: It's possible, and we can't rule it out based on the examination alone. The good news is that we can do tests to find out exactly what's happening. I'm going to arrange for you to go to the hospital immediately for an ECG and some blood tests.

Patient: Should I be worried?

Doctor: I want you to take this seriously, but please don't panic. We're going to get you the right care. I'm calling an ambulance now to take you to the emergency department. They'll be able to do all the necessary tests and provide the appropriate treatment.

Doctor: While we're waiting for the ambulance, I'm going to give you an aspirin to chew. This can help if this is heart-related. Are you allergic to aspirin?

Patient: No, I don't think so.

Doctor: Good. Here's a 300mg aspirin. Please chew it and swallow it. The ambulance should be here within 10 minutes. Try to stay calm, and don't exert yourself.

Patient: Thank you, Doctor. I'm glad I came in when I did.

Doctor: You absolutely did the right thing. Chest pain like this should always be checked urgently.`,
    summary: `**Chief Complaint:** Acute onset chest pain, 2 hours duration

**History of Presenting Complaint:**
- Sudden onset central chest pain 2 hours ago while walking
- Heavy, crushing sensation with radiation to neck, left arm, and jaw
- Severity: 7/10
- Associated nausea and sweating
- No relief with rest
- Recent history of exertional chest tightness (1-2 months) relieving with rest in 1-2 minutes

**Risk Factors:**
- Male, Hypertension (on ramipril), Hypercholesterolemia
- Ex-smoker (20/day for 30 years, stopped 5 years ago)
- Strong family history (father MI at 55, brother CABG)

**Examination:**
- Pulse: 95 bpm, regular, BP: 150/90 mmHg
- Heart sounds: Normal, Lung fields: Clear

**Assessment:**
Acute coronary syndrome - possible STEMI/NSTEMI
High clinical suspicion based on typical symptoms, risk factors, and presentation

**Immediate Management:**
- Aspirin 300mg chewed and swallowed
- Urgent ambulance transfer to Emergency Department
- ECG and troponin levels required`,
    patientCopy: `Mr. Smith, you have chest pain that needs urgent hospital assessment. We've given you aspirin and called an ambulance. This is precautionary to rule out heart problems.`,
    aiReview: `**Consultation Review: Acute Chest Pain Assessment**

**Summary:** This consultation demonstrates excellent recognition and management of potential acute coronary syndrome. The GP appropriately identified high-risk features and initiated urgent care pathways.

**Areas of Excellence:**
1. **History Taking:** Systematic assessment of pain characteristics, appropriate exploration of timeline and precipitating factors, good assessment of associated symptoms
2. **Clinical Decision Making:** Excellent risk stratification based on presentation, appropriate level of concern for symptoms and risk factors
3. **Emergency Management:** Prompt administration of aspirin 300mg, immediate ambulance request, appropriate advice about activity restriction

**Areas for Enhancement:**
1. **Additional History:** Could have asked about duration of previous exertional symptoms more specifically, medication adherence and current cholesterol levels
2. **Examination:** Could have documented respiratory rate and oxygen saturation, assessment for signs of heart failure

**Clinical Reasoning Analysis:**
✓ Acute coronary syndrome (primary concern) - Given the risk factors and classical presentation
✓ Typical cardiac pain radiation pattern identified
✓ Associated autonomic symptoms (nausea, sweating)
✓ Multiple cardiovascular risk factors
✓ Pain not relieved by rest

**Management Excellence:**
1. **Immediate Care:** Appropriate aspirin administration
2. **Referral Pathway:** Correct use of emergency services
3. **Communication:** Clear explanation without causing panic

**Overall Assessment:** Excellent management of a high-risk presentation with appropriate urgency and clinical decision-making.`,
    referralNeeded: true,
    referralLetter: `Dear Emergency Medicine Colleague,

Re: Mr. James Smith, DOB: [DOB], NHS: [NHS Number]

I am referring this 58-year-old gentleman with acute onset chest pain for urgent assessment.

Mr. Smith presented with sudden onset central crushing chest pain occurring 2 hours ago while walking. The pain radiates to neck, left arm and jaw, rated 7/10 severity, with associated nausea and sweating. Significantly, the pain has not resolved with rest.

Relevant risk factors include:
- Hypertension (on ramipril), Hypercholesterolemia  
- Ex-smoker (20/day × 30 years, ceased 5 years ago)
- Strong family history (father MI age 55, brother previous CABG)

Examination: BP 150/90, pulse 95 regular, heart sounds normal, clear lung fields.

I have administered aspirin 300mg and arranged emergency ambulance transfer. Given the clinical presentation and risk factor profile, I have high suspicion for acute coronary syndrome requiring urgent ECG and troponin assessment.

Thank you for your urgent assessment.

Yours sincerely,
Dr. [Name]`
  },
  {
    id: "depression-review",
    title: "Depression Follow-up Review",
    type: "Mental Health",
    duration: "15:20",
    transcript: `Doctor: Good morning, Sarah. How have you been since we last spoke?

Patient: Hi Doctor. I've been... well, some days are better than others. I think the medication is helping a bit, but I still have really difficult days.

Doctor: You've been on the sertraline for about 6 weeks now, is that right?

Patient: Yes, that's right. I started on the 50mg dose you prescribed.

Doctor: And how are you finding it? Any side effects?

Patient: The first couple of weeks were quite hard. I felt quite sick, especially in the mornings, and I had some headaches. But that's mostly settled down now.

Doctor: That's good - those early side effects are quite common and usually do settle. How's your mood been overall?

Patient: I think it's a bit better. I'm not crying every day like I was before. But I still feel quite low most of the time, and I'm struggling to enjoy things I used to like.

Doctor: Are you still having trouble with sleep?

Patient: Yes, that's still a big problem. I find it really hard to get to sleep, and then I wake up at about 4 AM and can't get back to sleep. I feel exhausted all the time.

Doctor: How's your appetite been?

Patient: Still not great. I have to force myself to eat most of the time. I've probably lost a bit more weight.

Doctor: And your energy levels?

Patient: Very low. Everything feels like such an effort. Even getting dressed in the morning feels overwhelming some days.

Doctor: How are you managing with work?

Patient: I'm still signed off. I know I need to think about going back, but I just don't feel ready. The thought of facing everyone and trying to concentrate for a whole day feels impossible right now.

Doctor: That's understandable. There's no rush - we need to make sure you're feeling stronger before you think about returning. Are you still having those negative thoughts about yourself?

Patient: Yes, quite a lot. I keep thinking that I'm useless, that I'm letting everyone down. Sometimes I think my family would be better off without me.

Doctor: When you say better off without you, what do you mean by that?

Patient: I just feel like such a burden. My husband is doing everything - looking after the kids, all the housework. I feel like I'm not contributing anything.

Doctor: Have you had any thoughts about hurting yourself or ending your life?

Patient: I... sometimes I think about it. Not about actually doing anything, but just that it would be easier if I wasn't here. But I wouldn't do anything because of the children.

Doctor: I'm glad you feel you can tell me about these thoughts, and it's good that the children are a protective factor for you. How often are you having these thoughts?

Patient: Maybe a few times a week. Usually when I'm lying awake at night feeling really low.

Doctor: Are you still seeing the counselor we arranged?

Patient: Yes, I see Emma every two weeks. She's really nice and it does help to talk to someone, but I still feel like I'm not making much progress.

Doctor: These things do take time, Sarah. You've been through a very difficult period. How's your support at home?

Patient: My husband is amazing, really patient. But I worry I'm wearing him down. My mum comes over quite a bit to help with the kids, which is good.

Doctor: That sounds like you have good support around you. Now, in terms of the medication, since you're still having significant symptoms after 6 weeks, I think we should consider increasing the dose of sertraline.

Patient: Is that safe? I was worried about increasing it.

Doctor: Yes, it's quite safe. We can increase it to 100mg daily. You might get some mild side effects again for a few days, but they should settle quickly since you've already adjusted to the medication.

Patient: Okay, if you think it will help.

Doctor: I do think it's worth trying. We should give it another 4-6 weeks at the higher dose to see how you respond. I'd also like to see you again in two weeks to check how you're getting on.

Patient: Yes, that would be good.

Doctor: In the meantime, are you managing to do any of the things we discussed before - going for walks, trying to maintain some routine?

Patient: I am trying. I manage a short walk most days, usually just to the local shop. And I'm trying to get up at the same time each day, even though I feel awful.

Doctor: That's really good. Those small steps are important. Is there anything else that's worrying you or that you'd like to discuss today?

Patient: I just want to know when I might start feeling normal again. It's been three months now since this all started.

Doctor: I understand that's frustrating. Depression can take time to resolve, but you are making progress, even if it doesn't always feel like it. With the medication increase and continued counseling, I'm hopeful you'll start to feel more like yourself over the coming weeks.

Patient: Thank you, Doctor. I appreciate you being so patient with me.

Doctor: That's what I'm here for. Remember, if you're having more frequent thoughts about harming yourself, or if you feel you can't keep yourself safe, please don't hesitate to contact us immediately, okay?

Patient: Yes, I will. Thank you.`,
    summary: `**Follow-up Review: Major Depression**

**Current Treatment:**
- Sertraline 50mg daily for 6 weeks
- Fortnightly counseling sessions

**Progress Assessment:**
- Partial response to sertraline
- Initial side effects (nausea, headaches) resolved
- Reduced frequency of crying episodes
- Sleep disturbance persists (initial and middle insomnia)
- Poor appetite with continued weight loss
- Low energy and motivation
- Still signed off work

**Mental State Examination:**
- Mood: Low but stable
- Anhedonia present
- Negative cognitions about self-worth
- Passive suicidal ideation (few times per week, protective factors present)
- No active plans or intent to self-harm
- Insight maintained

**Support Systems:**
- Good family support (husband and mother)
- Engaging with counseling
- Maintaining some daily activities

**Management Plan:**
- Increase sertraline to 100mg daily
- Continue counseling
- Review in 2 weeks
- Safety netting regarding suicidal thoughts
- Continue gradual behavioral activation
- Maintain daily routine
- Work return planning deferred

**Risk Assessment:** Moderate risk - passive suicidal ideation with protective factors, good insight, engaged with treatment`,
    patientCopy: `Sarah, we're increasing your antidepressant to 100mg as you're showing some improvement. Continue counseling and daily walks. Contact us immediately if you feel unsafe.`,
    aiReview: `**Mental Health Consultation Review: Depression Follow-up**

**Overall Assessment:** This consultation demonstrates good practice in depression management with appropriate follow-up, risk assessment, and treatment adjustment.

**Strengths Demonstrated:**
1. **Systematic Review:** Comprehensive assessment of medication response and side effects, detailed exploration of mood symptoms and functional impact
2. **Risk Assessment:** Appropriate screening for suicidal ideation, good follow-up questions about passive thoughts, identification of protective factors
3. **Treatment Management:** Evidence-based decision to increase sertraline dose, appropriate timing for dose adjustment (6 weeks)
4. **Psychosocial Assessment:** Good exploration of support systems, assessment of counseling engagement

**Areas for Enhancement:**
1. **Structured Assessment Tools:** Could have used PHQ-9 or GAD-7 scores for objective measurement
2. **Safety Planning:** While risk assessment was good, could have developed more detailed safety plan
3. **Medication Counseling:** Could have discussed expected timeline for improvement at higher dose

**Clinical Decision Making Analysis:**
✓ Sertraline dose increase after 6 weeks partial response
✓ Continued psychological therapy
✓ Regular follow-up scheduling
✓ Deferring work return until more stable

**Evidence-Based Practice:**
- Follows NICE guidelines for depression management
- Appropriate use of combination therapy (medication + psychological)
- Correct timing for treatment review and adjustment

**Communication Skills:**
- Empathetic and non-judgmental approach
- Good use of open questions
- Appropriate normalization of patient concerns

**Overall Grade:** Well-conducted consultation with good clinical reasoning and patient care.`,
    referralNeeded: false
  },
  {
    id: "diabetes-review",
    title: "Type 2 Diabetes Annual Review",
    type: "Chronic Disease Management",
    duration: "18:30",
    transcript: `Doctor: Good morning, Mr. Patel. Come in and have a seat. How have you been getting on since your last diabetes review?

Patient: Good morning, Doctor. I think I've been doing quite well, actually. I've been trying hard to follow all the advice you gave me last time.

Doctor: That's great to hear. Let's go through your results from the blood tests we did last week. Your HbA1c has come down to 58 mmol/mol, which is a really good improvement from 68 six months ago.

Patient: Oh, that's good news! I was worried about that.

Doctor: Yes, it shows that the changes you've made are really working. How have you been getting on with your diet?

Patient: I've been much more careful. My wife has been helping me a lot with meal planning. We've cut down on rice and bread, and I'm eating more vegetables and salad with every meal.

Doctor: Excellent. And how about your weight? Have you noticed any changes?

Patient: Yes, I've lost about 8 kilograms since we last met. I feel much better for it, actually. My clothes are looser and I have more energy.

Doctor: That's fantastic - 8kg is a significant achievement. How have you managed to lose the weight?

Patient: Mainly the diet changes, and I've been walking every morning before work. About 30 minutes, sometimes longer at weekends.

Doctor: That's wonderful. Regular exercise is so important for diabetes control. How are you finding the metformin? Any problems with side effects?

Patient: The stomach upset I had when I first started has completely gone away. I take it with food like you suggested, and I have no problems now.

Doctor: Good. Your kidney function tests are normal, so you're tolerating the metformin well. How are you getting on with testing your blood sugars?

Patient: I've been testing every morning before breakfast, and sometimes before dinner if I remember. The morning readings are usually between 6 and 8, which I think is okay?

Patient: Sometimes I get worried when it's higher than 8. Is that bad?

Doctor: Those levels sound reasonable. Ideally, we like to see morning readings between 4 and 7, but 6 to 8 is not concerning. What matters most is the overall pattern and your HbA1c, which as we discussed, has improved significantly.

Doctor: Let me check your blood pressure and examine your feet today. Your blood pressure is 135 over 82, which is a bit high. Have you been taking your ramipril regularly?

Patient: Yes, every morning with breakfast. I haven't missed any doses.

Doctor: We might need to increase that slightly. Let me examine your feet now. Are you checking your feet regularly at home?

Patient: My wife helps me check them. We look for any cuts or sores like you told us.

Doctor: Good. I can see you're taking good care of them - no problems that I can see. Your circulation looks good and the sensation is normal. Have you had your eyes checked this year?

Patient: Yes, I went to the optician about 3 months ago. They said everything was fine and to come back next year.

Doctor: Excellent. Now, I see from your notes that your cholesterol was a bit high last time. The results this time show your total cholesterol is 4.8, which is much better than the 6.2 it was before.

Patient: I've been taking the statin tablets you prescribed. I was a bit worried about side effects, but I haven't had any problems.

Doctor: That's good. The statin is helping to protect your heart and blood vessels. Given your diabetes, it's important to keep your cholesterol well controlled.

Patient: Doctor, I've been reading about diabetes online, and I'm worried about complications. Will I definitely get problems with my eyes or kidneys?

Doctor: I understand your concern - it's natural to worry. The good news is that you're doing everything right to prevent complications. With good blood sugar control, regular check-ups, and healthy lifestyle choices, many people with diabetes live long, healthy lives without serious complications.

Patient: That's reassuring. Is there anything else I should be doing?

Doctor: You're doing brilliantly. I'd like to increase your ramipril slightly to help with your blood pressure - from 5mg to 7.5mg daily. We'll also book you for your annual flu vaccination, and you should have the COVID vaccination when offered.

Patient: Okay, I'm happy to do that.

Doctor: I'd also like to refer you to see the diabetes specialist nurse. She can provide additional education and support, and might be able to help you with more advanced blood sugar monitoring techniques.

Patient: That sounds helpful.

Doctor: Let's arrange to see you again in 6 months for another review. In the meantime, keep doing what you're doing - the diet, exercise, and medication compliance. If you have any concerns, particularly if you're unwell or your blood sugars are consistently high, please don't hesitate to contact us.

Patient: Thank you, Doctor. I feel much more positive about managing my diabetes now.

Doctor: You should feel positive - you've made excellent progress. Keep up the good work.`,
    summary: `**Type 2 Diabetes Annual Review**

**Current Medications:**
- Metformin (well tolerated)
- Ramipril 5mg daily (to be increased to 7.5mg)
- Statin therapy (well tolerated)

**Glycemic Control:**
- HbA1c: 58 mmol/mol (improved from 68 mmol/mol 6 months ago) - Target <58 achieved
- Self-monitoring: Morning glucose 6-8 mmol/L (mostly within acceptable range)
- Good understanding of targets and monitoring

**Lifestyle Modifications:**
- Weight loss: 8kg over 6 months
- Diet: Reduced carbohydrates, increased vegetables
- Exercise: Daily 30-minute walks
- Excellent medication adherence

**Annual Screening Completed:**
- Foot examination: Normal circulation and sensation, no ulcers or deformities
- Blood pressure: 135/82 mmHg (slightly elevated)
- Renal function: Normal
- Lipid profile: Total cholesterol 4.8 mmol/L (improved from 6.2)
- Eye screening: Completed 3 months ago - normal

**Assessment:**
Well-controlled Type 2 diabetes with excellent patient engagement and significant improvement in all parameters

**Management Plan:**
- Increase ramipril to 7.5mg daily for BP optimization
- Continue current diabetes management
- Diabetes specialist nurse referral for enhanced education
- Annual vaccinations (flu, COVID)
- 6-month follow-up review
- Continue current lifestyle modifications

**Targets Met:**
✓ HbA1c <58 mmol/mol
✓ Weight reduction achieved
✓ Annual screening completed
- BP requires optimization (<130/80)`,
    patientCopy: `Mr. Patel, excellent diabetes control! HbA1c improved to 58. Continue current diet and exercise. Increase blood pressure tablet slightly. See diabetes nurse for extra support.`,
    aiReview: `**Diabetes Annual Review - Consultation Analysis**

**Overall Assessment:** Exemplary diabetes consultation demonstrating comprehensive annual review with excellent patient engagement and clinical outcomes.

**Outstanding Practice Areas:**
1. **Structured Annual Review:** Systematic review of all diabetes-related parameters, comprehensive screening completion, assessment of medication tolerance
2. **Patient-Centered Communication:** Celebrated patient achievements, addressed patient concerns about complications, provided reassurance based on current good control
3. **Evidence-Based Management:** Appropriate HbA1c target achievement, correct blood pressure management, appropriate statin therapy for cardiovascular protection
4. **Preventive Care Integration:** Vaccination planning, specialist nurse referral for enhanced education, appropriate screening intervals maintained

**Areas of Excellence:**
**Clinical Skills:** Thorough physical examination, appropriate interpretation of investigations, risk stratification and management
**Consultation Skills:** Motivational interviewing techniques, positive reinforcement of behavior change, collaborative care planning

**Clinical Decision Making Analysis:**
✓ HbA1c target appropriately individualized
✓ ACE inhibitor dose increase for BP optimization
✓ Specialist nurse referral for enhanced support
✓ Appropriate follow-up interval (6 months)

**Risk Management:** Good assessment of cardiovascular risk factors, appropriate screening for complications, medication safety monitoring

**Quality Indicators Met:**
✓ Annual HbA1c monitoring ✓ Annual foot screening ✓ Annual eye screening ✓ Annual renal function monitoring ✓ Lipid management ✓ Blood pressure monitoring ✓ Medication review

**Overall Grade:** Exceptional diabetes care demonstrating comprehensive clinical knowledge, excellent communication skills, and patient-centered approach.`,
    referralNeeded: true,
    referralLetter: `Dear Diabetes Specialist Nurse,

Re: Mr. Rajesh Patel, DOB: [DOB], NHS: [NHS Number]

I would like to refer this 52-year-old gentleman with Type 2 diabetes for additional education and support.

Mr. Patel has made excellent progress with his diabetes management over the past 6 months, achieving significant improvements in glycemic control (HbA1c decreased from 68 to 58 mmol/mol) and substantial weight loss (8kg).

Current management:
- Metformin (well tolerated)
- Ramipril (increasing to 7.5mg for BP optimization)
- Statin therapy
- Self-monitoring blood glucose

He would benefit from:
- Enhanced education about diabetes self-management
- Advanced blood glucose monitoring techniques
- Continued lifestyle support and goal setting
- Sick day management guidance

Mr. Patel is highly motivated and engaged with his care. His wife is very supportive of his management plan.

Thank you for seeing this gentleman who exemplifies successful diabetes self-management.

Yours sincerely,
Dr. [Name]`
  },
  {
    id: "child-fever",
    title: "Child with Fever - Parent Consultation",
    type: "Pediatric Assessment",
    duration: "10:45",
    transcript: `Doctor: Good afternoon. Please come in and have a seat. You've brought Emily in today - what's been concerning you?

Mother: Hello Doctor. Emily has had a fever since yesterday morning, and I'm quite worried about her. She's normally such a lively little girl, but she's been very clingy and not her usual self.

Doctor: I can understand your concern. How old is Emily now?

Mother: She's 18 months old.

Doctor: And when did you first notice she was unwell?

Mother: Yesterday morning when I went to get her up from her cot, she felt quite hot. I took her temperature and it was 38.5 degrees.

Doctor: Have you been monitoring her temperature since then?

Mother: Yes, I've been checking it regularly. It's been up and down - sometimes as high as 39.2, but when I give her Calpol it comes down to about 37.8.

Doctor: That's good that you're monitoring it and that it's responding to the paracetamol. How has she been eating and drinking?

Mother: She's not eaten much at all - just picked at some toast this morning. But she is still taking her milk and some water, which I know is important.

Doctor: You're absolutely right about the fluids being important. How many wet nappies has she had?

Mother: About the same as usual, I think. Maybe slightly fewer, but she's still weeing regularly.

Doctor: That's reassuring. Has she been vomiting at all?

Mother: No, no vomiting. She did have quite loose stools yesterday, but nothing today.

Doctor: Any rash that you've noticed?

Mother: No rash that I can see.

Doctor: How has her breathing been? Any coughing or difficulty breathing?

Mother: No cough, and her breathing seems normal to me.

Doctor: Any ear pulling or signs that her ears might be bothering her?

Mother: She has been touching her ears a bit, actually. More than usual.

Doctor: I see. And how has she been sleeping?

Mother: Last night was quite restless. She woke up several times, which isn't like her. She usually sleeps through the night.

Doctor: How has her mood been when the fever comes down with the paracetamol?

Mother: She perks up quite a bit, actually. Still not completely herself, but much more interactive. She'll play for a little while and smile.

Doctor: That's a very good sign. Now, let me examine Emily. How is she with strangers usually?

Mother: She can be a bit shy, but she's generally okay.

Doctor: Hello Emily. Let me have a little look at you. She does look a bit under the weather but she's alert and watching what I'm doing. Let me check her temperature first... 38.1 degrees, so mild fever at the moment. Let me look in her ears... Yes, I can see her right ear is quite red and bulging slightly. The left ear looks fine. Let me listen to her chest... Her breathing sounds clear, no wheeze or crackles. Let me check her throat... Throat looks fine, not red or inflamed.

Mother: So it's her ear that's the problem?

Doctor: Yes, Emily has an ear infection in her right ear. This is very common in children her age and would explain all her symptoms - the fever, being unsettled, poor appetite, and the ear touching.

Mother: Is it serious? Do I need to worry?

Doctor: Ear infections in children are usually not serious, but they can be quite uncomfortable, which is why she's been unsettled. The good news is that she's still drinking well, she's alert when her fever is down, and there are no signs of serious illness.

Mother: Does she need antibiotics?

Doctor: Let me explain the options. Many ear infections actually get better on their own within a few days. However, because Emily is under 2 years old and seems quite uncomfortable, I think antibiotics would be helpful in this case.

Mother: Okay, if you think that's best.

Doctor: I'm going to prescribe amoxicillin liquid for her. It's a 5-day course. Make sure you give her the full course even if she seems better before it's finished.

Mother: How much should I give her and how often?

Doctor: The pharmacy will give you clear instructions, but it's usually 2.5ml three times a day. Give it with food if possible as it can sometimes cause a bit of stomach upset.

Mother: What about the paracetamol? Should I continue with that?

Doctor: Yes, definitely continue with the paracetamol for the fever and pain. You can give her the children's paracetamol every 4-6 hours as needed. If she seems very uncomfortable, you can also give ibuprofen, but alternate it with the paracetamol rather than giving both at the same time.

Mother: When should she start feeling better?

Doctor: You should see some improvement within 24-48 hours of starting the antibiotics. The fever should start to settle, and she should become more comfortable.

Mother: When should I be worried and bring her back?

Doctor: You should bring her back if her fever gets worse or doesn't start to improve within 48 hours of starting antibiotics, if she becomes very drowsy or difficult to wake, if she develops a rash, or if she stops drinking fluids. Also, if you're just worried about how she seems, don't hesitate to bring her back.

Mother: Can she go to nursery?

Doctor: Keep her at home while she has a fever and for at least 24 hours after the fever has settled. Once she's feeling better and the fever has gone, she can return to nursery.

Mother: Thank you, Doctor. I feel much more reassured now.

Doctor: You did exactly the right thing bringing her in. You know Emily best, and you could tell she wasn't herself. Keep monitoring her, give the antibiotics as prescribed, and she should be back to her normal self soon.`,
    summary: `**Pediatric Consultation: 18-month-old with fever**

**Presenting Complaint:**
- 24-hour history of fever in 18-month-old girl
- Parent concerned about change in behavior and appetite

**History:**
- Fever onset yesterday morning
- Temperature range: 37.8-39.2°C, responsive to paracetamol
- Reduced oral intake (solids) but maintaining fluids
- Normal urine output
- One episode loose stool (resolved)
- Increased ear touching
- Disturbed sleep pattern
- Improvement in mood when fever controlled

**Examination:**
- Alert, responsive child
- Temperature: 38.1°C
- Right tympanic membrane: erythematous and bulging
- Left ear: normal
- Chest: clear to auscultation
- Throat: not inflamed
- No rash visible
- Good hydration status

**Assessment:**
Acute otitis media (right ear) in 18-month-old

**Management:**
- Amoxicillin suspension 5-day course (2.5ml TDS)
- Continue paracetamol PRN for fever/pain
- Ibuprofen as alternative/additional analgesia
- Safety netting provided
- Return to nursery when fever-free for 24 hours

**Follow-up:**
Return if no improvement within 48 hours, worsening symptoms, or parental concern

**Prognosis:** Excellent with appropriate treatment`,
    patientCopy: `Emily has an ear infection causing her fever. Give prescribed antibiotics for 5 days and continue paracetamol. She should improve within 1-2 days. Contact us if concerned.`,
    aiReview: `**Pediatric Consultation Review: Child with Fever**

**Overall Assessment:** Excellent pediatric consultation demonstrating appropriate clinical assessment, parent communication, and evidence-based management of acute otitis media.

**Areas of Excellence:**
1. **History Taking with Parent:** Systematic exploration of fever pattern and parental concerns, appropriate focus on fluid intake and output, good assessment of behavioral changes
2. **Clinical Examination:** Efficient but thorough examination approach, appropriate interaction with anxious toddler, systematic examination revealing clear diagnosis
3. **Parent Communication:** Acknowledged parental concerns and validated their decision to seek care, clear explanation of diagnosis in understandable terms
4. **Evidence-Based Management:** Appropriate antibiotic prescribing for <2-year-old with AOM, correct choice of first-line antibiotic

**Strengths in Pediatric Practice:**
**Safety Netting:** Comprehensive advice about when to return, specific timeframes for expected improvement, clear red flag symptoms identified
**Family-Centered Care:** Involved parent as expert on child's normal behavior, provided practical advice for home management
**Clinical Decision Making:** Appropriate use of antibiotics based on age and presentation, good balance between watchful waiting and active treatment

**Evidence-Based Practice Analysis:**
✓ Antibiotic use in <2-year-old with diagnosed AOM
✓ First-line antibiotic choice (amoxicillin)
✓ Appropriate analgesic recommendations
✓ Suitable follow-up advice

**NICE Guideline Compliance:**
- Follows guidelines for antibiotic prescribing in pediatric AOM
- Appropriate safety netting
- Correct advice about symptom duration and improvement

**Learning Points:**
1. Demonstrates importance of taking parental concerns seriously
2. Shows appropriate antibiotic stewardship in pediatrics
3. Excellent example of safety netting in vulnerable population
4. Good balance between examination efficiency and thoroughness

**Overall Grade:** Exemplary pediatric consultation demonstrating competent clinical skills, excellent communication, and appropriate management of common childhood illness.`,
    referralNeeded: false
  }
];

export const getExampleById = (id: string): ConsultationExample | undefined => {
  return consultationExamples.find(example => example.id === id);
};

export const getExamplesByType = (type: string): ConsultationExample[] => {
  return consultationExamples.filter(example => example.type === type);
};