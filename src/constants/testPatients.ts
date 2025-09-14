export interface TestPatient {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  email: string;
  request: string;
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
Número de paciente: MG1985`
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
رقم المريض: AH1979`
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
患者编号：CW1988`
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
Numéro patient: JPD1962`
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
Patient Number: PS1990`
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
بیٹے کا نام: احمد علی (پیدائش: 15/03/2024)`
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

Brałem ibuprofen przez dwa tygodnie, co trochę pomaga, ale ból wraca. Żona mówi, że powinienem się zbadać, bo może to być dysk.

Czy mogliby Państwo umówić mnie na wizytę w przyszłym tygodniu? Nie jest to pilne, ale chciałbym się upewnić, czy nie jest to nic poważnego.

Mój numer telefonu: 07789 012345

Z poważaniem,
Krzysztof Nowak
Data urodzenia: 22/08/1975`
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
মেয়ের নাম: সাবিনা খাতুন (জন্ম তারিখ: ১৮/০৯/২০১২)`
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
Data de nascimento: 14/06/1982`
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
Doğum tarihi: 23/04/1974`
  }
];