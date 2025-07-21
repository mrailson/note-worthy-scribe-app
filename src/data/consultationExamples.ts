export interface ConsultationExample {
  id: string;
  title: string;
  type: string;
  description: string;
  transcript: string;
  expectedNotes: {
    gpSummary: string;
    fullNote: string;
    patientCopy: string;
    snomedCodes: string[];
  };
  traineeFeedback: string;
}

export const consultationExamples: ConsultationExample[] = [
  {
    id: "urti",
    title: "Upper Respiratory Tract Infection",
    type: "Acute Illness",
    description: "Common cold with 3-day history",
    transcript: `Doctor: Good morning, how can I help you today?

Patient: Hi doctor, I've been feeling quite unwell for the past 3 days. I've got a really bad cough and my throat is sore.

Doctor: I'm sorry to hear that. Can you tell me more about the cough - is it a dry cough or are you bringing anything up?

Patient: It's mostly dry, but sometimes I get a bit of clear phlegm. It's been keeping me awake at night.

Doctor: And the sore throat - when did that start?

Patient: That started about the same time, maybe 3 days ago. It's quite painful when I swallow.

Doctor: Have you had any fever?

Patient: Yes, I felt quite hot yesterday and the day before. I didn't take my temperature though.

Doctor: Any headache or body aches?

Patient: A bit of a headache, and I'm feeling quite tired and run down.

Doctor: Have you tried any treatments so far?

Patient: Just some throat lozenges from the pharmacy, but they're not helping much.

Doctor: Any difficulty breathing or chest pain?

Patient: No, nothing like that.

Doctor: Have you been around anyone else who's been unwell?

Patient: My colleague at work had something similar last week.

Doctor: Right, let me just have a look at your throat and chest. *examines patient* Your throat is red and inflamed, but I can't see any white patches or pus. Your chest sounds clear. Your temperature is 37.8 degrees.

Doctor: This looks like a viral upper respiratory tract infection - essentially a common cold. These usually resolve on their own within 7-10 days.

Patient: Do I need antibiotics?

Doctor: No, antibiotics won't help with a viral infection. I'd recommend paracetamol or ibuprofen for the aches and fever, plenty of fluids, and rest.

Doctor: You should start feeling better in a few days. If your symptoms worsen, if you develop difficulty breathing, or if you're not improving after 2 weeks, please come back to see us.

Patient: Thank you doctor. Should I stay off work?

Doctor: If you're feeling very unwell, it's fine to take a day or two off. Make sure you're well enough to work safely and try not to spread it to colleagues.`,
    expectedNotes: {
      gpSummary: "URTI, 3/7 history, viral, safety-netted, paracetamol/ibuprofen advised, self-limiting",
      fullNote: `History of Presenting Complaint:
3-day history of dry cough with occasional clear sputum, sore throat, subjective fever, headache, and fatigue. Symptoms started simultaneously. Contact with unwell colleague 1 week prior.

Examination:
Temperature 37.8°C
Throat: erythematous, no exudate
Chest: clear to auscultation
No respiratory distress

Assessment:
Viral upper respiratory tract infection (common cold)

Management:
- Symptomatic treatment with paracetamol/ibuprofen for fever and aches
- Adequate fluid intake and rest
- No antibiotics indicated (viral aetiology)

Safety Netting:
Return if symptoms worsen, difficulty breathing develops, or no improvement after 2 weeks

Advice:
Can return to work when feeling well enough, avoid spreading to colleagues`,
      patientCopy: `You have a common cold (viral upper respiratory tract infection).

What this means:
- Your symptoms are caused by a virus, not bacteria
- This is very common and will get better on its own

Treatment:
- Take paracetamol or ibuprofen for aches, pains and fever
- Drink plenty of fluids
- Get plenty of rest
- Throat lozenges may help soothe your throat

When to return:
- If you have difficulty breathing
- If your symptoms get much worse
- If you're not feeling better after 2 weeks

Work:
- You can return to work when you feel well enough
- Try to avoid spreading the infection to colleagues

Most people feel better within 7-10 days.`,
      snomedCodes: [
        "82272006 - Common cold",
        "54150009 - Upper respiratory tract infection",
        "422400008 - Vomiting",
        "386661006 - Fever"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Upper Respiratory Tract Infection**

**Excellent Practice Demonstrated:**
- Clear, systematic history-taking covering all key areas (onset, characteristics, associated symptoms)
- Appropriate red flag screening (breathing difficulties, chest pain)
- Good rapport building with empathetic opening
- Excellent explanation of viral vs bacterial infection to patient
- Appropriate antibiotic stewardship - well explained why not indicated
- Comprehensive safety netting advice provided

**Clinical Management:**
- Correct diagnosis of viral URTI with appropriate examination findings documented
- Evidence-based symptomatic treatment recommendations (paracetamol/ibuprofen)
- Appropriate advice regarding work and infection control

**Areas for Development:**
- Consider quantifying fever (asked about it but could have been more specific about duration and pattern)
- Could have briefly explored patient's understanding of their symptoms before examination
- Consider asking about immunization status (especially if elderly or at-risk patient)

**Patient Communication:**
- Excellent - patient clearly understood diagnosis, treatment plan, and when to return
- Good balance of reassurance while maintaining appropriate vigilance

**Learning Points:**
- This demonstrates good management of a common presentation
- Shows appropriate use of clinical time for straightforward conditions
- Excellent example of patient-centered care with clear communication

**Overall Assessment:** Very good consultation demonstrating safe, effective primary care practice. Ready for independent practice in managing similar presentations.

**Grade: Good** (would be suitable for CSA/OSCE pass)`
  },
  {
    id: "hypertension",
    title: "Hypertension Follow-up",
    type: "Chronic Disease Management", 
    description: "Routine blood pressure check with medication review",
    transcript: `Doctor: Good afternoon, Mr. Johnson. How have you been since your last visit?

Patient: Pretty good overall, doctor. I've been taking my blood pressure tablets as you prescribed.

Doctor: Excellent. Have you been monitoring your blood pressure at home?

Patient: Yes, I've been checking it most mornings. It's been around 140/85 most days.

Doctor: That's improved from last time. Any side effects from the amlodipine?

Patient: I noticed my ankles were a bit swollen for the first week or two, but that's settled down now.

Doctor: Good, that's a common side effect that often improves. How's your diet been?

Patient: I've been trying to cut down on salt like you suggested. My wife's been cooking differently.

Doctor: And exercise?

Patient: I've started walking for 20 minutes most days. Finding it easier now.

Doctor: Excellent. Any chest pain, shortness of breath, or dizziness?

Patient: No, nothing like that.

Doctor: Let me check your blood pressure today. *takes BP* That's 138/82, which is much better than the 165/95 we had last time.

Doctor: Your blood tests from last month showed everything was normal - kidney function, cholesterol levels all fine.

Patient: That's good to hear.

Doctor: I think we should continue with the amlodipine 5mg daily. The lifestyle changes you've made are really helping too.

Doctor: I'll see you again in 3 months for another check. Keep monitoring at home and if it goes consistently above 150/90, give us a call.

Patient: Should I be worried about anything?

Doctor: Your blood pressure is much better controlled now. The most important thing is to keep taking your medication regularly and maintain the healthy lifestyle changes.

Patient: Thank you doctor.`,
    expectedNotes: {
      gpSummary: "HTN f/u, BP 138/82 (improved), amlodipine 5mg continued, lifestyle advice reinforced, 3/12 review",
      fullNote: `Follow-up Consultation: Hypertension

History:
Patient reports good compliance with amlodipine 5mg daily. Home BP monitoring showing readings around 140/85. Initial ankle swelling resolved. Improved diet (reduced salt intake) and regular exercise (20 minutes walking daily). No symptoms of chest pain, SOB, or dizziness.

Examination:
BP: 138/82 (previous 165/95)
No peripheral oedema noted today

Review of Investigations:
Recent blood tests normal - U&Es, lipids within normal range

Assessment:
Essential hypertension - well controlled on current treatment

Plan:
- Continue amlodipine 5mg daily
- Continue lifestyle modifications (diet and exercise)
- Home BP monitoring
- Routine follow-up in 3 months

Safety Netting:
Contact surgery if home BP readings consistently >150/90`,
      patientCopy: `Your blood pressure check went well today.

Your blood pressure today: 138/82 (much improved from 165/95)

Current treatment:
- Continue taking amlodipine 5mg once daily
- Keep up the excellent work with diet changes (less salt)
- Continue your daily 20-minute walks

Home monitoring:
- Keep checking your blood pressure at home
- Contact us if readings are consistently above 150/90

Next appointment: 3 months

Your blood pressure is now much better controlled thanks to the medication and the lifestyle changes you've made. Keep up the good work!`,
      snomedCodes: [
        "38341003 - Essential hypertension", 
        "182836005 - Review of medication",
        "386536003 - Arterial pressure taking",
        "428119001 - Procedure involving blood pressure monitoring"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Hypertension Follow-up**

**Excellent Practice Demonstrated:**
- Well-structured chronic disease review with systematic approach
- Good medication compliance assessment and side effect monitoring
- Excellent lifestyle counseling reinforcement (diet, exercise)
- Appropriate use of home monitoring data to guide management
- Clear documentation of improvement and continued plan

**Clinical Management:**
- Correct decision to continue current therapy given excellent response
- Good safety netting with specific BP thresholds for patient contact
- Appropriate review interval (3 months) for stable hypertension

**Areas for Development:**
- Could have been more specific about ankle swelling assessment (examination findings not documented)
- Consider discussing cardiovascular risk reduction benefits in more detail
- Brief mention of blood test results but could expand on significance of normal kidney function

**Patient Communication:**
- Good reassurance about improvement while emphasizing importance of continued treatment
- Patient clearly understood ongoing management plan

**Learning Points:**
- Demonstrates good chronic disease management principles
- Shows appropriate shared decision making
- Good example of holistic care including lifestyle factors

**Overall Assessment:** Good systematic approach to chronic disease follow-up. Shows competency in ongoing management of stable hypertension.

**Grade: Good** (demonstrates safe independent practice)`
  },
  {
    id: "depression",
    title: "Depression Screening",
    type: "Mental Health",
    description: "Initial assessment for suspected depression",
    transcript: `Doctor: Hello Sarah, thank you for coming in today. I understand you wanted to discuss how you've been feeling recently?

Patient: Yes, I... I've been struggling quite a bit lately. I just don't feel like myself.

Doctor: I'm sorry to hear you're having a difficult time. Can you tell me more about how you've been feeling?

Patient: I just feel so low all the time. I wake up and I don't want to get out of bed. Everything feels like such an effort.

Doctor: How long have you been feeling like this?

Patient: It's been getting worse over the past couple of months, but I think it started after I lost my job about 4 months ago.

Doctor: That must have been a very stressful time for you. Are you sleeping alright?

Patient: Not really. I either can't get to sleep, or I wake up really early - like 4 or 5am - and then I can't get back to sleep.

Doctor: And how's your appetite been?

Patient: I'm just not interested in food anymore. I've probably lost about half a stone without trying.

Doctor: Are you still able to enjoy things that you used to enjoy?

Patient: No, not really. I used to love reading and going out with friends, but I just can't be bothered anymore. I've been canceling plans.

Doctor: Have you had any thoughts about harming yourself?

Patient: *pauses* Sometimes I think everyone would be better off without me, but I wouldn't actually do anything. I've got my children to think about.

Doctor: I'm glad you feel able to talk about this. Have you noticed any problems with concentration or memory?

Patient: Yes, I can't focus on anything. At work interviews, I just can't think clearly.

Doctor: Have you used alcohol or drugs to help cope?

Patient: I've been drinking a bit more wine in the evenings, but nothing excessive.

Doctor: Have you experienced anything like this before?

Patient: I had a difficult time after my mum died 5 years ago, but nothing quite like this.

Doctor: Based on what you've told me, it sounds like you're experiencing depression. This is a real medical condition and there are effective treatments available.

Patient: What happens now?

Doctor: I'd like to start you on some medication called sertraline, and I'm going to refer you to our counseling service. We'll also do some blood tests to rule out other causes.

Doctor: Most importantly, if you ever feel like you might harm yourself, please contact us immediately or go to A&E.`,
    expectedNotes: {
      gpSummary: "Depression 1st presentation, 2/12 duration, PHQ-9 likely severe, started sertraline 50mg, counseling referral, safety plan discussed",
      fullNote: `Presenting Complaint:
2-month history of low mood, anhedonia, early morning wakening, weight loss, poor concentration, social withdrawal.

History:
Onset 4 months ago following job loss, progressively worsening over past 2 months. Sleep disturbance (early morning wakening at 4-5am), reduced appetite with unintentional weight loss (~3.5kg), anhedonia, social isolation, poor concentration affecting job search. Passive suicidal ideation but protective factors (children). Increased alcohol consumption. Previous episode of low mood following bereavement 5 years ago.

Mental State Examination:
Appearance: kempt, appropriate
Mood: subjectively low, objectively depressed
Speech: reduced volume and pace
Thought: no formal thought disorder, passive suicidal ideation, no active plans
Perception: no abnormalities
Cognition: poor concentration, memory difficulties

Risk Assessment:
Low immediate suicide risk - passive ideation, strong protective factors (children)

Assessment:
Moderate to severe depressive episode

Plan:
- Sertraline 50mg daily
- Counseling referral
- Blood tests: FBC, U&E, LFTs, TFTs, B12, folate
- Safety netting: contact if suicidal thoughts worsen
- Review in 2 weeks

Education provided regarding depression and treatment options`,
      patientCopy: `You are experiencing depression, which is a common and treatable medical condition.

What we discussed:
- You have been feeling low, tired, and unable to enjoy activities for about 2 months
- This started after the stress of losing your job
- These feelings are not your fault

Treatment plan:
- Starting medication: Sertraline 50mg once daily (antidepressant)
- Referral for counseling/talking therapy
- Blood tests to check for other causes

Important safety information:
- If you ever feel like you might harm yourself, contact us immediately or go to A&E
- The medication may take 4-6 weeks to show full benefits
- Some people feel worse initially before feeling better

Follow-up:
- Appointment in 2 weeks to see how you're getting on
- Please contact us sooner if you're worried about anything

Remember: Depression is treatable and you can get better with the right support.`,
      snomedCodes: [
        "35489007 - Depressive disorder",
        "73867007 - Severe major depression",
        "44054006 - Type 2 diabetes mellitus",
        "182832007 - Sertraline therapy"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Depression Screening & Management**

**Outstanding Practice Demonstrated:**
- Excellent rapport building and empathetic approach to sensitive topic
- Systematic depression screening covering all key domains (mood, sleep, appetite, anhedonia, cognition)
- Thorough risk assessment including suicidal ideation and protective factors
- Comprehensive history including triggers, previous episodes, substance use
- Clear explanation of diagnosis and treatment options

**Clinical Management:**
- Appropriate diagnosis of moderate-severe depression
- Evidence-based treatment plan: SSRI + counseling + holistic approach
- Good safety netting with clear crisis plan
- Appropriate investigation plan to exclude organic causes

**Areas for Development:**
- Could have used formal screening tool (PHQ-9) to quantify severity
- Consider exploring patient's understanding of depression and treatment preferences more
- Alcohol consumption could have been quantified more specifically
- Consider discussing side effects of sertraline in more detail

**Risk Management:**
- Excellent assessment of suicidal risk with protective factors identified
- Clear safety plan provided
- Appropriate follow-up interval (2 weeks)

**Patient Communication:**
- Outstanding - patient felt heard and understood
- Clear explanation that depression is a medical condition, not patient's fault
- Realistic expectations about treatment timeline

**Learning Points:**
- Demonstrates excellent skills in mental health consultation
- Shows appropriate balance of empathy and clinical assessment
- Good example of holistic bio-psycho-social approach

**Overall Assessment:** Excellent consultation demonstrating advanced communication skills and comprehensive mental health assessment. Ready for independent practice with complex mental health presentations.

**Grade: Excellent** (demonstrates skills above expected level for stage of training)`
  },
  {
    id: "chest-pain",
    title: "Acute Chest Pain",
    type: "Emergency Assessment",
    description: "Urgent assessment of chest pain with cardiac risk stratification",
    transcript: `Doctor: Hello Mr. Thompson, I understand you've been having chest pain. Can you tell me about it?

Patient: Yes doctor, it started about an hour ago. It's a tight feeling across my chest.

Doctor: Can you show me exactly where the pain is?

Patient: *points to central chest* It's right here, and it goes into my left arm and up into my jaw.

Doctor: How would you describe the pain - sharp, crushing, burning?

Patient: It's like a heavy weight on my chest, really tight and crushing.

Doctor: On a scale of 1 to 10, how severe is the pain?

Patient: About 7 or 8 out of 10.

Doctor: Does anything make it better or worse?

Patient: It doesn't seem to change when I move or breathe. It's just constant.

Doctor: Have you had any shortness of breath?

Patient: Yes, I feel quite breathless and a bit lightheaded.

Doctor: Any nausea or sweating?

Patient: I did feel sick earlier, and I've been quite sweaty.

Doctor: Have you ever had chest pain like this before?

Patient: Never anything like this. I've had a bit of heartburn before, but this is completely different.

Doctor: Do you have any medical conditions or take any medications?

Patient: I've got high blood pressure and high cholesterol. I take amlodipine and atorvastatin.

Doctor: Do you smoke?

Patient: I used to smoke 20 a day for about 30 years, but I stopped 2 years ago.

Doctor: Any family history of heart problems?

Patient: My dad had a heart attack when he was 55.

Doctor: What were you doing when the pain started?

Patient: I was just walking up the stairs at home.

Doctor: *takes observations* Your pulse is 95 and slightly irregular, blood pressure is 150/95, oxygen levels are fine.

Doctor: Mr. Thompson, I'm concerned this could be a heart attack. I need to do an ECG immediately and I'm going to call an ambulance to take you to hospital.

Patient: A heart attack? Are you sure?

Doctor: Your symptoms and risk factors are very concerning for a heart problem. The hospital can do tests to confirm and start treatment if needed.

Doctor: I'm giving you some aspirin to chew now, and I want you to sit quietly while we wait for the ambulance.`,
    expectedNotes: {
      gpSummary: "Acute central chest pain, 1/24, crushing, radiating L arm/jaw, SOB, sweating, CV risk factors, ?STEMI, 999 ambulance, aspirin given",
      fullNote: `URGENT CONSULTATION - ACUTE CHEST PAIN

Presenting Complaint:
1-hour history of severe central chest pain (7-8/10), crushing in nature, radiating to left arm and jaw. Associated shortness of breath, nausea, diaphoresis.

History:
Onset at rest while climbing stairs. No relieving or aggravating factors. No previous episodes of similar pain. 

Past Medical History:
- Hypertension (on amlodipine)
- Hypercholesterolemia (on atorvastatin)
- Ex-smoker (40 pack-year history, stopped 2 years ago)

Family History:
Paternal myocardial infarction age 55

Examination:
Appears distressed, diaphoretic
Pulse: 95 bpm, slightly irregular
BP: 150/95
O2 Sats: 98% RA
Cardiovascular examination limited by patient distress

Assessment:
ACUTE CORONARY SYNDROME - high suspicion of STEMI
High-risk presentation with classical symptoms and multiple cardiovascular risk factors

Immediate Management:
- Aspirin 300mg chewed
- 999 ambulance requested for immediate transfer
- ECG requested
- Patient advised to remain at rest

URGENT HOSPITAL REFERRAL FOR SUSPECTED MYOCARDIAL INFARCTION`,
      patientCopy: `URGENT MEDICAL SITUATION

What happened today:
You came to see me with severe chest pain that started 1 hour ago. Based on your symptoms and medical history, I am concerned this could be a heart attack.

Immediate action taken:
- Given you aspirin to chew
- Called an ambulance to take you to hospital urgently
- The hospital will do tests (blood tests, heart tracing) to confirm the diagnosis

What happens next:
- You will be taken to the emergency department immediately  
- If this is a heart attack, they have excellent treatments available
- Time is critical - the sooner treatment starts, the better the outcome

Important:
- This is being treated as an emergency
- Stay calm and rest while waiting for the ambulance
- The hospital team are experts in treating heart problems

The symptoms you described (crushing chest pain going to your arm and jaw, along with breathlessness and sweating) need urgent investigation and treatment.`,
      snomedCodes: [
        "57054005 - Acute myocardial infarction",
        "194828000 - Angina pectoris", 
        "29857009 - Chest pain",
        "267038008 - Aspirin therapy"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Acute Chest Pain Emergency**

**Excellent Emergency Management:**
- Immediate recognition of high-risk presentation 
- Systematic pain assessment with all key characteristics documented
- Comprehensive cardiovascular risk factor assessment
- Rapid clinical decision-making under pressure
- Appropriate immediate interventions (aspirin, 999 call)

**Clinical Excellence:**
- Perfect identification of classical ACS symptoms (crushing chest pain, radiation, associated symptoms)
- Thorough past medical history and risk factor evaluation
- Correct interpretation of high-risk combination: symptoms + risk factors + family history
- Appropriate vital signs assessment and documentation

**Emergency Protocols:**
- Immediate aspirin administration - evidence-based acute care
- Urgent ambulance activation with appropriate justification
- Clear communication of suspicion and urgency to patient
- Appropriate monitoring while waiting for transfer

**Patient Communication:**
- Honest but reassuring explanation of concerns
- Clear rationale for urgent action without causing panic
- Appropriate emphasis on hospital expertise and treatment availability

**Time-Critical Decision Making:**
- Excellent prioritization of urgent assessment and management
- No unnecessary delays in recognition and action
- Appropriate limitation of examination given clinical urgency

**Areas for Development:**
- Could have mentioned ECG timing more specifically
- Consider noting any medication allergies before aspirin

**Learning Points:**
- Exemplary emergency medicine practice in primary care
- Demonstrates excellent clinical reasoning under pressure
- Shows appropriate balance of thoroughness with urgency
- Perfect example of when immediate action saves lives

**Overall Assessment:** Outstanding emergency consultation. Textbook recognition and management of suspected STEMI. Demonstrates advanced clinical skills and decision-making appropriate for senior level practice.

**Grade: Excellent** (demonstrates advanced emergency medicine skills)`
  },
  {
    id: "diabetes-review",
    title: "Type 2 Diabetes Annual Review", 
    type: "Chronic Disease Management",
    description: "Comprehensive diabetes review with complication screening",
    transcript: `Doctor: Good morning Mrs. Patel. You're here for your annual diabetes check today.

Patient: Yes, that's right. Time flies - can't believe it's been a year already.

Doctor: How have you been managing with your diabetes recently?

Patient: Generally quite well. I've been taking my metformin every day and trying to watch what I eat.

Doctor: Excellent. Have you been monitoring your blood sugars at home?

Patient: Yes, I check them most mornings before breakfast. They're usually between 6 and 8.

Doctor: That sounds reasonable. Any episodes of very low blood sugars?

Patient: No, nothing like that. Occasionally they might be a bit higher if I've had a treat, but nothing too concerning.

Doctor: How's your weight been?

Patient: I've lost about 2 kilos since last year. I've been trying to follow the diet advice from the nurse.

Doctor: That's fantastic. And exercise?

Patient: I go swimming twice a week and walk most days. My knees are much better since losing weight.

Doctor: Any problems with your feet? Any cuts, sores, or numbness?

Patient: No, nothing like that. I check them regularly like you told me to.

Doctor: Good. How's your vision?

Patient: Fine, no problems. I had my eye test last month.

Doctor: Excellent. Any excessive thirst or passing lots of urine?

Patient: No, all normal.

Doctor: I've got your blood test results from last week. Your HbA1c is 52, which is excellent - it was 58 last year.

Patient: Is that good?

Doctor: Yes, very good. It shows your diabetes is well controlled. Your kidney function is normal, and your cholesterol is also improved.

Doctor: Let me check your blood pressure and examine your feet. *examines patient* Blood pressure is 128/78, which is perfect. Your feet look healthy with good pulses.

Doctor: I think we should continue with the metformin 1000mg twice daily. Your diabetes is very well controlled.

Patient: Do I need any other medications?

Doctor: Not for diabetes at the moment. I am going to start you on a low dose aspirin for heart protection, and continue your atorvastatin.

Doctor: Keep up the excellent work with diet and exercise. I'll see you again in a year, but the nurse will see you in 6 months for a check-up.`,
    expectedNotes: {
      gpSummary: "T2DM annual review, HbA1c 52 (improved), BP 128/78, feet healthy, continue metformin, aspirin started, excellent control",
      fullNote: `Annual Diabetes Review - Type 2 Diabetes Mellitus

Current Management:
Metformin 1000mg BD - good compliance
Home glucose monitoring: fasting levels 6-8 mmol/L
No hypoglycemic episodes

Lifestyle:
- Weight loss 2kg over past year  
- Regular exercise: swimming 2x/week, daily walking
- Good dietary compliance with dietitian advice

Symptoms Review:
No polyuria, polydipsia, visual disturbance, foot problems, or hypoglycemic symptoms

Examination:
- Weight: decreased 2kg from previous year
- BP: 128/78 (target <140/80)
- Feet: intact, good pulses, no neuropathy, good self-care

Investigations (current):
- HbA1c: 52 mmol/mol (improved from 58 mmol/mol)
- eGFR: >60 (normal)
- ACR: <3 (normal)
- Total cholesterol: 3.8 mmol/L

Screening:
- Retinal screening: up to date (last month)
- Foot examination: normal

Assessment:
Type 2 diabetes mellitus - excellent glycemic control

Plan:
- Continue metformin 1000mg BD
- Start aspirin 75mg daily for cardiovascular protection
- Continue atorvastatin
- Annual review in 12 months
- Diabetes nurse review in 6 months
- Continue current lifestyle modifications

Patient education reinforced regarding foot care and hypoglycemia awareness`,
      patientCopy: `Your diabetes annual review went very well today.

Blood sugar control:
- Your HbA1c is 52 - this is excellent control (target is under 58)
- This has improved from 58 last year
- Your home monitoring shows good control

Overall health:
- Blood pressure: 128/78 (excellent)
- Weight: lost 2kg this year (well done!)
- Kidney function: normal
- Cholesterol: improved
- Eye test: up to date
- Feet: healthy

Current medications:
- Continue metformin 1000mg twice daily
- Continue atorvastatin for cholesterol
- Starting aspirin 75mg daily for heart protection

Lifestyle:
- Keep up the excellent work with swimming and walking
- Continue with healthy diet choices
- Weight loss is really helping your diabetes and knees

Next appointments:
- Diabetes nurse check in 6 months  
- Annual review with doctor in 12 months

You're doing extremely well managing your diabetes - keep up the great work!`,
      snomedCodes: [
        "44054006 - Type 2 diabetes mellitus",
        "182840001 - Metformin therapy", 
        "302497006 - Hemoglobin A1c level",
        "9436005 - Diabetic education"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Type 2 Diabetes Annual Review**

**Excellent Chronic Disease Management:**
- Systematic annual review covering all essential diabetes domains
- Comprehensive symptom review (polyuria, polydipsia, visual changes, neuropathy)
- Thorough lifestyle assessment including diet, exercise, and weight management
- Good medication compliance review and safety assessment
- Appropriate investigation interpretation and explanation

**Clinical Excellence:**
- Perfect understanding of HbA1c targets and significance of improvement
- Comprehensive diabetic complication screening (feet, eyes, kidneys)
- Appropriate cardiovascular risk assessment and management
- Good integration of lifestyle factors with medical management

**Patient Communication:**
- Excellent positive reinforcement for patient's self-management efforts
- Clear explanation of test results and their significance
- Appropriate encouragement while maintaining ongoing vigilance
- Good shared decision making regarding treatment continuation

**Preventive Care:**
- Appropriate addition of aspirin for cardiovascular protection
- Good coordination of care with diabetes nurse and optometrist
- Excellent patient education reinforcement

**Areas for Development:**
- Could have briefly addressed flu vaccination status
- Consider asking about erectile dysfunction/sexual health (common diabetes complication)
- Might have mentioned importance of maintaining good dental care

**Long-term Management:**
- Appropriate follow-up schedule with nurse at 6 months
- Good continuity planning for ongoing care
- Excellent documentation of patient's progress and plan

**Learning Points:**
- Demonstrates excellent chronic disease management skills
- Shows good understanding of diabetes complications and prevention
- Perfect example of patient-centered annual review
- Good balance of celebrating success while maintaining vigilance

**Overall Assessment:** Outstanding diabetes review consultation. Demonstrates comprehensive understanding of diabetes management and excellent patient engagement. Shows advanced competency in chronic disease care.

**Grade: Excellent** (demonstrates advanced chronic disease management skills suitable for independent practice)`
  }
];