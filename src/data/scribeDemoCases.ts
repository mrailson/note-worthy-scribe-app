export interface ScribeDemoCase {
  id: string;
  title: string;
  complexity: 'routine' | 'moderate' | 'complex';
  description: string;
  patientDetails: {
    name: string;
    dob: string;
    nhsNumber: string;
    address: string;
    phone: string;
  };
  transcript: string;
}

export const SCRIBE_DEMO_CASES: ScribeDemoCase[] = [
  {
    id: 'demo-urti',
    title: 'Upper Respiratory Tract Infection',
    complexity: 'routine',
    description: 'Simple viral illness with cough and mild fever',
    patientDetails: {
      name: 'Margaret Thompson',
      dob: '15/03/1958',
      nhsNumber: '943 476 5821',
      address: '47 Abington Avenue, Northampton NN1 4PA',
      phone: '01604 234 567'
    },
    transcript: `[Consultation Start - 09:15]

Dr: Good morning Mrs Thompson, please take a seat. Can you confirm your date of birth for me?

Patient: Yes, it's the 15th of March 1958.

Dr: Perfect, thank you. And you're still at 47 Abington Avenue?

Patient: Yes, that's right.

Dr: Now, what can I help you with today?

Patient: Well doctor, I've had this terrible cough for about four days now. It started with a bit of a sore throat last weekend, and now I'm coughing up quite a bit of phlegm. It's yellowy-green.

Dr: I see. Have you had any fever or felt feverish?

Patient: Yes, I felt quite hot on Monday and Tuesday, but I think that's settled down now. I've been taking paracetamol which has helped.

Dr: Good. Any shortness of breath or chest pain?

Patient: No, nothing like that. Just this annoying cough that keeps waking me up at night.

Dr: Any wheeziness or difficulty breathing?

Patient: No, I can breathe fine.

Dr: Have you had any muscle aches, headaches, or loss of taste or smell?

Patient: A bit of a headache on and off, but my taste and smell are fine.

Dr: Are you a smoker?

Patient: No, never have been.

Dr: Any significant medical conditions I should know about?

Patient: Just my blood pressure tablets, I take amlodipine.

Dr: Okay, let me have a listen to your chest. If you could just take some deep breaths for me... That's lovely... And again... Good.

[Examination]

Dr: Your chest sounds clear, no crackles or wheezes. Your temperature is normal at 36.8. Your throat is a bit red but nothing concerning. This looks like a straightforward upper respiratory tract infection - a viral cold essentially.

Patient: So I don't need antibiotics then?

Dr: No, antibiotics won't help here as this is viral. The yellow phlegm is normal and doesn't mean you need antibiotics. It should clear up on its own within 7 to 10 days. Keep taking paracetamol for any discomfort, drink plenty of fluids, and honey and lemon can help with the cough.

Patient: And when should I come back?

Dr: If you're not improving after 10 days, if you develop a high fever, shortness of breath, or chest pain, come back and we'll reassess. But I expect you'll be on the mend soon.

Patient: Thank you doctor.

Dr: You're welcome. Take care.

[Consultation End - 09:24]`
  },
  {
    id: 'demo-diabetes-review',
    title: 'Type 2 Diabetes Annual Review',
    complexity: 'routine',
    description: 'Routine diabetic review with good control',
    patientDetails: {
      name: 'David Williams',
      dob: '22/08/1965',
      nhsNumber: '712 934 8156',
      address: '12 Billing Road, Great Billing, Northampton NN3 9EX',
      phone: '01604 456 789'
    },
    transcript: `[Consultation Start - 10:30]

Dr: Hello Mr Williams, come in and have a seat. Just confirming your date of birth please?

Patient: 22nd of August 1965.

Dr: Lovely, and still at 12 Billing Road?

Patient: Yes, same address.

Dr: This is your annual diabetes review. I've got your recent blood results here. How have you been feeling generally?

Patient: Pretty good actually. I've been trying to watch what I eat and I've started walking more.

Dr: That's excellent to hear. Let's go through your results. Your HbA1c has come down to 52, which is a really good improvement from 58 last year. That's well within our target range.

Patient: Oh that's good news!

Dr: Your kidney function is stable, eGFR is 78 which is fine for your age. Urine shows no protein which is great. Cholesterol is 4.2, nice and low. Blood pressure today is 134/82 which is acceptable.

Dr: Are you still on metformin 500mg twice daily?

Patient: Yes, and the gliclazide 80mg in the morning.

Dr: Any side effects from the tablets? Any stomach upsets or hypos?

Patient: No, I've been fine with them. I had a couple of episodes where I felt a bit shaky before lunch, but I just had a biscuit and it passed.

Dr: Those sound like mild hypos. Try to have your meals regularly and don't skip lunch. If they become more frequent, we might need to adjust the gliclazide.

Dr: Have you had your eyes checked this year?

Patient: Yes, I went to the optician at the hospital about two months ago. They said everything was fine.

Dr: Great, I can see that result here - no diabetic retinopathy. And have you been checking your feet regularly?

Patient: I try to, yes.

Dr: Let me just have a quick look at your feet now.

[Foot examination]

Dr: Your feet look healthy, good circulation, pulses present, no wounds or calluses. Sensation is intact. Keep looking after them - wash daily, dry between toes, moisturise, and check for any cuts or changes.

Patient: Will do.

Dr: I'll arrange for your flu and pneumonia vaccines if you haven't had them. The nurse will give you a call. Continue with your current medications, keep up the good work with the diet and exercise, and I'll see you again in a year unless anything changes.

Patient: Thank you very much doctor.

[Consultation End - 10:48]`
  },
  {
    id: 'demo-chest-pain',
    title: 'Chest Pain Assessment',
    complexity: 'moderate',
    description: 'New onset chest pain requiring cardiac workup',
    patientDetails: {
      name: 'Sarah Mitchell',
      dob: '07/11/1972',
      nhsNumber: '485 623 9174',
      address: '89 Wellingborough Road, Northampton NN1 4DU',
      phone: '01604 345 678'
    },
    transcript: `[Consultation Start - 14:00]

Dr: Good afternoon Mrs Mitchell. I understand you've been having some chest pain? That must be concerning for you. Can you tell me more about it?

Patient: Yes doctor, I've been getting this pain in the centre of my chest for the past week or so. It started last Tuesday.

Dr: Can you describe what the pain feels like?

Patient: It's like a tightness or pressure. Sometimes it feels like someone's sitting on my chest.

Dr: How long does each episode last?

Patient: Usually about 10 to 15 minutes, then it goes away.

Dr: Does anything bring it on or make it worse?

Patient: It seems to happen when I'm walking uphill or rushing. Yesterday I got it when I was carrying the shopping up the stairs.

Dr: And what makes it better?

Patient: Resting helps. If I stop and sit down, it gradually goes away.

Dr: Does the pain go anywhere else - like your arm, neck, or jaw?

Patient: Sometimes I feel an ache in my left arm, but not always.

Dr: Any shortness of breath, sweating, or nausea with the pain?

Patient: A little breathless sometimes, and I did feel a bit sweaty once.

Dr: Have you ever had anything like this before?

Patient: No, never. That's why I thought I should come in.

Dr: You were absolutely right to come. What about your medical history - any heart problems, high blood pressure, diabetes, high cholesterol?

Patient: I've got high cholesterol. I was given tablets for it but I'm ashamed to say I stopped taking them a couple of years ago. My blood pressure was borderline last time it was checked.

Dr: Do you smoke?

Patient: I used to - about 10 a day for 15 years, but I quit 5 years ago.

Dr: Well done on quitting. Any family history of heart disease?

Patient: My dad had a heart attack at 60. He's okay now though.

Dr: Let me examine you. I'll check your pulse, blood pressure, and listen to your heart and lungs.

[Examination]

Dr: Your pulse is regular at 78, blood pressure is 148/92 which is elevated. Heart sounds are normal with no murmurs. Lungs are clear. I'm going to do an ECG now.

[ECG performed]

Dr: Your ECG is showing some minor changes that I want to investigate further. Based on your symptoms - chest tightness on exertion that's relieved by rest, with your risk factors - I'm concerned this could be angina.

Patient: Oh dear. Is that serious?

Dr: It needs proper investigation. I'm going to refer you urgently to cardiology for further tests including a stress test or CT coronary angiogram. In the meantime, I'm starting you on aspirin 75mg daily, restarting your statin, and giving you a GTN spray to use if you get the pain.

Dr: If you get chest pain that doesn't go away with the spray after 5 minutes, or if the pain is severe, you must call 999 immediately.

Patient: I understand. Thank you for taking this seriously.

Dr: Of course. The cardiology team should contact you within two weeks. I'll also arrange blood tests to check your cholesterol and kidney function before starting the other medications.

[Consultation End - 14:25]`
  },
  {
    id: 'demo-mental-health',
    title: 'Mental Health Crisis - Anxiety and Depression',
    complexity: 'complex',
    description: 'Significant anxiety and depression with risk assessment',
    patientDetails: {
      name: 'James Harrison',
      dob: '30/04/1989',
      nhsNumber: '629 841 5732',
      address: '23 St Giles Street, Northampton NN1 1JF',
      phone: '01604 567 890'
    },
    transcript: `[Consultation Start - 11:00]

Dr: Hello James, thanks for coming in today. I can see from the notes you asked to speak to someone urgently. How are you doing?

Patient: [Long pause] Not great, to be honest. I've been struggling for a while now and I think... I don't know, I think I need some help.

Dr: I'm glad you came in. Take your time - tell me what's been going on.

Patient: It started about three months ago when I lost my job. I was made redundant and at first I thought I'd find something quickly, but it's just been rejection after rejection. I can't sleep properly, I'm constantly worried about money, and lately I just feel like what's the point of anything.

Dr: That sounds incredibly difficult. When you say "what's the point" - can you tell me more about what you mean by that?

Patient: [Emotional] I don't know... I just feel like a failure. I can't provide for my family, my wife is having to work extra shifts, and I feel like everyone would be better off without me sometimes.

Dr: James, I need to ask you directly - have you had any thoughts of harming yourself or ending your life?

Patient: I've thought about it, yes. Not like a plan or anything, but the thought crosses my mind. Like when I'm lying awake at 3am, I think maybe things would be easier if I just wasn't here.

Dr: Have you ever acted on those thoughts or made any plans?

Patient: No. I couldn't do that to my kids. They're the only thing keeping me going really.

Dr: Your children sound like an important reason to keep going. Do you have access to anything you could use to harm yourself - medications, weapons?

Patient: No, nothing like that. We only have paracetamol in the house and I wouldn't... I'm not going to do anything. I just have these dark thoughts.

Dr: Thank you for being so honest with me. It takes courage to talk about this. Let me ask about some other symptoms. How's your sleep?

Patient: Terrible. I'm only getting about 3 or 4 hours a night. I can't switch my brain off.

Dr: And your appetite?

Patient: I've lost about a stone in the past month. I just don't feel hungry.

Dr: Energy levels?

Patient: Non-existent. I can barely get out of bed some days. I've stopped going to the gym, stopped seeing my mates. I just sit at home applying for jobs and getting rejected.

Dr: Any problems with concentration or memory?

Patient: Yeah, I can't focus on anything. I read the same job advert five times and still don't take it in.

Dr: Have you been drinking more alcohol or using any substances to cope?

Patient: I've been having a few beers in the evening. Maybe more than I should. It helps me relax.

Dr: How many would you say?

Patient: Probably 4 or 5 cans most nights.

Dr: Does your wife know how you're feeling?

Patient: She knows I'm stressed about work but I haven't told her about the dark thoughts. I don't want to burden her.

Dr: James, what you're experiencing sounds like severe depression and anxiety, and I'm concerned about you. The good news is this is treatable and you've taken an important first step by coming in today.

Dr: I want to start you on an antidepressant - sertraline 50mg once daily. It takes about 2-4 weeks to work, and you might feel a bit worse initially, but that's normal. I also want to refer you urgently to the mental health team for talking therapy.

Dr: I'd like you to try to reduce the alcohol - it's a depressant and will make things worse. And most importantly, I want you to tell your wife what's been going on. You need support.

Patient: Okay. I'll try.

Dr: I'm going to give you the crisis team number as well - if those dark thoughts get worse, or you feel like you might act on them, call them immediately. Can we make a safety plan together?

Patient: Yes, that sounds helpful.

Dr: Who can you call if you're struggling?

Patient: My wife, I suppose. And my brother - we're quite close.

Dr: Good. So if the thoughts get bad, you'll call your wife or brother, or the crisis line. And you'll come straight here or go to A&E if needed. Agreed?

Patient: Agreed.

Dr: I want to see you again in one week. My door is always open.

[Consultation End - 11:35]`
  },
  {
    id: 'demo-multimorbidity',
    title: 'Multi-morbidity Management',
    complexity: 'complex',
    description: 'Complex patient with COPD, heart failure and Type 2 diabetes',
    patientDetails: {
      name: 'Patricia Robinson',
      dob: '18/06/1952',
      nhsNumber: '358 712 4698',
      address: '156 Kettering Road, Northampton NN1 4AZ',
      phone: '01604 678 901'
    },
    transcript: `[Consultation Start - 15:30]

Dr: Good afternoon Mrs Robinson. I see you've got quite a few things to discuss today. How have you been getting on?

Patient: Not too bad doctor, but I've been more breathless lately and my ankles have been swelling up again.

Dr: Let's go through each of your conditions systematically. Starting with the breathlessness - is this worse than your usual COPD symptoms?

Patient: Yes, I'd say so. I'm having to use my blue inhaler more - probably 4 or 5 times a day now instead of once or twice. And I can only walk about 50 yards before I have to stop.

Dr: Any increase in your cough or phlegm?

Patient: The cough is about the same, but the phlegm has been a bit more green than usual for the past few days.

Dr: Any fever or chest pain?

Patient: No fever, but I do get a bit of tightness across my chest when I'm breathless.

Dr: Let me listen to your chest and check your observations.

[Examination]

Dr: Your oxygen saturations are 92% which is your usual baseline. I can hear some wheeze and some crackles at the bases of your lungs. Your blood pressure is 142/88 and pulse is 88 and regular.

Dr: Looking at your ankles, there's definitely some pitting oedema there - worse on the right than the left. Have you been weighing yourself?

Patient: I've put on about 4 pounds this week.

Dr: That weight gain with the ankle swelling suggests your heart failure might be getting a bit worse. Are you taking all your heart tablets?

Patient: Yes - the bisoprolol, ramipril, and the water tablet. I take them every morning.

Dr: Good. Have you reduced your salt intake like we discussed?

Patient: I've been trying, but it's hard. I do like my bacon sandwich at the weekend.

Dr: I understand. Let's also check your diabetes. Have you been monitoring your blood sugars?

Patient: Yes, they've been running a bit high actually. Fasting is usually around 9 or 10 now, and sometimes 12 or 13 after meals.

Dr: Your last HbA1c was 64 which was up from 58. We might need to adjust your medications. Are you still on metformin and gliclazide?

Patient: Yes, metformin 500mg three times a day and gliclazide 80mg twice daily.

Dr: Okay, let me examine your feet as well while you're here.

[Foot examination]

Dr: I can see some dry skin and a small callus on your right big toe. The pulses are a bit weak but present. Sensation is reduced in both feet - you didn't feel the monofilament on three of the points I tested. This is diabetic neuropathy and we need to be very careful with foot care.

Patient: Should I be worried?

Dr: It's important but manageable. You must check your feet daily for any cuts or blisters, and never go barefoot. I'll refer you to the podiatry team for regular foot care.

Dr: Now, for your current issues. I think you've got two problems - a mild COPD exacerbation with the green phlegm, and some fluid retention from your heart failure. I'm going to:

1. Give you a course of antibiotics and prednisolone for the COPD exacerbation
2. Increase your furosemide from 40mg to 80mg daily for a week to clear the fluid
3. Add in a new diabetes medication called dapagliflozin - this will actually help both your diabetes AND your heart failure
4. Arrange blood tests in a week to check your kidney function and potassium with the increased diuretic

Dr: You need to weigh yourself daily. If you gain more than 2 pounds in a day or your breathing gets worse, come straight back. Reduce your fluids to about 1.5 litres a day.

Patient: That's a lot to remember doctor.

Dr: I'll print you a summary with all the instructions. The pharmacist can also go through everything with you. I want to see you again in one week, sooner if you're worse.

Patient: Thank you doctor. I do appreciate you taking the time.

Dr: That's what we're here for. Let's get you feeling better.

[Consultation End - 16:05]`
  }
];

export const getComplexityColor = (complexity: ScribeDemoCase['complexity']) => {
  switch (complexity) {
    case 'routine':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'moderate':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'complex':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const getComplexityLabel = (complexity: ScribeDemoCase['complexity']) => {
  return complexity.charAt(0).toUpperCase() + complexity.slice(1);
};
