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
  },
  {
    id: "chestpain",
    title: "Chest Pain Assessment",
    type: "Acute Presentation",
    description: "54-year-old male with central chest pain - urgent assessment required",
    transcript: `Doctor: Mr. Williams, I understand you're experiencing chest pain. Can you tell me exactly what happened?

Patient: Doctor, I was mowing the lawn about an hour ago and suddenly got this crushing pain in the middle of my chest. It was really frightening.

Doctor: Where exactly is the pain now?

Patient: *points to center of chest* Right here, across the middle. It feels like someone's sitting on my chest.

Doctor: On a scale of 1 to 10, how would you rate the pain?

Patient: It's probably about a 7 or 8. It's definitely the worst pain I've ever had in my chest.

Doctor: Does the pain go anywhere else?

Patient: Yes, it goes up into my jaw and down my left arm. That's what really scared me.

Doctor: How long did the pain last when you were mowing?

Patient: About 15 minutes. I had to stop and sit down. It's much better now but still there.

Doctor: Any nausea, sweating, or feeling short of breath?

Patient: I did feel a bit sick and was sweating quite a lot, but I thought that was just from the heat.

Doctor: Have you had chest pain like this before?

Patient: Never anything this bad. Sometimes I get a bit tight when climbing stairs, but nothing like this.

Doctor: Do you smoke, Mr. Williams?

Patient: I quit 5 years ago, but I smoked for about 20 years before that.

Doctor: Any family history of heart problems?

Patient: My dad had a heart attack when he was 60. My brother had bypass surgery last year.

Doctor: Are you on any medications?

Patient: Just something for my blood pressure - ramipril I think. And I take a statin.

Doctor: Let me examine you. *takes observations* Your blood pressure is 160/95, pulse is 95 and regular. Let me listen to your heart and lungs. *examines* I'm going to do an ECG right now.

Doctor: Mr. Williams, your ECG shows some changes that suggest your heart muscle isn't getting enough oxygen. I need to call an ambulance to take you to hospital immediately.

Patient: Is it a heart attack?

Doctor: It's looking like it could be what we call acute coronary syndrome. The hospital team need to see you urgently to do more tests and start treatment.

Doctor: I'm going to give you an aspirin to chew now, and some spray under your tongue for the pain. The paramedics will be here shortly.`,
    expectedNotes: {
      gpSummary: "ACS - central crushing chest pain with radiation, ECG changes, 999 called, aspirin given, GTN administered",
      fullNote: `URGENT - Acute Coronary Syndrome

Presenting Complaint:
Central crushing chest pain (7-8/10 severity) with radiation to jaw and left arm, onset during physical exertion (lawn mowing), duration 15 minutes, associated with nausea and diaphoresis.

History:
54-year-old male with crushing central chest pain onset 1 hour ago during lawn mowing. Classic cardiac pain radiation to jaw and left arm. Associated symptoms: nausea, sweating. Previous history of exertional chest tightness. No previous episodes of this severity.

Risk Factors:
- Ex-smoker (20 pack years, quit 5 years ago)
- Hypertension (on ramipril)
- Hyperlipidemia (on statin therapy)
- Strong family history (father MI age 60, brother CABG)
- Male, age 54

Examination:
BP: 160/95, HR: 95 regular
Heart sounds: normal S1, S2, no murmurs
Chest: clear
ECG: T-wave inversion leads V2-V4, consistent with anterior ischemia

Immediate Management:
- 300mg aspirin chewed
- GTN spray sublingual
- 999 emergency ambulance called
- Hospital pre-alert given

Diagnosis:
Acute Coronary Syndrome - STEMI/NSTEMI to be determined by hospital team

Outcome:
Patient transferred to Emergency Department under Category 1 ambulance for urgent cardiology assessment and primary PCI if indicated.`,
      patientCopy: `URGENT MEDICAL CONDITION

You have been diagnosed with a heart condition called Acute Coronary Syndrome.

What this means:
- One of the arteries supplying your heart muscle may be blocked
- This requires immediate hospital treatment
- This is a serious condition but treatments are very effective

What we've done:
- Given you aspirin to help prevent further clots
- Given you a spray to help with the pain
- Called an ambulance to take you to hospital immediately

At the hospital they will:
- Do more detailed heart tests (blood tests, scans)
- Possibly open the blocked artery with a procedure
- Start you on medications to protect your heart

This condition is treatable and many people make full recoveries with proper treatment.

IMPORTANT: If you have similar symptoms again, call 999 immediately.`,
      snomedCodes: [
        "394659003 - Acute coronary syndrome",
        "29857009 - Chest pain",
        "22298006 - Myocardial infarction",
        "164947007 - Abnormal ECG"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Acute Chest Pain**

**Outstanding Practice Demonstrated:**
- Immediate recognition of high-risk chest pain presentation
- Systematic history covering all cardinal features (site, radiation, character, timing)
- Thorough risk factor assessment (smoking, family history, medications)
- Appropriate examination with vital signs and ECG
- Rapid, decisive management with immediate treatment and hospital transfer

**Clinical Management:**
- Excellent clinical reasoning leading to correct diagnosis
- Appropriate immediate treatment (aspirin, GTN)
- Correct decision for Category 1 ambulance transfer
- Good pre-hospital management of acute coronary syndrome

**Emergency Care Skills:**
- Calm, efficient approach to acute medical emergency
- Clear communication with patient during stressful situation
- Appropriate use of investigation (ECG) to guide management
- Excellent prioritization of immediate vs routine care

**Patient Communication:**
- Clear explanation of serious nature without causing panic
- Appropriate level of information during acute situation
- Good balance of honesty and reassurance

**Areas for Development:**
- Document exact ECG changes in more detail for hospital team
- Consider pain score monitoring after GTN
- Brief mention of time to hospital/expected journey

**Learning Points:**
- Perfect example of acute care in primary care setting
- Demonstrates importance of pattern recognition in chest pain
- Shows excellent emergency response and handover skills
- Good example of when not to "wait and see"

**Overall Assessment:** Exemplary management of acute chest pain. Shows advanced clinical decision-making and emergency care skills. Patient's life potentially saved by rapid recognition and treatment.

**Grade: Outstanding** (demonstrates expert emergency management skills)`
  },
  {
    id: "contraception",
    title: "Contraception Consultation",
    type: "Sexual Health",
    description: "22-year-old female requesting contraceptive advice",
    transcript: `Doctor: Hello Emma, how can I help you today?

Patient: Hi doctor, I'd like to discuss contraception options. I'm currently on the pill but I keep forgetting to take it.

Doctor: I see. Which pill are you taking at the moment?

Patient: It's called Microgynon, I think. I've been on it for about 2 years.

Doctor: How often would you say you miss pills?

Patient: Probably 2 or 3 times a month. Sometimes I remember the next day, sometimes not until I see the packet.

Doctor: Have you had any pregnancy scares or used emergency contraception recently?

Patient: I had to get the morning after pill about 3 months ago when I missed two pills in a row.

Doctor: That must have been stressful. Are you in a relationship at the moment?

Patient: Yes, I've been with my boyfriend for about 6 months. We're not using condoms because we've both been tested for STIs.

Doctor: That's good that you've both been tested. Are you planning a pregnancy in the near future?

Patient: Definitely not for the next few years. I'm still at university and we're nowhere near ready for that.

Doctor: What's most important to you in contraception - effectiveness, convenience, or perhaps having periods?

Patient: Definitely convenience. I travel a lot with uni and I just can't keep track of daily pills. And I wouldn't mind not having periods actually.

Doctor: Have you heard about long-acting contraceptive methods like the coil or implant?

Patient: I've heard of them but don't really know much. Are they safe?

Doctor: Yes, they're very safe and highly effective. The contraceptive implant goes in your arm and lasts 3 years. The coil sits in your womb and can last 5-10 years depending on the type.

Patient: Do they hurt to have fitted?

Doctor: The implant is inserted with local anesthetic, so just a small scratch. The coil insertion can be uncomfortable but it's over quickly. Both are done as outpatient procedures.

Doctor: With the implant, you might have irregular bleeding initially, but many women stop having periods altogether after a year. The hormonal coil often makes periods much lighter or stop completely.

Patient: That sounds quite appealing actually. What about side effects?

Doctor: With the implant, some women experience mood changes, weight gain, or skin changes, but most tolerate it well. If you don't get on with it, it can be removed at any time.

Patient: I think I'd like to try the implant. When could I have it done?

Doctor: We can arrange it for next week. You'll need to use additional contraception for the first 7 days if it's not fitted in the first 5 days of your cycle.

Doctor: I'll also give you some information leaflets to read before you decide. Do you have any other questions about sexual health while you're here?`,
    expectedNotes: {
      gpSummary: "Contraception review, poor pill compliance, counseled re LARC options, patient requesting contraceptive implant",
      fullNote: `Contraception Consultation

Presenting Issue:
22-year-old female requesting contraceptive review due to poor compliance with combined oral contraceptive pill (Microgynon).

Current Contraception:
Microgynon 30 for 2 years, missing 2-3 pills monthly, required emergency contraception 3 months ago following missed pills.

Contraceptive History:
No previous LARC methods. Partner relationship 6 months, both STI tested.

Requirements:
- High effectiveness
- Convenience (frequent travel with studies)
- Not planning pregnancy for several years
- Acceptable to have amenorrhea

Discussion:
Counseled regarding LARC options including contraceptive implant and intrauterine devices. Discussed effectiveness, insertion procedure, side effects, and bleeding patterns.

Decision:
Patient opted for contraceptive implant (Nexplanon) after full counseling.

Plan:
- Arrange implant insertion appointment next week
- Patient information leaflets provided
- Advised regarding 7-day additional contraception requirement
- Continue current pill until implant fitted

Consent: Full informed consent obtained for contraceptive implant`,
      patientCopy: `Contraception Consultation Summary

We discussed your contraception needs today because you're having trouble remembering to take your pill every day.

Your choice: Contraceptive Implant (Nexplanon)
- Small rod inserted under skin in upper arm
- Works for 3 years
- Over 99% effective at preventing pregnancy
- Can be removed at any time if you want to get pregnant or don't like it

What to expect:
- Inserted with local anesthetic (small scratch)
- Takes about 2 minutes
- Use extra contraception (condoms) for first 7 days
- Periods may become irregular or stop completely

Possible side effects:
- Irregular bleeding (especially first 6 months)
- Some women experience mood changes or weight gain
- Most women have no problems

Next steps:
- Appointment arranged for next week
- Read the information leaflets provided
- Continue your pill until the implant is fitted
- Call if you have any questions

Remember: This is a very effective and convenient method of contraception. You can always have it removed if you change your mind.`,
      snomedCodes: [
        "13197004 - Contraception",
        "268463003 - Contraceptive implant",
        "182836005 - Review of contraception",
        "432102000 - Administration of contraceptive"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Contraception Consultation**

**Excellent Practice Demonstrated:**
- Sensitive, non-judgmental approach to sexual health consultation
- Thorough assessment of current contraceptive failure and needs
- Comprehensive discussion of LARC options with advantages/disadvantages
- Patient-centered approach focusing on individual requirements
- Good relationship and STI risk assessment

**Clinical Knowledge:**
- Accurate information about contraceptive methods and effectiveness
- Appropriate counseling about side effects and bleeding patterns
- Correct advice about timing and additional contraception requirements
- Good understanding of contraceptive failure rates and mechanisms

**Communication Skills:**
- Created safe space for sexual health discussion
- Used appropriate language level for young adult
- Checked understanding and provided written information
- Respected patient autonomy in decision-making

**Areas for Development:**
- Could have explored weight/BMI (relevant for some contraceptive choices)
- Consider asking about previous mental health (relevant for hormonal methods)
- Brief discussion about future fertility reassurance could be helpful
- Consider mentioning STI prevention despite current relationship status

**Consultation Management:**
- Efficient consultation covering all key areas
- Appropriate follow-up arrangements
- Good documentation of informed consent process

**Learning Points:**
- Excellent example of patient-centered contraceptive counseling
- Shows good understanding of LARC promotion
- Demonstrates importance of discussing contraceptive failure
- Good balance of information provision without overwhelming patient

**Overall Assessment:** Very good contraception consultation showing competent sexual health skills. Patient's needs well assessed and appropriate method chosen.

**Grade: Good** (demonstrates safe sexual health practice with good patient engagement)`
  },
  {
    id: "copd",
    title: "COPD Exacerbation",
    type: "Respiratory",
    description: "68-year-old with worsening breathlessness and productive cough",
    transcript: `Doctor: Good morning Mr. Thompson. I see from the notes that you called yesterday about your breathing. How are you feeling today?

Patient: Not good at all, doctor. I can barely walk to the bathroom without getting completely out of breath.

Doctor: That does sound concerning. Tell me about your breathing over the past few days.

Patient: It's been getting worse since Monday. Usually I can walk to the shops, but now I'm struggling to get dressed.

Doctor: And how's your cough been?

Patient: Much worse. I'm bringing up thick green stuff, quite a lot of it. Usually it's just clear or a bit white.

Doctor: Any fever or feeling generally unwell?

Patient: I've felt hot and cold, and I'm just so tired. My wife said I look terrible.

Doctor: Have you been taking your inhalers as usual?

Patient: Yes, but they don't seem to be helping much. I've been using the blue one much more often.

Doctor: How often are you using the salbutamol?

Patient: Probably every couple of hours. It used to last me much longer.

Doctor: Any chest pain or leg swelling?

Patient: No chest pain, but my legs do look a bit more swollen than usual.

Doctor: When were you last in hospital with your chest?

Patient: About 8 months ago. They gave me antibiotics and steroids and I felt much better.

Doctor: Let me examine you. *takes observations* Your oxygen saturation is 88% on room air, temperature 37.9°C, heart rate 110. *listens to chest* I can hear wheeze and some coarse crackles at both bases.

Doctor: Mr. Thompson, this looks like another flare-up of your COPD. Your oxygen levels are lower than they should be and you have signs of infection.

Patient: Do I need to go to hospital?

Doctor: I think we can treat you at home this time, but you'll need antibiotics and steroid tablets. I'm also going to arrange for you to have oxygen at home.

Doctor: I'm starting you on amoxicillin for the infection and prednisolone tablets. The oxygen will help your breathing until the treatment kicks in.

Doctor: It's very important that you don't smoke while you have oxygen in the house. I'll arrange for the respiratory nurse to visit you tomorrow.

Patient: How long before I feel better?

Doctor: You should start feeling better in 2-3 days, but it may take a week or two to get back to your normal. If you get worse, or can't cope at home, call us immediately.

Doctor: I'll see you again in a few days to check how you're getting on.`,
    expectedNotes: {
      gpSummary: "COPD exacerbation with infection, pyrexial, O2 sats 88%, started amoxicillin and prednisolone, home oxygen arranged",
      fullNote: `COPD Exacerbation - Moderate Severity

Presenting Complaint:
4-day history of worsening dyspnea, increased sputum production (green), systemic symptoms.

History:
Known COPD patient with deteriorating functional capacity over 4 days. Increased sputum volume and purulence, fever, fatigue. Increased salbutamol usage (every 2 hours). Some peripheral edema noted. Last hospital admission 8 months ago for similar episode.

Examination:
Obs: T 37.9°C, O2 sats 88% (RA), HR 110 bpm
Chest: bilateral wheeze, coarse crackles both bases
Peripheral edema present
No signs of respiratory distress at rest

Assessment:
COPD exacerbation - moderate severity with infective component
No criteria for hospital admission

Management:
- Amoxicillin 500mg TDS x 5 days
- Prednisolone 30mg daily x 5 days
- Home oxygen therapy arranged
- Continue current inhalers
- Respiratory nurse visit arranged for tomorrow

Safety Netting:
Return/contact surgery if increased breathlessness, unable to cope at home, or systemic deterioration

Follow-up: Review in 3-4 days`,
      patientCopy: `Your COPD (lung condition) has flared up with an infection.

What this means:
- Your airways are more inflamed than usual
- You have a chest infection that needs treating
- This is treatable at home with medication

Your treatment:
- Antibiotics: Amoxicillin 500mg, three times daily for 5 days
- Steroid tablets: Prednisolone 30mg once daily for 5 days
- Continue your usual inhalers
- Home oxygen has been arranged to help your breathing

Important safety information:
- Do NOT smoke while you have oxygen in the house (fire risk)
- Take all antibiotics even if you feel better
- The steroid tablets should be taken with food

When to contact us urgently:
- If your breathing gets much worse
- If you feel you cannot cope at home
- If you become confused or very unwell

Follow-up:
- Respiratory nurse will visit you tomorrow
- Doctor will see you again in 3-4 days
- You should start feeling better in 2-3 days

Remember: This type of flare-up is common with COPD and usually responds well to treatment.`,
      snomedCodes: [
        "13645005 - COPD",
        "195951007 - Acute exacerbation of COPD",
        "9014002 - Sputum purulent",
        "182836005 - Medication review"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - COPD Exacerbation**

**Excellent Practice Demonstrated:**
- Rapid recognition of COPD exacerbation with systematic assessment
- Good differentiation between baseline and acute deterioration
- Thorough examination with appropriate vital signs monitoring
- Correct severity assessment and treatment decision
- Excellent safety netting and follow-up arrangements

**Clinical Management:**
- Appropriate antibiotic choice for COPD exacerbation
- Correct steroid dosing and duration
- Good decision-making regarding home vs hospital treatment
- Appropriate oxygen therapy arrangement with safety advice

**Respiratory Medicine:**
- Good understanding of COPD exacerbation triggers and management
- Appropriate assessment of functional decline
- Good recognition of infective vs non-infective exacerbation
- Correct use of oxygen saturation monitoring

**Areas for Development:**
- Could have documented peak flow or assessed for pneumonia more specifically
- Consider arterial blood gas if concerned about CO2 retention
- Brief mention of smoking cessation advice (if still smoking)
- Consider reviewing inhaler technique during recovery

**Patient Education:**
- Good explanation of condition and treatment rationale
- Excellent safety advice regarding oxygen and smoking
- Clear instructions about when to seek help
- Appropriate expectations about recovery timeline

**Learning Points:**
- Demonstrates good acute respiratory medicine skills
- Shows appropriate use of community resources (respiratory nurse)
- Good example of avoiding unnecessary hospital admission
- Shows understanding of COPD management pathways

**Overall Assessment:** Very good management of COPD exacerbation. Shows competent respiratory medicine skills with appropriate treatment decisions and safety planning.

**Grade: Good** (demonstrates safe independent management of acute respiratory conditions)`
  },
  {
    id: "dementia",
    title: "Memory Problems Assessment",
    type: "Cognitive Assessment",
    description: "75-year-old brought by daughter with concerns about memory loss",
    transcript: `Doctor: Good morning Mrs. Patterson, and thank you for coming in with your daughter. I understand there are some concerns about your memory?

Patient: I don't know what all the fuss is about. My memory's fine.

Daughter: Doctor, I'm really worried about mum. She's been forgetting things that just happened, and yesterday she got lost coming back from the shops she's been going to for 20 years.

Doctor: Mrs. Patterson, do you remember getting lost yesterday?

Patient: I wasn't lost. I just took a different route home. Sarah worries too much.

Daughter: Mum, you were gone for 3 hours. The shopkeeper called me because you seemed confused.

Doctor: Mrs. Patterson, can you tell me what day it is today?

Patient: It's... Thursday? No, maybe Wednesday. What does it matter anyway?

Doctor: It's Tuesday today. Can you tell me who's the Prime Minister?

Patient: Oh, that's Tony Blair, isn't it?

Daughter: Mum, Tony Blair hasn't been Prime Minister for years.

Doctor: Sarah, can you tell me what changes you've noticed at home?

Daughter: She's left the gas on twice in the past month. She keeps asking me the same questions over and over. She's forgotten how to use the washing machine she's had for 5 years.

Doctor: Has she been managing her finances okay?

Daughter: She gave the same charity £50 three times last week because she forgot she'd already donated. And she's been buying groceries and forgetting she's bought them.

Doctor: Mrs. Patterson, are you managing okay with cooking and cleaning?

Patient: Of course I am. I've been looking after myself for years since Harold died.

Daughter: Doctor, she's not eating properly. I found moldy food in her fridge, and she's lost quite a bit of weight.

Doctor: How long has Harold been gone, Mrs. Patterson?

Patient: He died... last year? Or was it the year before? Time goes so quickly.

Daughter: Dad died 8 years ago, mum.

Doctor: Mrs. Patterson, I'm going to do a few simple tests with you. Can you tell me what year it is?

Patient: 2018? 2019? I get confused with all these numbers.

Doctor: Can you remember three words for me: apple, penny, table?

Patient: Apple, penny... what was the third one?

Doctor: *after cognitive testing* I'd like to do some blood tests to check for other causes of memory problems, and I'm going to refer you to the memory clinic.

Daughter: Is it dementia, doctor?

Doctor: There are signs that Mrs. Patterson's memory and thinking skills have declined significantly. The memory clinic will do more detailed tests to work out exactly what's causing this.

Doctor: In the meantime, I'll put you in touch with social services to discuss support at home, and there are some safety things we need to think about like driving.`,
    expectedNotes: {
      gpSummary: "Cognitive impairment assessment, MMSE 18/30, functional decline, daughter concerns, memory clinic referral, driving discussed",
      fullNote: `Cognitive Assessment - Referred by Family

History:
Progressive memory loss over several months, brought by daughter. Recent incident of getting lost in familiar area. Significant functional decline: leaving gas on, repetitive questioning, unable to operate familiar appliances, financial mismanagement. Poor nutritional status and self-care.

Cognitive Assessment:
Disoriented to time (thinks Tuesday is Thursday/Wednesday)
Disoriented to chronology (thinks Tony Blair current PM, confused about husband's death 8 years ago)
Poor short-term memory (unable to recall 3 words after 5 minutes)
MMSE: 18/30 (moderate cognitive impairment)

Functional Assessment:
- Safety concerns: gas left on, poor food hygiene
- Financial vulnerability: repeat donations, duplicate shopping
- ADL difficulties: washing machine, cooking
- Weight loss noted
- Living alone since husband died 8 years ago

Assessment:
Moderate cognitive impairment consistent with dementia
Differential diagnosis: Alzheimer's disease, vascular dementia, mixed dementia

Investigations Planned:
- Blood tests: FBC, U&E, LFTs, TFTs, B12, folate, glucose
- Memory clinic referral for formal cognitive assessment

Management:
- Social services referral for care assessment
- DVLA notification advised (driving assessment)
- Family support discussed
- Safety assessment needed

Follow-up:
Review after memory clinic assessment`,
      patientCopy: `Memory Assessment Summary

We have assessed your memory and thinking today because your daughter has noticed some changes.

What we found:
- Some difficulties with memory and thinking
- You may need some extra support at home
- We need to do some tests to understand this better

Next steps:
- Blood tests to check for treatable causes
- Referral to memory clinic for detailed assessment
- Social services will contact you about support at home

Important considerations:
- Driving: We may need to inform DVLA about your memory problems
- Safety at home: Your daughter can help with things like cooking
- Managing money: Consider having help with finances

Support available:
- Memory clinic specialists will help with diagnosis and treatment
- Social services can arrange help at home
- Your family are very caring and want to help

This appointment was to make sure you get the right help and support. The memory clinic will explain everything in more detail and discuss what help is available.

Follow-up appointment will be arranged after your memory clinic visit.`,
      snomedCodes: [
        "52448006 - Dementia",
        "386806002 - Impaired cognition",
        "419284004 - Altered mental status",
        "3616003 - Cognition test"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Dementia Assessment**

**Outstanding Practice Demonstrated:**
- Sensitive handling of cognitive assessment with family present
- Excellent collateral history taking from daughter
- Systematic cognitive testing with appropriate screening tools
- Comprehensive functional assessment covering safety and ADLs
- Appropriate investigation and referral pathway initiated

**Clinical Skills:**
- Good recognition of moderate cognitive impairment
- Appropriate differential diagnosis consideration
- Excellent safety assessment (driving, gas, finances)
- Good understanding of when to involve external services

**Communication Excellence:**
- Maintained patient dignity while acknowledging daughter's concerns
- Balanced approach to patient who lacks insight
- Clear explanation of next steps without premature diagnostic labeling
- Sensitive discussion of difficult topics (driving, independence)

**Areas for Development:**
- Could have used formal MMSE scoring tool more explicitly
- Consider medication review (may contribute to confusion)
- Brief discussion of advance care planning could be introduced
- Consider asking about mood/depression symptoms

**Family-Centered Care:**
- Excellent recognition of carer burden and concerns
- Good involvement of daughter as advocate and historian
- Appropriate discussion of support services
- Clear explanation of referral process and timeline

**Learning Points:**
- Perfect example of challenging cognitive assessment
- Shows excellent clinical reasoning about safety and capacity
- Demonstrates good understanding of dementia care pathway
- Good balance of hope and realism in difficult situation

**Overall Assessment:** Exemplary handling of complex cognitive assessment. Shows advanced skills in dementia recognition and appropriate intervention. Excellent family communication in difficult circumstances.

**Grade: Outstanding** (demonstrates expert skills in cognitive assessment and dementia care)`
  },
  {
    id: "backpain",
    title: "Acute Lower Back Pain",
    type: "Musculoskeletal",
    description: "35-year-old tradesman with sudden onset severe back pain",
    transcript: `Doctor: Good morning Paul. I can see you're struggling to sit comfortably. Tell me what's happened to your back.

Patient: Doctor, I was lifting some heavy tiles at work yesterday morning and felt something go in my lower back. The pain was instant and now I can barely move.

Doctor: Where exactly is the pain?

Patient: Right here *points to lower back* across the bottom of my back, mainly on the right side. It's absolutely killing me.

Doctor: Does the pain go anywhere else?

Patient: It shoots down my right leg, especially when I cough or sneeze. Sometimes it goes all the way to my foot.

Doctor: What does the pain feel like in your leg?

Patient: It's like electric shocks, quite sharp. And my right foot feels a bit numb and tingly.

Doctor: Can you walk normally?

Patient: Barely. I had to call in sick today which I never do. I'm sort of shuffling around bent forward.

Doctor: Have you had any problems with your bladder or bowels?

Patient: No, nothing like that.

Doctor: Any weakness in your legs?

Patient: The right leg feels weak, especially when I try to lift my foot up.

Doctor: Have you had back problems before?

Patient: I've had the odd twinge over the years - I'm a tiler so it's occupational hazard - but nothing like this.

Doctor: What pain relief have you tried?

Patient: I took some ibuprofen last night and this morning, but it's barely touched it. I couldn't sleep at all.

Doctor: Let me examine your back. Can you stand up for me? *observes posture and gait* I can see you're listing to one side. Let me check your reflexes and do some movement tests.

Doctor: *after examination* Your right knee reflex is reduced and you have weakness lifting your right foot. The straight leg raising test is very positive on the right.

Doctor: Paul, this looks like you've prolapsed a disc in your lower back which is pressing on the nerve going to your right leg. This is what's causing the shooting pain and numbness.

Patient: That sounds serious. Do I need surgery?

Doctor: Most disc problems get better without surgery, even when they're severe like yours. However, I am going to refer you for an urgent MRI scan because of the nerve symptoms.

Doctor: For now, I'm going to give you stronger painkillers - some naproxen and codeine. Keep as active as you can, but listen to your body.

Patient: Should I be off work?

Doctor: Yes, definitely for at least a week, possibly longer. I'll give you a sick note. Your back needs time to heal.

Doctor: If you develop any bladder problems, loss of feeling around your back passage, or severe weakness in both legs, you must go to A&E immediately.

Patient: How long before I'm better?

Doctor: Most people see significant improvement in 6-8 weeks, but it can take longer. We'll review you in a week to see how you're getting on.`,
    expectedNotes: {
      gpSummary: "Acute disc prolapse L5/S1, severe sciatica with neurological signs, MRI requested, strong analgesia, sick leave",
      fullNote: `Acute Lower Back Pain with Sciatica

Presenting Complaint:
Sudden onset severe lower back pain following lifting heavy tiles at work. 24-hour history.

History:
Acute onset lumbar pain with immediate right-sided sciatica extending to foot. Neuropathic pain description (electric shocks). Associated numbness and tingling in right foot. Functional impairment - unable to work, disturbed sleep. Failed response to NSAIDs.

Red Flag Assessment:
No cauda equina symptoms (bladder/bowel function normal, no saddle anesthesia)

Examination:
Antalgic gait, reduced lumbar lordosis, listing to left
Right knee reflex diminished
Weakness of right foot dorsiflexion (4/5 power)
Positive straight leg raise test right side (30 degrees)
Sensory loss lateral aspect right foot

Assessment:
Acute lumbar disc prolapse (likely L5/S1) with nerve root compression

Investigations:
Urgent MRI lumbar spine requested due to neurological signs

Management:
- Naproxen 500mg BD
- Codeine 30mg QDS PRN
- Sick certification for 1 week initially
- Advice re: graduated activity as tolerated

Red Flag Safety Netting:
Immediate A&E if cauda equina symptoms develop (bladder/bowel dysfunction, bilateral leg weakness, saddle anesthesia)

Follow-up: Review in 1 week`,
      patientCopy: `Back Pain Information

What's wrong:
You have a prolapsed disc in your lower back which is pressing on a nerve going to your right leg. This is why you have pain shooting down your leg and numbness in your foot.

Treatment:
- Stronger painkillers: Naproxen twice daily, Codeine up to 4 times daily as needed
- Stay as active as possible within your pain limits
- Avoid bed rest - gentle movement helps recovery
- Heat pads may help muscle spasm

Work:
- You are signed off work for 1 week initially
- We'll review this as your pain improves
- No heavy lifting for several weeks

When to seek emergency help (go to A&E immediately):
- Loss of bladder or bowel control
- Numbness around your back passage
- Severe weakness in both legs

What to expect:
- This type of injury usually improves significantly in 6-8 weeks
- The leg pain often improves before the back pain
- Most people recover without needing surgery

Follow-up:
- Appointment in 1 week to check progress
- MRI scan has been arranged
- Call if symptoms worsen or red flag symptoms develop

Remember: This is a common injury that usually heals well with time and appropriate treatment.`,
      snomedCodes: [
        "202794004 - Prolapsed lumbar intervertebral disc",
        "23056005 - Sciatica",
        "279039007 - Low back pain",
        "57676002 - Nerve root pain"
      ]
    },
    traineeFeedback: `**GP Trainee Supervisor Feedback - Acute Back Pain with Sciatica**

**Excellent Practice Demonstrated:**
- Systematic assessment of acute back pain with appropriate red flag screening
- Thorough neurological examination with relevant clinical tests
- Good recognition of disc prolapse with nerve root compression
- Appropriate investigation request (urgent MRI) based on neurological findings
- Excellent safety netting for cauda equina syndrome

**Clinical Skills:**
- Good occupational history and mechanism of injury
- Appropriate pain assessment and previous treatment review
- Comprehensive examination including reflexes, power, and straight leg raise
- Correct clinical reasoning leading to accurate diagnosis

**Pain Management:**
- Appropriate escalation of analgesia with combination therapy
- Good advice about activity levels and avoiding bed rest
- Realistic expectations about recovery timeline
- Consideration of work capacity and certification

**Areas for Development:**
- Could have asked more specifically about previous episodes and triggers
- Consider brief discussion of weight/lifestyle factors if relevant
- Might mention physiotherapy referral for recovery phase
- Consider discussing sleeping position and posture advice

**Emergency Care:**
- Outstanding red flag education and safety netting
- Clear, specific instructions about when to seek emergency care
- Good balance of reassurance while maintaining vigilance

**Learning Points:**
- Excellent example of systematic approach to acute back pain
- Shows good understanding of when to investigate neurological back pain
- Demonstrates appropriate use of imaging in presence of neurological signs
- Good balance of conservative management with appropriate investigation

**Overall Assessment:** Very good management of acute back pain with complications. Shows competent musculoskeletal assessment skills and appropriate clinical decision-making.

**Grade: Good** (demonstrates safe independent management of complex back pain presentations)`
  }
];