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
    request: `Estimados doctores de Oak Lane Medical Practice,

Mi nombre es María González y soy paciente registrada en su consulta. Escribo porque he estado experimentando dolor de cabeza severo durante los últimos tres días, junto con náuseas y sensibilidad a la luz. También tengo fiebre de aproximadamente 38.5°C.

Estos síntomas comenzaron de repente el lunes por la mañana y han empeorado gradualmente. El dolor de cabeza es muy intenso, especialmente en el lado derecho de mi cabeza, y los analgésicos que normalmente tomo no están ayudando.

Estoy preocupada porque estos síntomas son muy diferentes a los dolores de cabeza normales que ocasionalmente tengo. ¿Podrían agendar una cita urgente para hoy o mañana? Mi número de teléfono es 07123 456789.

Gracias por su atención.

Atentamente,
María González
Fecha de nacimiento: 15/03/1985`
  },
  {
    id: '2',
    name: 'Ahmed Hassan',
    language: 'Arabic',
    languageCode: 'ar',
    email: 'ahmed.hassan@email.com',
    request: `إلى عيادة Oak Lane Medical Practice المحترمة،

اسمي أحمد حسن وأنا مريض مسجل لديكم. أكتب إليكم لأنني أعاني من ألم شديد في الصدر منذ البارحة. الألم يأتي على شكل نوبات ويستمر لحوالي 10-15 دقيقة في كل مرة.

الألم يشع إلى ذراعي اليسرى وأشعر أيضاً بضيق في التنفس وتعرق. لدي تاريخ عائلي من أمراض القلب - والدي أصيب بنوبة قلبية عندما كان في الخمسين من عمره.

عمري 45 سنة وأعمل في وظيفة مكتبية مع الكثير من الضغط. أدخن حوالي 20 سيجارة يومياً منذ 20 سنة. أعلم أنني يجب أن أقلع عن التدخين ولكن لم أستطع حتى الآن.

هل يمكنكم رؤيتي اليوم؟ أنا قلق جداً حول هذه الأعراض. رقم هاتفي هو 07234 567890.

شكراً لكم،
أحمد حسن
تاريخ الميلاد: 22/07/1979`
  },
  {
    id: '3',
    name: 'Chen Wei',
    language: 'Mandarin Chinese',
    languageCode: 'zh-CN',
    email: 'chen.wei@email.com',
    request: `尊敬的Oak Lane Medical Practice医生们：

我叫陈伟，是您的注册患者。我写信是因为我的2岁女儿陈小雨出现了令人担忧的症状。

从昨天开始，小雨发高烧39.2°C，并且出现了皮疹。皮疹开始出现在她的脸部，现在正在扩散到身体其他部位。皮疹看起来像小红点，有些地方聚集在一起。

她还出现了以下症状：
- 食欲不振，几乎不吃任何东西
- 异常烦躁和哭闹
- 睡眠不好
- 轻微咳嗽
- 眼睛红肿，有分泌物

我给她服用了儿童退烧药，但发烧仍然很高。我很担心这可能是麻疹或其他严重的传染病。她已经按时接种了所有疫苗，但我仍然担心。

请问今天能安排紧急预约吗？我的手机号码是07345 678901。

谢谢您的帮助。

陈伟
女儿：陈小雨（出生日期：2022年03月10日）`
  },
  {
    id: '4',
    name: 'Jean-Pierre Dubois',
    language: 'French',
    languageCode: 'fr',
    email: 'jeanpierre.dubois@email.com',
    request: `Chers médecins de Oak Lane Medical Practice,

Je suis Jean-Pierre Dubois, patient enregistré dans votre cabinet. Je vous écris concernant un problème urgent avec ma prescription habituelle.

Je prends de la metformine 500mg deux fois par jour pour mon diabète de type 2 depuis les cinq dernières années. Hier, quand je suis allé à la pharmacie pour récupérer ma prescription mensuelle, on m'a dit qu'il n'y avait plus de stock et qu'ils ne pourraient pas avoir ce médicament avant la semaine prochaine.

Je n'ai plus que trois comprimés restants, ce qui me donnera jusqu'à demain soir. Je suis très inquiet car je sais qu'arrêter brutalement la metformine peut être dangereux pour mon contrôle glycémique.

Mon dernier HbA1c était de 7.2% il y a trois mois, et j'ai réussi à bien contrôler mon diabète avec ce médicament. Je mange sainement et fais de l'exercice régulièrement comme vous me l'avez recommandé.

Pourriez-vous prescrire un médicament alternatif ou m'aider à trouver une pharmacie qui a de la metformine en stock? Mon numéro de téléphone est 07456 789012.

Je vous remercie de votre aide urgente.

Cordialement,
Jean-Pierre Dubois
Date de naissance: 08/11/1962`
  },
  {
    id: '5',
    name: 'Priya Sharma',
    language: 'Hindi',
    languageCode: 'hi',
    email: 'priya.sharma@email.com',
    request: `प्रिय Oak Lane Medical Practice के डॉक्टरों,

मैं प्रिया शर्मा हूँ और आपके यहाँ रजिस्टर्ड मरीज़ हूँ। मैं अपनी माँ के बारे में लिख रही हूँ जो 68 साल की हैं और पिछले दो दिनों से बहुत बीमार हैं।

मेरी माँ को ये लक्षण हैं:
- तेज़ बुखार (39.5°C)
- सांस लेने में तकलीफ़
- छाती में दर्द
- सूखी खाँसी जो बदतर होती जा रही है
- बहुत कमज़ोरी और थकान

उन्हें डायबिटीज़ और हाई ब्लड प्रेशर है, और वे नियमित दवाइयाँ लेती हैं। कल रात उनकी हालत और भी खराब हो गई और वे ठीक से सो नहीं पाईं।

मैं बहुत चिंतित हूँ क्योंकि ये COVID-19 जैसे लक्षण लग रहे हैं, या फिर निमोनिया हो सकता है। उन्होंने अपनी सारी वैक्सीन लगवाई हैं लेकिन फिर भी मैं डरी हुई हूँ।

क्या आज ही कोई अपॉइंटमेंट मिल सकता है? अगर ज़रूरत हो तो हम तुरंत आ सकते हैं। मेरा फ़ोन नंबर है 07567 890123।

कृपया जल्दी जवाब दें।

धन्यवाद,
प्रिया शर्मा
माँ का नाम: सुशीला शर्मा (जन्म तारीख: 12/01/1956)`
  }
];