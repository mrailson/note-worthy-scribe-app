// Utility function to calculate the next working day (Monday-Friday)
const getNextWorkingDay = (daysFromNow: number = 1): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  
  // If it's weekend, move to next Monday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Utility function to format date for appointment times
const formatAppointmentDate = (daysFromNow: number = 1): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  
  // If it's weekend, move to next Monday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : 
                 day % 10 === 2 && day !== 12 ? 'nd' : 
                 day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  
  return `${day}${suffix} ${date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
};

export interface TestPatient {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  email: string;
  request: string;
  englishReply: string;
}

export const TEST_PATIENT_REQUESTS: TestPatient[] = [
  {
    id: '1',
    name: 'María González',
    language: 'Spanish',
    languageCode: 'es',
    email: 'maria.gonzalez@email.com',
    request: `Estimada recepción de Oak Lane Medical Practice,

Mi nombre es María González y necesito solicitar una cita de rutina para mi chequeo anual. Soy paciente registrada desde hace tres años.

Me gustaría programar mi examen anual de salud general y también necesito renovar mis prescripciones habituales:
- Lisinopril 10mg para la presión arterial
- Simvastatina 20mg para el colesterol
- Vitamina D3

Mi última cita fue hace 13 meses con el Dr. Smith. También me gustaría hacerme los análisis de sangre de rutina que me hace cada año para revisar mi colesterol y función renal.

Prefiero citas por la mañana entre las 9:00 y 11:00 AM si es posible. Puedo venir cualquier día de la semana que viene o la siguiente.

Mi número de teléfono es 07123 456789.

Muchas gracias por su ayuda.

Atentamente,
María González
Fecha de nacimiento: 15/03/1985
Número de paciente: MG1985`,
    englishReply: `Dear Ms González,

Thank you for your request to schedule your annual health check-up and prescription renewals.

We are pleased to offer you an appointment with Dr. Smith on ${getNextWorkingDay(3)} at 10:30 AM for your comprehensive annual review. This will include:
- General health examination and blood pressure check
- Blood tests for cholesterol and kidney function  
- Review and renewal of your current medications (Lisinopril 10mg, Simvastatin 20mg, and Vitamin D3)

Please arrive 15 minutes early for your blood tests, and ensure you have been fasting for 12 hours beforehand (water is permitted). 

Your prescription renewals will be ready for collection 48 hours after your appointment, or we can arrange electronic prescriptions to your preferred pharmacy.

If you need to change this appointment, please call us on 01604 123456 at least 24 hours in advance.

Best regards,
Oak Lane Medical Practice Reception Team`
  },
  {
    id: '2',
    name: 'Ahmed Hassan',
    language: 'Arabic',
    languageCode: 'ar',
    email: 'ahmed.hassan@email.com',
    request: `إلى إدارة عيادة Oak Lane Medical Practice المحترمة،

اسمي أحمد حسن، مريض مسجل لديكم. أكتب لطلب نسخة من تقاريري الطبية لتقديمها لشركة التأمين الجديدة.

أحتاج إلى المستندات التالية:
- تقرير طبي كامل عن حالتي الصحية العامة
- نتائج فحوصات الدم من آخر ستة أشهر  
- تقرير عن ضغط الدم وإدارة الكوليسترول
- قائمة بجميع الأدوية الحالية

بدأت العمل في شركة جديدة وشركة التأمين الصحي تطلب هذه المستندات لتقييم تغطيتي. لدي موعد مع مقدم التأمين الأسبوع المقبل.

هل يمكن تحضير هذه المستندات خلال الأسبوع الحالي؟ يمكنني المرور لاستلامها شخصياً أو إرسالها بالبريد الإلكتروني إذا أمكن.

رقم هاتفي هو 07234 567890.

شكراً لتعاونكم،
أحمد حسن
تاريخ الميلاد: 22/07/1979
رقم المريض: AH1979`,
    englishReply: `Dear Mr Hassan,

Thank you for your request for medical documentation for your new health insurance provider.

We can prepare the following documents as requested:
- Complete medical summary report
- Blood test results from the past 6 months
- Blood pressure and cholesterol management report
- Current medications list

These documents will be ready for collection within 3-5 working days. There is an administrative fee of £25 for comprehensive medical reports as per NHS guidelines.

Please bring photo identification when collecting your documents. Alternatively, we can post them to your registered address (please allow an additional 2-3 days for delivery).

To proceed, please:
1. Complete the medical records request form (available at reception or on our website)
2. Pay the administrative fee
3. Confirm your preferred collection method

Please contact our reception team on 01604 123456 to arrange collection or if you have any questions.

Best regards,
Oak Lane Medical Practice Administration Team`
  },
  {
    id: '3',
    name: 'Chen Wei',
    language: 'Mandarin Chinese',
    languageCode: 'zh-CN',
    email: 'chen.wei@email.com',
    request: `尊敬的Oak Lane Medical Practice接待处：

我是陈伟，您的注册患者。我写信是想咨询关于预约专科医生转诊的事宜。

在上个月的检查中，Dr. Johnson建议我去看皮肤科专家，因为我背部有一颗痣最近发生了变化。他说需要进一步检查以确保没有问题。

我想了解：
- 转诊流程需要多长时间？
- 我需要提供额外的文件吗？
- 专科医生的预约通常需要等待多久？
- 这个检查我的NHS会覆盖吗？

我比较担心，所以希望能尽快安排。我的工作时间比较灵活，可以配合任何时间安排。

另外，我还想预约Dr. Johnson进行三个月后的随访检查，就像他建议的那样。

我的联系电话是07345 678901。

谢谢您的帮助。

陈伟
出生日期：1988年06月12日
患者编号：CW1988`,
    englishReply: `Dear Mr Chen,

Thank you for contacting us regarding your dermatology referral and follow-up concerns.

Following Dr. Johnson's recommendation, we have processed your urgent referral to the dermatology department. Here are the details:

**Referral Information:**
- Your referral was submitted on a 2-week urgent pathway due to the concerning mole changes
- You should receive an appointment letter within 5-7 working days
- Typical wait time for urgent dermatology appointments: 10-14 days
- This service is fully covered under NHS as it's medically necessary

**No additional documents are required** - we have included all relevant information from your consultation with Dr. Johnson.

**Follow-up Appointment:**
We have also scheduled your 3-month follow-up with Dr. Johnson for ${getNextWorkingDay(5)} at 2:15 PM. You will receive a confirmation text message.

If you don't receive your dermatology appointment letter within 7 days, please call us immediately on 01604 123456.

We understand your concerns and want to assure you that urgent referrals are processed quickly by our local NHS trust.

Best regards,
Oak Lane Medical Practice`
  },
  {
    id: '4',
    name: 'Jean-Pierre Dubois',
    language: 'French',
    languageCode: 'fr',
    email: 'jeanpierre.dubois@email.com',
    request: `Cher service administratif de Oak Lane Medical Practice,

Je suis Jean-Pierre Dubois, patient enregistré dans votre cabinet. Je vous écris concernant ma demande de renouvellement d'ordonnance.

Je prends régulièrement de la metformine 500mg deux fois par jour pour mon diabète de type 2. Mon ordonnance actuelle expire dans une semaine et j'aimerais la renouveler.

Mes derniers résultats d'HbA1c étaient excellents (6.8%) et mon médecin, Dr. Brown, était très satisfait de mon contrôle glycémique. Je continue de suivre le régime alimentaire recommandé et fais de l'exercice régulièrement.

Pourriez-vous préparer une nouvelle ordonnance pour trois mois? Je peux passer la récupérer à votre convenance ou si vous offrez un service de livraison, cela m'arrangerait beaucoup.

Je n'ai pas besoin de consultation pour le moment car je me sens très bien et tous mes paramètres sont stables.

Mon numéro de téléphone est 07456 789012.

Merci d'avance pour votre aide.

Cordialement,
Jean-Pierre Dubois
Date de naissance: 08/11/1962
Numéro patient: JPD1962`,
    englishReply: `Dear Mr Dubois,

Thank you for your prescription renewal request. We're pleased to hear that your diabetes management continues to be excellent.

**Prescription Renewal Approved:**
- Metformin 500mg tablets, twice daily
- 3-month supply (180 tablets) as requested
- Dr. Brown has approved the renewal based on your recent excellent HbA1c results

**Collection Options:**
1. **Pharmacy Collection**: Your prescription will be ready for collection from your nominated pharmacy within 48 hours
2. **Practice Collection**: Available from our reception desk from ${getNextWorkingDay(2)}
3. **Delivery Service**: We can arrange delivery through our pharmacy partner for a small fee (£3.50)

Please note: Your next routine diabetes review is due in 4 months. Reception will contact you closer to the time to schedule this appointment.

**Important:** Please continue your current diet and exercise routine, and don't hesitate to contact us if you notice any changes in your blood sugar levels or general health.

Your prescription reference number is: JPD062024

Best regards,
Oak Lane Medical Practice Clinical Team`
  },
  {
    id: '5',
    name: 'Priya Sharma',
    language: 'Hindi',
    languageCode: 'hi',
    email: 'priya.sharma@email.com',
    request: `प्रिय Oak Lane Medical Practice के रिसेप्शन टीम,

मैं प्रिया शर्मा हूँ और मैं अपनी बिलिंग की जानकारी के बारे में पूछना चाहती हूँ।

पिछले महीने मैंने अपने बेटे राहुल के लिए एक प्राइवेट अपॉइंटमेंट बुक किया था क्योंकि NHS की अपॉइंटमेंट में बहुत देर थी। Dr. Patel ने उसकी एक्जिमा के लिए दवा प्रेस्क्राइब की थी।

मुझे इन चीज़ों की जानकारी चाहिए:
- उस विज़िट का टोटल बिल कितना है?  
- क्या मेरी प्राइवेट हेल्थ इंश्योरेंस इसे कवर करेगी?
- मुझे रिसीप्ट और मेडिकल रिपोर्ट चाहिए इंश्योरेंस क्लेम के लिए
- क्या कोई अतिरिक्त चार्ज है जो मुझे पता नहीं?

कृपया मुझे सारी details ईमेल कर दें या मैं ऑफिस से कलेक्ट कर सकती हूँ। मेरी इंश्योरेंस कंपनी को ये documents next week तक चाहिए।

मेरा फ़ोन नंबर है 07567 890123।

धन्यवाद,
प्रिया शर्मा  
जन्म तारीख: 10/09/1990
Patient Number: PS1990`,
    englishReply: `Dear Ms Sharma,

Thank you for your inquiry regarding Rahul's recent private consultation billing details.

**Billing Summary for Rahul's Visit (${formatAppointmentDate(1)}):**
- Private consultation fee with Dr. Patel: £150.00
- Prescription administration: £10.00
- **Total Amount: £160.00**

**Insurance Information:**
Most private health insurance policies do cover consultations and prescribed treatments for children's conditions like eczema. However, coverage depends on your specific policy terms and whether you have pediatric coverage included.

**Documentation for Insurance Claim:**
We will prepare the following documents for your claim:
- Detailed receipt with itemized charges
- Medical consultation report from Dr. Patel
- Prescription details and treatment plan
- Practice letterhead confirmation

**Collection Options:**
- **Email**: We can send encrypted documents to your registered email address
- **Collection**: Available from reception Monday-Friday, 9:00 AM - 5:00 PM

All documents will be ready within 2 business days. There is no additional administrative charge for insurance documentation.

Please confirm your preferred delivery method by calling 01604 123456.

Best regards,
Oak Lane Medical Practice Billing Department`
  },
  {
    id: '6',
    name: 'Fatima Ali',
    language: 'Urdu',
    languageCode: 'ur',
    email: 'fatima.ali@email.com',
    request: `محترم Oak Lane Medical Practice کے ڈاکٹرز،

میں فاطمہ علی ہوں اور آپ کے یہاں رجسٹرڈ مریضہ ہوں۔ میں اپنے 6 ماہ کے بیٹے احمد کے لیے لکھ رہی ہوں۔

احمد کو پچھلے ہفتے سے ہلکا بخار ہے (37.8°C) اور اسے کھانسی بھی ہے۔ وہ رات میں ٹھیک سے نہیں سوتا اور دن میں بھی بے چین رہتا ہے۔

میں نے اسے پیراسٹامول کی بچوں والی دوا دی ہے جیسا کہ فارمیسی نے بتایا تھا، لیکن بخار آتا جاتا رہتا ہے۔ اس کی ناک بھی بند ہے اور وہ دودھ پینے میں مشکل کرتا ہے۔

کیا آپ اس ہفتے کوئی اپائنٹمنٹ دے سکتے ہیں؟ یہ کوئی ایمرجنسی نہیں ہے لیکن میں چاہتی ہوں کہ ڈاکٹر اسے دیکھ لیں۔

میرا فون نمبر 07678 901234 ہے۔

شکریہ،
فاطمہ علی
بیٹے کا نام: احمد علی (پیدائش: 15/03/2024)`,
    englishReply: `Dear Ms Ali,

Thank you for contacting us about baby Ahmed's symptoms. We understand your concern about his persistent fever and feeding difficulties.

**Urgent Appointment Available:**
We can offer you an appointment with Dr. Williams tomorrow (${getNextWorkingDay(1)}) at 2:30 PM to assess Ahmed's condition properly. For a 6-month-old with ongoing fever, we prefer to examine babies within 24-48 hours.

**Before Your Visit:**
- Continue giving infant paracetamol as directed (every 4-6 hours, not exceeding 4 doses in 24 hours)
- Monitor his temperature and note feeding patterns
- Bring his red book (health record)
- If his temperature exceeds 39°C or he becomes lethargic, please contact us immediately or visit A&E

**During Examination:**
Dr. Williams will check Ahmed's chest, ears, throat, and overall condition to rule out common infant infections like bronchiolitis or ear infections.

**Important:** If Ahmed develops difficulty breathing, becomes very lethargic, or refuses feeds completely before your appointment, please seek immediate medical attention.

Please confirm your attendance by calling 01604 123456 or replying to this message.

Best regards,
Oak Lane Medical Practice Pediatric Team`
  },
  {
    id: '7',
    name: 'Krzysztof Nowak',
    language: 'Polish',
    languageCode: 'pl',
    email: 'krzysztof.nowak@email.com',
    request: `Szanowni Państwo Lekarze z Oak Lane Medical Practice,

Jestem Krzysztof Nowak, jestem Państwa pacjentem od trzech lat. Piszę w sprawie problemów z plecami, które mnie dręczą od kilku tygodni.

Pracuję jako mechanik i często muszę dźwigać ciężkie części samochodowe. Około miesiąca temu poczułem silny ból w dolnej części pleców podczas pracy. Na początku myślałem, że to przejdzie samo, ale ból nadal się utrzymuje.

Objawy:
- Ból w dolnej części pleców, szczególnie rano
- Sztywność po dłuższym siedzeniu
- Ból promieniuje czasem do prawej nogi
- Problemy z pochylaniem się

Brałem ibuprofen przez dwa tygodnie, co trochę pomaga, but ból wraca. Żona mówi, że powinienem się zbadać, bo może to być dysk.

Czy mogliby Państwo umówić mnie na wizytę w przyszłym tygodniu? Nie jest to pilne, ale chciałbym się upewnić, czy nie jest to nic poważnego.

Mój numer telefonu: 07789 012345

Z poważaniem,
Krzysztof Nowak
Data urodzenia: 22/08/1975`,
    englishReply: `Dear Mr Nowak,

Thank you for contacting us about your back pain concerns. We understand how work-related back injuries can be persistent and concerning.

**Appointment Scheduled:**
We have arranged an appointment for you with Dr. Thompson on ${getNextWorkingDay(4)} at 3:00 PM. Dr. Thompson specializes in musculoskeletal conditions and will conduct a thorough assessment.

**Assessment Will Include:**
- Physical examination of your spine and posture
- Range of movement tests
- Neurological assessment (especially given the leg pain you mentioned)
- Discussion of work-related ergonomics and lifting techniques

**Before Your Appointment:**
- Continue taking ibuprofen as needed (maximum 400mg three times daily with food)
- Note when pain is worst and what activities aggravate it
- Avoid heavy lifting where possible until your assessment

**Red Flag Symptoms:** If you experience severe leg weakness, numbness in both legs, or bladder/bowel problems, please contact us immediately.

Based on your assessment, we may recommend physiotherapy, imaging, or workplace ergonomic adjustments. Many mechanical back injuries respond well to conservative treatment.

Please bring a list of your current medications and confirm your attendance on 01604 123456.

Best regards,
Oak Lane Medical Practice`
  },
  {
    id: '8',
    name: 'Rashida Begum',
    language: 'Bengali',
    languageCode: 'bn',
    email: 'rashida.begum@email.com',
    request: `সম্মানিত Oak Lane Medical Practice এর ডাক্তারবৃন্দ,

আমি রাশিদা বেগম, আমি আপনাদের এখানে নিবন্ধিত একজন রোগী। আমি আমার ১২ বছরের মেয়ে সাবিনার জন্য লিখছি।

সাবিনার কয়েক সপ্তাহ ধরে চর্মের সমস্যা হচ্ছে। তার মুখে এবং গলায় ছোট ছোট লাল দাগ দেখা দিয়েছে যা খুব চুলকায়। রাতে সে খুব চুলকানির কারণে ঠিকমতো ঘুমাতে পারে না।

আমি প্রথমে ভেবেছিলাম এটা গরমের কারণে হয়েছে, কিন্তু এখন আবহাওয়া ঠান্ডা হয়েছে তবুও সমস্যা রয়ে গেছে। আমি ফার্মেসি থেকে ক্যালামাইন লোশন কিনে দিয়েছি কিন্তু খুব একটা উপকার হচ্ছে না।

স্কুলের অন্যান্য বাচ্চাদেরও এরকম সমস্যা হয়েছে বলে শুনেছি। হয়তো এটা কোনো অ্যালার্জির কারণে হতে পারে।

দয়া করে এই সপ্তাহে বা পরের সপ্তাহে একটি অ্যাপয়েন্টমেন্ট দিতে পারেন? এটা জরুরি কিছু নয় কিন্তু আমি চাই ডাক্তার একবার দেখে নিন।

আমার ফোন নম্বর: 07890 123456

ধন্যবাদ,
রাশিদা বেগম
মেয়ের নাম: সাবিনা খাতুন (জন্ম তারিখ: ১৮/০৯/২০১২)`,
    englishReply: `Dear Ms Begum,

Thank you for your concern about Sabina's skin condition. We understand how disruptive persistent itching can be for children and their sleep.

**Appointment Arranged:**
We have booked Sabina for an appointment with Dr. Ahmed on ${getNextWorkingDay(2)} at 4:00 PM. Dr. Ahmed has experience with pediatric dermatology and will be able to properly diagnose the condition.

**Likely Conditions to Assess:**
Given your description and the fact that other school children have similar symptoms, Dr. Ahmed will examine for:
- Allergic contact dermatitis
- Viral skin infections common in schools
- Eczema flare-up
- Environmental allergies

**Before the Appointment:**
- Continue using calamine lotion for comfort
- Try to identify any new products (soaps, washing powder, etc.) that might be causing reactions
- Note if the rash worsens after specific activities or foods
- Take photos of the rash at its worst to show the doctor

**Treatment:** Once diagnosed, we can provide appropriate prescription treatments that are much more effective than over-the-counter options.

Please bring Sabina's school health record if available. If the itching becomes unbearable before your appointment, you can give age-appropriate antihistamine (Piriton) following packet instructions.

Best regards,
Oak Lane Medical Practice Pediatric Team`
  },
  {
    id: '9',
    name: 'Carlos Silva',
    language: 'Portuguese',
    languageCode: 'pt',
    email: 'carlos.silva@email.com',
    request: `Prezados médicos da Oak Lane Medical Practice,

Meu nome é Carlos Silva e sou paciente registrado há dois anos. Escrevo para solicitar uma consulta de rotina e também para discutir alguns sintomas menores que tenho sentido.

Há algumas semanas venho sentindo cansaço excessivo, mesmo após uma boa noite de sono. Trabalho como motorista de entrega e geralmente tenho energia para o trabalho, mas ultimamente me sinto mais fatigado que o normal.

Também tenho notado:
- Sede excessiva durante o dia
- Vontade de urinar mais frequente, especialmente à noite
- Perda de peso leve (cerca de 3-4 kg no último mês)
- Às vezes visão ligeiramente embaçada

Meu pai teve diabetes tipo 2, então estou preocupado que possa ter desenvolvido a mesma condição. Tenho 42 anos e admito que minha alimentação não tem sido a melhor - como muita comida fast food por causa do trabalho.

Gostaria de fazer uns exames de sangue e ter uma consulta geral. Não é uma emergência, mas prefiro verificar logo. Posso vir qualquer dia da semana após as 17h ou aos fins de semana.

Meu telefone: 07901 234567

Obrigado pela atenção,
Carlos Silva
Data de nascimento: 14/06/1982`,
    englishReply: `Dear Mr Silva,

Thank you for contacting us regarding your recent symptoms. Given your family history and the symptoms you've described, we agree that prompt assessment is important.

**Urgent Appointment Arranged:**
We have scheduled you for an appointment with Dr. Martinez on ${getNextWorkingDay(5)} at 5:30 PM. The symptoms you describe (excessive thirst, frequent urination, weight loss, fatigue) do require investigation for diabetes.

**Blood Tests Required:**
Please attend our practice on ${getNextWorkingDay(3)} at 8:00 AM (fasting for 12 hours) for the following tests:
- Fasting glucose and HbA1c (diabetes screening)
- Full blood count and kidney function
- Cholesterol profile
- Thyroid function

**Important Pre-Appointment Instructions:**
- No food or drink (except water) from 8:00 PM the night before your blood test
- Bring a list of any medications you currently take
- Continue to monitor your symptoms and note any changes

**Lifestyle Advice:**
While awaiting results, try to reduce fast food intake and stay well hydrated with water. Given your work as a delivery driver, ensure you're taking regular breaks and eating regular meals when possible.

Your proactive approach to addressing these symptoms is commendable. Early detection and management of diabetes (if present) leads to much better outcomes.

Best regards,
Oak Lane Medical Practice Clinical Team`
  },
  {
    id: '10',
    name: 'Ayşe Demir',
    language: 'Turkish',
    languageCode: 'tr',
    email: 'ayse.demir@email.com',
    request: `Sayın Oak Lane Medical Practice doktorları,

Ben Ayşe Demir, üç yıldır sizin hastanızım. Menopoza girdiğim için yaşadığım semptomlar hakkında görüşmek üzere randevu talep ediyorum.

Son altı ay içinde adet döngüm tamamen durdu (50 yaşındayım) ve çeşitli menopoz semptomları yaşıyorum:
- Günde 5-6 kez sıcak basması
- Gece terlemeleri nedeniyle uyku problemi  
- Mood değişiklikleri ve irritabilite
- Cilt kuruluğu
- Libido azalması

Bu semptomlar günlük yaşamımı etkilemeye başladı. Çalıştığım ofiste klima yanında bile sıcak basması oluyor ve utanıyorum. Geceleri ter nedeniyle uyanıyorum ve sabah yorgun hissediyorum.

Hormon replasman tedavisi hakkında bilgi almak istiyorum. Arkadaşlarım çeşitli tedaviler kullanıyor ama hangi seçeneğin benim için uygun olduğunu bilmiyorum.

Aile tarihimde meme kanseri yok ama annem osteoporoz geçirdi. Bu durumlar tedavi seçimimi etkiler mi merak ediyorum.

Bu ay içinde randevu alabilir miyim? Acil değil ama semptomlar günden güne artıyor.

Telefon numaram: 07012 345678

Saygılarımla,
Ayşe Demir  
Doğum tarihi: 23/04/1974`,
    englishReply: `Dear Ms Demir,

Thank you for contacting us about your menopause symptoms. We completely understand how disruptive these symptoms can be to your daily life and work.

**Appointment Scheduled:**
We have arranged a comprehensive menopause consultation with Dr. Roberts on ${getNextWorkingDay(3)} at 2:00 PM. Dr. Roberts specializes in women's health and hormone replacement therapy (HRT).

**Your Consultation Will Cover:**
- Full assessment of your menopausal symptoms
- Review of family history (particularly your mother's osteoporosis)
- Discussion of HRT options suitable for your profile
- Alternative treatments (non-hormonal options)
- Lifestyle modifications to help manage symptoms

**Before Your Appointment:**
- Keep a symptom diary for one week (noting hot flashes frequency, sleep disturbance, mood changes)
- List any medications/supplements you currently take
- Prepare questions about treatment options

**Treatment Options We'll Discuss:**
- Hormone replacement therapy (patches, tablets, gels)
- Non-hormonal medications for hot flashes
- Calcium and Vitamin D for bone health (given family history)
- Lifestyle approaches for symptom management

Given your family history of osteoporosis but no breast cancer history, you may be a good candidate for HRT, but we'll assess this thoroughly during your consultation.

Best regards,
Oak Lane Medical Practice Women's Health Team`
  },
  {
    id: '11',
    name: 'Elena Popescu',
    language: 'Romanian',
    languageCode: 'ro',
    email: 'elena.popescu@email.com',
    request: `Stimate domnule doctor de la Oak Lane Medical Practice,

Sunt Elena Popescu, pacientă înregistrată de aproximativ un an. Vă scriu pentru că am nevoie urgentă de ajutor medical pentru mama mea în vârstă de 78 de ani.

Mama locuiește cu mine și în ultimele două săptămâni starea ei s-a înrăutățit considerabil. Ea suferă de Alzheimer în stadiu moderat și de obicei îi gestionez bine medicația, dar acum am întâmpinat probleme.

Simptomele care mă îngrijorează:
- Confuzie sporită și agitație în serile
- Refuză să ia medicamentele (Donepezil și Memantine)
- Nu doarme noaptea și petrece timpul umblând prin casă
- A început să nu mă recunoască uneori
- A căzut de două ori în ultima săptămână

Eu lucrez ca asistentă medicală dar îngrijirea ei devine din ce în ce mai grea. Am nevoie de sfaturi despre cum să gestionez situația și poate ajustarea medicației.

Nu știu dacă aceasta este o progresie normală a bolii sau dacă s-a întâmplat ceva specific. De asemenea, am nevoie de informații despre serviciile de îngrijire la domiciliu disponibile.

Vă rog să-mi acordați o consultație în această săptămână dacă este posibil. Numărul meu de telefon este 07123 987654.

Cu stimă,
Elena Popescu
Data nașterii mama: 12/02/1946
Data nașterii mea: 30/08/1985`,
    englishReply: `Dear Ms Popescu,

Thank you for reaching out about your mother's deteriorating condition. As a healthcare worker yourself, we understand how challenging it must be to witness these changes in your mother while managing her care.

**Urgent Assessment Arranged:**
We have scheduled an urgent home visit with Dr. Patel and our community psychiatric nurse on ${getNextWorkingDay(2)} at 10:00 AM. Given your mother's increased confusion and falls risk, a home assessment will be more appropriate than bringing her to the surgery.

**The Assessment Will Include:**
- Review of current medications and possible adjustments
- Cognitive assessment and behavioral evaluation  
- Falls risk assessment and home safety review
- Discussion of care options and support services

**Immediate Safety Measures:**
- Consider removing trip hazards and installing night lights
- Lock away any potentially harmful items during nighttime wandering
- If medication refusal continues, we can discuss alternative formulations (liquid, dispersible tablets)

**Support Services Available:**
- Admiral Nurses (dementia specialist nurses) for ongoing support
- Adult Social Care assessment for care package options
- Carers Direct helpline: 0300 123 1053
- Local dementia day centers for respite care

**Before the Visit:**
- Prepare a list of all current medications and when she last took them
- Note specific times when agitation is worst
- Document the falls (time, location, any injuries)

The behavioral changes you're describing can indicate progression but may also be caused by infections, medication interactions, or environmental factors - all of which are treatable.

Your dedication to your mother's care is admirable, but please don't hesitate to accept support services when offered.

Best regards,
Oak Lane Medical Practice Elderly Care Team`
  },
  {
    id: '12',
    name: 'Hassan Al-Rashid',
    language: 'Persian (Farsi)',
    languageCode: 'fa',
    email: 'hassan.alrashid@email.com',
    request: `به دکترهای محترم مطب Oak Lane Medical Practice،

من حسن الرشید هستم و حدود شش ماه است که در این منطقه زندگی می‌کنم و به تازگی در مطب شما ثبت نام کرده‌ام.

من از افغانستان آمده‌ام و درحال حاضر در حال انتظار بررسی درخواست پناهندگی‌ام هستم. مشکلات جسمی و روانی متعددی دارم که نیاز به توجه پزشکی فوری دارند.

مشکلات جسمی:
- درد مزمن در کمر و زانو در اثر آسیب‌های قدیمی
- سردرد شدید تقریباً روزانه
- مشکل در خواب (تنها ۲-۳ ساعت در شب می‌خوابم)
- کاهش اشتها و کاهش وزن

مشکلات روانی:
- کابوس‌های شدید و خاطرات دردناک
- احساس اضطراب شدید، به‌خصوص در اماکن عمومی
- احساس افسردگی و بی‌امیدی
- ترس از صداهای بلند

این مشکلات کار روزانه‌ام را تحت تأثیر قرار داده و نمی‌توانم به درستی فعالیت کنم. در کشورم پزشک بودم ولی اینجا نمی‌توانم کار کنم.

لطفاً برای هفته آینده برایم وقت ملاقات بگیرید. همچنین اگر مترجم لازم است، لطفاً اطلاع دهید.

شماره تماس من: 07234 876543

با تشکر،
حسن الرشید
تاریخ تولد: ۱۵/۰۳/۱۳۵۸ (به تاریخ شمسی)`,
    englishReply: `Dear Dr Al-Rashid,

Thank you for registering with our practice and for sharing your health concerns with us. We understand the significant challenges you're facing both physically and mentally, and we want to provide comprehensive care to help you.

**Urgent Appointment Arranged:**
We have scheduled you for an extended consultation with Dr. Khan on ${getNextWorkingDay(2)} at 9:00 AM. Dr. Khan speaks Farsi and has experience working with refugees and asylum seekers, so you won't need an interpreter.

**Your Assessment Will Include:**
- Full physical examination for your back, knee, and headache concerns
- Mental health screening for PTSD, anxiety, and depression
- Sleep disorder assessment
- Review of your medical history from Afghanistan (if you have any documents)

**Services We Can Offer:**
- Pain management for chronic back and knee pain
- Specialist referral to refugee mental health services
- Sleep clinic referral if needed
- Connection with local refugee support organizations
- Help with medical documentation for your asylum case if required

**Before Your Appointment:**
- Bring any medical documents you have from Afghanistan
- List all symptoms with dates when they started
- Note your current living situation and any support you're receiving

**Mental Health Support:**
We work closely with specialized services for refugees experiencing trauma. These services are confidential and will not affect your asylum case.

**Important:** Your medical information is completely confidential and separate from immigration services. Our priority is your health and wellbeing.

We respect your medical background and understand the additional stress of not being able to practice your profession here. We'll discuss potential pathways for medical qualification recognition when you're ready.

Best regards,
Oak Lane Medical Practice Refugee Health Team`
  },
  {
    id: '13',
    name: 'Rojin Khalil',
    language: 'Kurdish',
    languageCode: 'ku',
    email: 'rojin.khalil@email.com',
    request: `Bijî doktorên hêja yên Oak Lane Medical Practice,

Ez Rojin Khalil me, ji du mehan e ku li ser navenda we tomar bûme. Ji Kurdistana Îraqê hatim û niha li vir li dijwar xwendina azîlê me.

Min pirsgirêkên ciddî yên tendurustiyê hene ku pêdivî bi çareseriyek zû heye:

Pirsgirêkên jin:
- Ji sê mehan e ku mehane nayê (pregnant nînim)
- Birîna kevn li ser lingê min ku hê nebaş bûye
- Birîna bi her ku li ser serê min heye ji şerê

Pirsgirêkên rûhî:
- Kêşanên xewê, xewnên nebaş
- Tirs ji dengên bilind û camêriyên zû
- Kul û mixabin
- Naxwazim ji malê derkevim

Min du zarok hene (5 û 8 salî) û ew jî têne bandor kirin ji rewşa min. Zarokên min jî pêdivî bi lêkolînê heye:
- Kurê min pirî qise nake (5 salî)
- Keça min di dibistanê de zehmet dikişîne (8 salî)

Em ji 2019an e ku ji Îraqê hatine, lê dîsa jî çêtir nabîn. Gava berî vê jî me ji doktorekî alî girt, lê ew tenê dermanan da û kêm alîkarî kir.

Heke meriv pêkan be, ez dixwazim doktoreke jin bibînim. Heke muterjim hewce be, ji kerema xwe zanî bidin.

Jimara min: 07345 567890

Bi rêzdarî,
Rojin Khalil
Dîroka jidayîkbûnê: 20/07/1990`,
    englishReply: `Dear Ms Khalil,

Thank you for trusting us with your and your children's health concerns. We understand the challenges your family has faced, and we are committed to providing culturally sensitive care.

**Family Assessment Arranged:**
We have scheduled appointments for your entire family:
- **You**: ${getNextWorkingDay(2)} at 2:00 PM with Dr. Sarah Ahmed (female doctor who works extensively with Kurdish families)
- **Your children**: ${getNextWorkingDay(3)} at 10:00 AM with our pediatric specialist Dr. Williams

**Interpreter Services:**
We have arranged a certified Kurdish interpreter for both appointments to ensure clear communication about all your concerns.

**Your Healthcare Assessment Will Cover:**
- Gynecological examination regarding missed periods (hormone testing, health screening)
- Assessment of your leg and head injuries with possible referral to specialists
- Mental health evaluation for PTSD and trauma-related symptoms
- Discussion of treatment options that respect your cultural preferences

**Children's Assessment:**
- Speech and language evaluation for your 5-year-old son
- Educational and behavioral assessment for your 8-year-old daughter
- Trauma-informed care approach for both children

**Additional Support Services:**
- Kurdish Women's Support Group (meets weekly)
- Children's trauma counseling with Kurdish-speaking therapists
- Family therapy services specializing in refugee families
- Educational support liaison for school-related difficulties

**Important:**
- All services are confidential and will not affect your asylum case
- We work with many Kurdish families and understand cultural sensitivities
- Treatment plans will be developed in collaboration with you

**Before Your Appointments:**
- Bring any medical records or documents from Iraq if available
- List all current symptoms with dates
- Prepare questions about your concerns

Your strength in seeking help for your family is commendable. We will work together to improve your family's health and wellbeing.

Best regards,
Oak Lane Medical Practice Multicultural Health Team`
  },
  {
    id: '14',
    name: 'Ahmad Shah Ahmadi',
    language: 'Pashto',
    languageCode: 'ps',
    email: 'ahmad.ahmadi@email.com',
    request: `د Oak Lane Medical Practice محترمو ډاکټرانو ته،

زه احمد شاه احمدي یم او د دوو میاشتو راهیسې ستاسو د کلینیک د ناروغانو په لیست کې شامل یم. زه د افغانستان څخه راغلی یم او اوس د پناه غوښتونکي په توګه دلته اوسیږم.

زه ډیری جدي روغتیایي ستونزې لرم چې د سمدستي پاملرنې ضرورت لري:

د زړه ستونزې:
- د زړه د خپګان د تیزۍ احساس په ځانګړي توګه د شپې
- د ساه اخیستلو کښتۍ د کار پر مهال
- د ګونډیو پړسوب په سهار کې
- د سینې درد

د رواني روغتیا ستونزې:
- د خوب نشتوالی (یوازې ۱-۲ ساعته خوب)
- د دردناکو پیښو بیا یادونه
- د ډیر اضطراب احساس
- د خپلوانو غم چې په افغانستان کې پاتې شوي

په افغانستان کې زه د پوځ افسر وم مګر اوس نشم کولی کار وکړم. زما کورنۍ (میرمن او درې ماشومان) هم دلته دي مګر موږ ټول د دغو ستونزو سره مخ یو.

که چیرې امکان ولري، غواړم له یو نارینه ډاکټر سره وګورم ځکه دا زموږ د کلتور برخه ده. که ژباړونکي ته اړتیا وي، مهرباني وکړئ راته ووایاست.

زما د تماس شمیره: 07456 678901

د درناوي سره،
احمد شاه احمدي
د زیږیدنې نیټه: ۱۰/۰۵/۱۳۵۵ (شمسي نیټه)`,
    englishReply: `Dear Mr Ahmadi,

Thank you for entrusting us with your health concerns. We understand the significant challenges you and your family are facing, and we honor your service as a military officer in Afghanistan.

**Urgent Cardiac Assessment Arranged:**
Given your heart-related symptoms, we have prioritized your case:
- **Emergency ECG and Blood Tests**: ${getNextWorkingDay(1)} at 8:00 AM
- **Consultation with Dr. Mohammad Kazemi**: ${getNextWorkingDay(1)} at 10:00 AM (male doctor, speaks Pashto)

**Your Assessment Will Include:**
- Comprehensive cardiac examination and ECG
- Blood pressure monitoring and heart rhythm assessment
- Blood tests for cardiac markers and general health
- Chest X-ray to evaluate heart and lungs
- Mental health screening for trauma and anxiety

**Family Care Coordination:**
We would also like to assess your family's health needs:
- Health screening for your wife and three children
- Educational support coordination for your children
- Family counseling services with Afghan cultural understanding

**Interpreter and Cultural Support:**
- Dr. Kazemi speaks Pashto fluently, so no interpreter needed for your consultation
- We work with Afghan Community Centre for additional cultural support
- All care will respect Islamic principles and Afghan cultural values

**Immediate Safety Instructions:**
If you experience severe chest pain, difficulty breathing, or feel faint before your appointment, please:
- Call 999 immediately or go to A&E
- Call our practice on 01604 123456

**Additional Services:**
- Veterans' mental health services (we recognize your military service)
- Benefits and housing support through refugee organizations
- Employment guidance programs for former military personnel

Your courage in seeking help demonstrates strong leadership for your family. We are committed to providing comprehensive care that respects your background and honors your service.

Best regards,
Oak Lane Medical Practice Veterans & Refugee Health Team`
  },
  {
    id: '15',
    name: 'Meron Tesfaye',
    language: 'Tigrinya',
    languageCode: 'ti',
    email: 'meron.tesfaye@email.com',
    request: `ንኹሉ ዓቕሚ ዘለዎም ሓኪማት ናይ Oak Lane Medical Practice፣

ሰላም፡ ዓደይ መሮን ተስፋየ እየ። ኻብ ኤርትራ ወጺየ ኣብዚ ሃገር እዚ ኣብ ዘለኹዎ ክልተ ዓመት ኸይተሓልፈ እዩ። ኣብ ክሊኒክኹም ዝተመዝገብኩ ሕሉፍ ሰዱስተ ኸውሒ እዩ።

ካብ ዝሓለፈ ግዜ ጀሚሩ ብዙሓት ዘሰክፍ ጥዕናዊ ጸገማት ኣጋጢሞምኒ ኣለዉ፣

ናይ ዓመታዊ ጥዕና ጸገማት፣
- ኣብ እዋን ነርሲ ድማ ብዙሕ ደም ይወጽእ
- ኣብ ትሕቲ ከብዲ ኣብ ኣጻብዕትይ የሕዝንን
- ማህጸን ኣራኪብካ ብርቱዕ ደገም ይወዛወዝ
- ብሃንደበት ክብደት ይጽንሖ

ናይ ኣእምሮ ጥዕና ጸገማት፣
- ብሻዱሻ ዘይምድቃስን
- ሓዘንትን መከራን ዝመልእ ሓሳብ
- ማዕረ ምቅራብ ናይ ሰባት ፍርሒ
- ናይ ዝሓለፈ እዋን ዝኾነ ተሞኩሮ ብቀዚፍ ምዝካር

ኣብ ኤርትራ ንሰላሳን ሓሙሽተን ዓመት ኣስተምህሮ ነይረ። ኣብዚ ድማ ክሰርሕ ኣይክእልን እየ ምኽንያቱ ናይ ዓለም ብርኪ የሌንን። እዚ ኸ ኣዝዩ ይጻወረኒ።

ሞንጎ ናይ ብርኪ ኣድላዪ እንተኾይኑ፡ እንብርሃኒ። ኣንስተይቲ ዝኾነት ሓኪማት ምስ እፈትወላ እየ እቲ ምኽንያት ናይ ባህላዊ ነገር እዩ።

ናይ ርክብ ቁጽረይ፣ 07567 789012

ብኽብሪ፣
መሮን ተስፋየ  
ዕለተ ልደት፣ 25/11/1985`,
    englishReply: `Dear Ms Tesfaye,

Thank you for sharing your health concerns with us. We deeply respect your background as an educator and understand the challenges you're facing in adapting to life in the UK.

**Comprehensive Women's Health Assessment Arranged:**
We have scheduled you with Dr. Fatima Al-Zahra (female specialist) on ${getNextWorkingDay(2)} at 11:00 AM, with follow-up appointments as needed.

**Your Assessment Will Include:**
- Gynecological examination for heavy menstrual bleeding and abdominal pain
- Blood tests to check for anemia, hormones, and general health
- Ultrasound scan to investigate pelvic pain and irregular periods
- Mental health evaluation for trauma, depression, and anxiety symptoms

**Interpreter Services:**
We have arranged a certified Tigrinya interpreter for your appointments to ensure you can fully express all your concerns and understand your treatment options.

**Specialist Referrals Available:**
- Gynecology specialist for menstrual irregularities
- Women's mental health services with trauma expertise
- Eritrean community support groups for professional women
- Career counseling for international educators seeking UK qualification recognition

**Cultural Sensitivity:**
- All female healthcare team for your intimate examinations
- Prayer/cultural accommodation during appointments
- Halal dietary considerations for any medications
- Respect for traditional healing practices alongside medical treatment

**Educational Qualification Support:**
We can connect you with organizations that help international teachers gain UK teaching qualifications, as we understand how important your profession is to your identity.

**Before Your Appointment:**
- Bring any medical documents from Eritrea if available
- Track your menstrual cycle and symptoms for one week
- List all concerns, both physical and emotional

Your courage in seeking help while maintaining your dignity and cultural values is commendable. We are here to support your complete wellbeing.

Best regards,
Oak Lane Medical Practice Women's Health & Cultural Services Team`
  },
  {
    id: '16',
    name: 'Cerys Williams',
    language: 'Welsh',
    languageCode: 'cy',
    email: 'cerys.williams@email.com',
    request: `Annwyl Oak Lane Medical Practice,

Cerys Williams ydw i, ac rwy'n glaf cofrestredig ers tair blynedd. Rwy'n ysgrifennu i ofyn am help gyda sawl mater gweinyddol.

Yn gyntaf, mae angen copi o fy nghofnodion meddygol arnaf ar gyfer yswiriant iechyd newydd fy nghyflogwr. Mae'r cwmni yswiriant yn gofyn am:
- Crynodeb meddygol cyflawn o'r 5 mlynedd diwethaf
- Manylion unrhyw gyflyrau parhaus (mae gen i bwysedd gwaed uchel)
- Rhestr o'r holl feddyginiaethau cyfredol
- Canlyniadau profion gwaed diweddar

Yn ail, hoffwn newid fy fferyllfa gofrestredig o Boots i'r fferyllfa leol Lloyds sydd ger fy ngwaith newydd. Mae hyn yn fwy cyfleus i mi gasglu presgripsiynau.

Yn drydydd, mae angen i mi drefnu apwyntiad adolygu blynyddol ar gyfer fy mhwysedd gwaed uchel. Mae'r Dr. Jones wedi dweud y dylwn gael adolygiad bob 6 mis, ond mae dros 8 mis ers fy apwyntiad diwethaf.

Hefyd, a yw hi'n bosibl cael presgripsiynau 3 mis yn hytrach na mis ar gyfer fy meddyginiaeth Amlodipine? Mae'n anodd dod i'r fferyllfa bob mis oherwydd fy oriau gwaith.

Os oes unrhyw ffioedd gweinyddol, rhowch wybod i mi os gwelwch yn dda.

Fy rhif ffôn: 07678 345123

Diolch yn fawr am eich help,
Cerys Williams
Dyddiad geni: 12/04/1988
Rhif claf: CW1988`,
    englishReply: `Dear Ms Williams,

Thank you for your administrative requests. We're happy to help you with these important matters.

**Medical Records for Insurance:**
We can provide the comprehensive medical summary you've requested for your employer's health insurance. This will include:
- Complete 5-year medical history summary
- Current hypertension management details and blood pressure readings
- Current medications list (Amlodipine and any others)
- Recent blood test results and monitoring data

**Administrative Details:**
- Processing time: 5-7 working days
- Fee: £25 for comprehensive medical records (as per NHS guidelines)
- Collection: Available from reception or posted to your address

**Pharmacy Transfer:**
We'll arrange the transfer of your repeat prescriptions from Boots to Lloyds Pharmacy. Please provide:
- Full address of the new Lloyds pharmacy
- Confirmation you've registered with them
- Transfer will be effective from your next prescription

**Annual Blood Pressure Review:**
You're absolutely right that your review is overdue. We've scheduled your annual hypertension review with Practice Nurse Sarah on ${getNextWorkingDay(4)} at 3:30 PM. This will include:
- Blood pressure monitoring and medication review
- Routine blood tests (kidney function, cholesterol if due)
- Lifestyle advice and blood pressure targets

**3-Month Prescriptions:**
We can arrange 3-month supplies of Amlodipine, which will be much more convenient for you. Dr. Jones has approved this change, and it will start with your next prescription.

**To Proceed:**
1. Complete the medical records request form (available at reception)
2. Pay the £25 administrative fee
3. Confirm your new pharmacy details
4. Attend your scheduled blood pressure review

Please call reception on 01604 123456 to confirm these arrangements.

Best regards,
Oak Lane Medical Practice Administration Team`
  }
];