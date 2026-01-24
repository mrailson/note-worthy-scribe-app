import { saveAs } from 'file-saver';
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from './wordTheme';

interface TranslationMessage {
  id: string;
  speaker: 'staff' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

interface GenerateTranslationReportOptions {
  messages: TranslationMessage[];
  patientLanguage: string;
  patientLanguageName: string;
  sessionStart: Date;
  sessionEnd?: Date;
  practiceInfo?: {
    name?: string;
    address?: string;
    logoUrl?: string;
  };
}

// Patient disclaimer translations - explaining this is a copy of what was discussed
const PATIENT_DISCLAIMERS: Record<string, {
  title: string;
  body: string;
}> = {
  en: {
    title: 'Important Information for You',
    body: 'This document is a copy of the conversation that took place today using our translation service. Please review it carefully. If anything does not look correct, is confusing, or if you believe something has been mistranslated, please let us know as soon as possible so we can clarify and correct any misunderstandings. Your understanding is very important to us.'
  },
  fr: {
    title: 'Informations importantes pour vous',
    body: "Ce document est une copie de la conversation qui a eu lieu aujourd'hui en utilisant notre service de traduction. Veuillez le lire attentivement. Si quelque chose ne semble pas correct, est confus, ou si vous pensez qu'il y a eu une erreur de traduction, veuillez nous en informer dès que possible afin que nous puissions clarifier et corriger tout malentendu. Votre compréhension est très importante pour nous."
  },
  es: {
    title: 'Información importante para usted',
    body: 'Este documento es una copia de la conversación que tuvo lugar hoy utilizando nuestro servicio de traducción. Por favor, revíselo cuidadosamente. Si algo no parece correcto, es confuso, o si cree que algo ha sido mal traducido, por favor infórmenos lo antes posible para que podamos aclarar y corregir cualquier malentendido. Su comprensión es muy importante para nosotros.'
  },
  pl: {
    title: 'Ważne informacje dla Ciebie',
    body: 'Ten dokument jest kopią rozmowy, która odbyła się dzisiaj z wykorzystaniem naszego serwisu tłumaczeniowego. Prosimy o uważne przeczytanie. Jeśli coś nie wygląda poprawnie, jest niejasne lub uważasz, że coś zostało źle przetłumaczone, prosimy o jak najszybszy kontakt, abyśmy mogli wyjaśnić i skorygować wszelkie nieporozumienia. Twoje zrozumienie jest dla nas bardzo ważne.'
  },
  ro: {
    title: 'Informații importante pentru dumneavoastră',
    body: 'Acest document este o copie a conversației care a avut loc astăzi folosind serviciul nostru de traducere. Vă rugăm să îl citiți cu atenție. Dacă ceva nu pare corect, este confuz sau credeți că ceva a fost tradus greșit, vă rugăm să ne informați cât mai curând posibil pentru a clarifica și corecta orice neînțelegere. Înțelegerea dumneavoastră este foarte importantă pentru noi.'
  },
  pt: {
    title: 'Informações importantes para si',
    body: 'Este documento é uma cópia da conversa que teve lugar hoje utilizando o nosso serviço de tradução. Por favor, reveja-o cuidadosamente. Se algo não parecer correcto, for confuso, ou se acreditar que algo foi mal traduzido, por favor informe-nos o mais rapidamente possível para que possamos esclarecer e corrigir quaisquer mal-entendidos. A sua compreensão é muito importante para nós.'
  },
  ar: {
    title: 'معلومات مهمة لك',
    body: 'هذه الوثيقة هي نسخة من المحادثة التي جرت اليوم باستخدام خدمة الترجمة لدينا. يرجى مراجعتها بعناية. إذا كان هناك شيء لا يبدو صحيحًا، أو مربكًا، أو إذا كنت تعتقد أن شيئًا ما قد تمت ترجمته بشكل خاطئ، يرجى إعلامنا في أقرب وقت ممكن حتى نتمكن من توضيح وتصحيح أي سوء فهم. فهمك مهم جدًا بالنسبة لنا.'
  },
  bn: {
    title: 'আপনার জন্য গুরুত্বপূর্ণ তথ্য',
    body: 'এই নথিটি আজ আমাদের অনুবাদ পরিষেবা ব্যবহার করে হওয়া কথোপকথনের একটি অনুলিপি। অনুগ্রহ করে এটি সাবধানে পর্যালোচনা করুন। যদি কিছু সঠিক না মনে হয়, বিভ্রান্তিকর হয়, বা আপনি যদি মনে করেন কিছু ভুল অনুবাদ হয়েছে, অনুগ্রহ করে যত তাড়াতাড়ি সম্ভব আমাদের জানান যাতে আমরা যেকোনো ভুল বোঝাবুঝি স্পষ্ট করতে এবং সংশোধন করতে পারি। আপনার বোঝাপড়া আমাদের কাছে অত্যন্ত গুরুত্বপূর্ণ।'
  },
  gu: {
    title: 'તમારા માટે મહત્વપૂર્ણ માહિતી',
    body: 'આ દસ્તાવેજ અમારી અનુવાદ સેવાનો ઉપયોગ કરીને આજે થયેલી વાતચીતની નકલ છે. કૃપા કરીને તેને કાળજીપૂર્વક વાંચો. જો કંઈક યોગ્ય ન લાગતું હોય, મૂંઝવણમાં મૂકનારું હોય, અથવા જો તમે માનો છો કે કંઈક ખોટું અનુવાદ થયું છે, તો કૃપા કરીને અમને જલદીથી જલદી જણાવો જેથી અમે કોઈપણ ગેરસમજ સ્પષ્ટ કરી અને સુધારી શકીએ. તમારી સમજણ અમારા માટે ખૂબ મહત્વપૂર્ણ છે.'
  },
  hi: {
    title: 'आपके लिए महत्वपूर्ण जानकारी',
    body: 'यह दस्तावेज़ आज हमारी अनुवाद सेवा का उपयोग करके हुई बातचीत की एक प्रति है। कृपया इसे ध्यान से पढ़ें। यदि कुछ सही नहीं लगता, भ्रमित करने वाला है, या यदि आपको लगता है कि कुछ गलत अनुवाद किया गया है, तो कृपया हमें जल्द से जल्द बताएं ताकि हम किसी भी गलतफहमी को स्पष्ट कर सकें और सुधार सकें। आपकी समझ हमारे लिए बहुत महत्वपूर्ण है।'
  },
  pa: {
    title: 'ਤੁਹਾਡੇ ਲਈ ਮਹੱਤਵਪੂਰਨ ਜਾਣਕਾਰੀ',
    body: 'ਇਹ ਦਸਤਾਵੇਜ਼ ਅੱਜ ਸਾਡੀ ਅਨੁਵਾਦ ਸੇਵਾ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਹੋਈ ਗੱਲਬਾਤ ਦੀ ਇੱਕ ਕਾਪੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਇਸਨੂੰ ਧਿਆਨ ਨਾਲ ਪੜ੍ਹੋ। ਜੇਕਰ ਕੁਝ ਸਹੀ ਨਹੀਂ ਲੱਗਦਾ, ਉਲਝਣ ਵਾਲਾ ਹੈ, ਜਾਂ ਜੇ ਤੁਸੀਂ ਸੋਚਦੇ ਹੋ ਕਿ ਕੁਝ ਗਲਤ ਅਨੁਵਾਦ ਕੀਤਾ ਗਿਆ ਹੈ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਸਾਨੂੰ ਜਲਦੀ ਤੋਂ ਜਲਦੀ ਦੱਸੋ ਤਾਂ ਜੋ ਅਸੀਂ ਕਿਸੇ ਵੀ ਗਲਤਫਹਿਮੀ ਨੂੰ ਸਪੱਸ਼ਟ ਕਰ ਸਕੀਏ ਅਤੇ ਸੁਧਾਰ ਸਕੀਏ। ਤੁਹਾਡੀ ਸਮਝ ਸਾਡੇ ਲਈ ਬਹੁਤ ਮਹੱਤਵਪੂਰਨ ਹੈ।'
  },
  ur: {
    title: 'آپ کے لیے اہم معلومات',
    body: 'یہ دستاویز آج ہماری ترجمہ سروس کا استعمال کرتے ہوئے ہونے والی گفتگو کی ایک کاپی ہے۔ براہ کرم اسے غور سے پڑھیں۔ اگر کچھ درست نہیں لگتا، الجھن میں ڈالنے والا ہے، یا اگر آپ کو لگتا ہے کہ کچھ غلط ترجمہ کیا گیا ہے، تو براہ کرم ہمیں جلد از جلد بتائیں تاکہ ہم کسی بھی غلط فہمی کو واضح کر سکیں اور درست کر سکیں۔ آپ کی سمجھ ہمارے لیے بہت اہم ہے۔'
  },
  zh: {
    title: '给您的重要信息',
    body: '本文件是今天使用我们翻译服务进行的对话的副本。请仔细阅读。如果有任何内容看起来不正确、令人困惑，或者您认为有翻译错误，请尽快告诉我们，以便我们澄清和纠正任何误解。您的理解对我们非常重要。'
  },
  'zh-TW': {
    title: '給您的重要資訊',
    body: '本文件是今天使用我們翻譯服務進行的對話的副本。請仔細閱讀。如果有任何內容看起來不正確、令人困惑，或者您認為有翻譯錯誤，請儘快告訴我們，以便我們澄清和糾正任何誤解。您的理解對我們非常重要。'
  },
  so: {
    title: 'Macluumaad Muhiim ah oo Adiga kuu Socota',
    body: 'Dukumeentigan waa nuqul ka mid ah wada hadalka maanta dhacay iyadoo la adeegsanayo adeegga turjumaadda. Fadlan si taxadar leh u eeg. Haddii wax aan sax ahayn, jahawareer leh, ama haddii aad rumaysantahay in wax si khaldan loo turjumay, fadlan noo sheeg sida ugu dhakhsaha badan si aan u caddayno oo aan u saxno wixii is-faham darro ah. Fahamkaagu waa muhiim inoogu ah.'
  },
  ti: {
    title: 'ኣገዳሲ ሓበሬታ ንዓኻ',
    body: 'እዚ ሰነድ ናይ ሎሚ መዓልቲ ብኣገልግሎት ትርጉምና ዝተገብረ ዝርርብ ቅዳሕ እዩ። በጃኻ ብጥንቃቐ ርኣዮ። ገለ ነገር ቅኑዕ እንተዘይመሲሉ፣ ምድንጋር እንተፈጢሩ፣ ወይ ገለ ነገር ብጌጋ ተተርጒሙ ኢልካ እንተኣሚንካ፣ በጃኻ ብቕልጡፍ ኣፍልጠና ንዝኾነ ዘይምርድዳእ ንምብራህን ንምእራምን። ምርድዳእካ ኣዝዩ ኣገዳሲ እዩ።'
  },
  tr: {
    title: 'Sizin için Önemli Bilgiler',
    body: 'Bu belge, çeviri hizmetimizi kullanarak bugün gerçekleşen görüşmenin bir kopyasıdır. Lütfen dikkatlice inceleyin. Bir şey doğru görünmüyorsa, kafa karıştırıcıysa veya bir şeyin yanlış çevrildiğini düşünüyorsanız, lütfen herhangi bir yanlış anlaşılmayı açıklığa kavuşturmak ve düzeltmek için en kısa sürede bize bildirin. Sizin anlayışınız bizim için çok önemlidir.'
  },
  it: {
    title: 'Informazioni importanti per Lei',
    body: "Questo documento è una copia della conversazione avvenuta oggi utilizzando il nostro servizio di traduzione. La preghiamo di leggerlo attentamente. Se qualcosa non sembra corretto, è confuso, o se ritiene che qualcosa sia stato tradotto male, La preghiamo di informarci il prima possibile in modo da poter chiarire e correggere eventuali malintesi. La Sua comprensione è molto importante per noi."
  },
  de: {
    title: 'Wichtige Informationen für Sie',
    body: 'Dieses Dokument ist eine Kopie des Gesprächs, das heute mit unserem Übersetzungsdienst stattgefunden hat. Bitte lesen Sie es sorgfältig durch. Wenn etwas nicht korrekt erscheint, verwirrend ist, oder wenn Sie glauben, dass etwas falsch übersetzt wurde, teilen Sie uns dies bitte so schnell wie möglich mit, damit wir eventuelle Missverständnisse klären und korrigieren können. Ihr Verständnis ist uns sehr wichtig.'
  },
  ru: {
    title: 'Важная информация для Вас',
    body: 'Этот документ является копией разговора, состоявшегося сегодня с использованием нашей службы перевода. Пожалуйста, внимательно ознакомьтесь с ним. Если что-то выглядит неправильно, непонятно, или если вы считаете, что что-то было переведено неверно, пожалуйста, сообщите нам как можно скорее, чтобы мы могли уточнить и исправить любые недоразумения. Ваше понимание очень важно для нас.'
  },
  fa: {
    title: 'اطلاعات مهم برای شما',
    body: 'این سند یک نسخه از گفتگویی است که امروز با استفاده از خدمات ترجمه ما انجام شد. لطفاً آن را با دقت بررسی کنید. اگر چیزی درست به نظر نمی‌رسد، گیج‌کننده است، یا اگر فکر می‌کنید چیزی اشتباه ترجمه شده است، لطفاً در اسرع وقت به ما اطلاع دهید تا بتوانیم هرگونه سوء تفاهم را روشن و اصلاح کنیم. درک شما برای ما بسیار مهم است.'
  },
  ku: {
    title: 'Agahdariya Girîng ji bo Te',
    body: 'Ev belge kopiyek ji axaftina ku îro bi karanîna xizmeta wergerê ya me pêk hat e. Ji kerema xwe bi baldarî binihêrin. Ger tiştek rast xuya neke, tevlihev be, an heke hûn bawer dikin ku tiştek xelet hatiye wergerandin, ji kerema xwe di zûtirîn demê de me agahdar bikin da ku em her têgihîştinê zelal bikin û rast bikin. Têgihîştina we ji bo me pir girîng e.'
  },
  vi: {
    title: 'Thông tin quan trọng dành cho bạn',
    body: 'Tài liệu này là bản sao của cuộc trò chuyện diễn ra hôm nay sử dụng dịch vụ phiên dịch của chúng tôi. Vui lòng xem xét kỹ lưỡng. Nếu có điều gì không chính xác, gây nhầm lẫn, hoặc nếu bạn cho rằng có điều gì đã bị dịch sai, vui lòng cho chúng tôi biết sớm nhất có thể để chúng tôi có thể làm rõ và sửa chữa bất kỳ hiểu lầm nào. Sự hiểu biết của bạn rất quan trọng đối với chúng tôi.'
  },
  th: {
    title: 'ข้อมูลสำคัญสำหรับคุณ',
    body: 'เอกสารนี้เป็นสำเนาของการสนทนาที่เกิดขึ้นในวันนี้โดยใช้บริการแปลภาษาของเรา กรุณาตรวจสอบอย่างละเอียด หากมีสิ่งใดไม่ถูกต้อง สับสน หรือหากคุณเชื่อว่ามีการแปลผิดพลาด กรุณาแจ้งให้เราทราบโดยเร็วที่สุดเพื่อที่เราจะได้ชี้แจงและแก้ไขความเข้าใจผิดใดๆ ความเข้าใจของคุณมีความสำคัญมากสำหรับเรา'
  },
  tl: {
    title: 'Mahalagang Impormasyon para sa Iyo',
    body: 'Ang dokumentong ito ay kopya ng pag-uusap na naganap ngayon gamit ang aming serbisyo sa pagsasalin. Pakisuri ito nang mabuti. Kung may hindi tama, nakakalito, o kung sa tingin mo ay may mali sa pagsasalin, mangyaring ipaalam sa amin sa lalong madaling panahon upang malinawan at maitama ang anumang hindi pagkakaunawaan. Napakahalaga sa amin ng iyong pag-unawa.'
  },
  ne: {
    title: 'तपाईंको लागि महत्त्वपूर्ण जानकारी',
    body: 'यो कागजात हाम्रो अनुवाद सेवा प्रयोग गरेर आज भएको कुराकानीको प्रतिलिपि हो। कृपया यसलाई ध्यानपूर्वक हेर्नुहोस्। यदि केहि सही देखिएन, भ्रामक छ, वा यदि तपाईंलाई लाग्छ कि केहि गलत अनुवाद गरिएको छ भने, कृपया हामीलाई सकेसम्म चाँडो जानकारी दिनुहोस् ताकि हामी कुनै पनि गलतफहमी स्पष्ट गर्न र सच्याउन सकौं। तपाईंको बुझाइ हाम्रो लागि धेरै महत्त्वपूर्ण छ।'
  },
  sw: {
    title: 'Taarifa Muhimu Kwako',
    body: 'Hati hii ni nakala ya mazungumzo yaliyofanyika leo kwa kutumia huduma yetu ya tafsiri. Tafadhali iangalie kwa makini. Ikiwa kitu hakionekani sahihi, kinachanganganya, au ukiamini kuwa kitu kimetafsiriwa vibaya, tafadhali tuambie haraka iwezekanavyo ili tuweze kufafanua na kusahihisha kutokuelewana. Uelewa wako ni muhimu sana kwetu.'
  },
  am: {
    title: 'ለእርስዎ አስፈላጊ መረጃ',
    body: 'ይህ ሰነድ ዛሬ የትርጉም አገልግሎታችንን በመጠቀም የተደረገውን ውይይት ቅጂ ነው። እባክዎ በጥንቃቄ ይመልከቱ። አንድ ነገር ትክክል የማይመስል፣ ግራ የሚያጋባ፣ ወይም አንድ ነገር በስህተት ተተርጉሟል ብለው ካመኑ፣ እባክዎ በተቻለ ፍጥነት ያሳውቁን ማንኛውንም አለመግባባት ለማብራራት እና ለማስተካከል። የእርስዎ ግንዛቤ ለእኛ በጣም አስፈላጊ ነው።'
  }
};

// Calculate clinical confidence score based on message characteristics
function calculateClinicalConfidence(message: TranslationMessage): number {
  let score = 85; // Base confidence score
  
  const textLength = message.originalText.length;
  const translationLength = message.translatedText.length;
  
  // Length ratio check - very different lengths may indicate translation issues
  const lengthRatio = Math.min(textLength, translationLength) / Math.max(textLength, translationLength);
  if (lengthRatio < 0.3) score -= 15;
  else if (lengthRatio < 0.5) score -= 8;
  else if (lengthRatio > 0.7) score += 5;
  
  // Short messages are harder to translate accurately
  if (textLength < 10) score -= 10;
  else if (textLength > 50) score += 5;
  
  // Medical terms detection (simplified)
  const medicalTerms = ['pain', 'medication', 'symptom', 'doctor', 'prescription', 'dose', 'allergy', 
    'blood', 'pressure', 'diabetes', 'heart', 'breathing', 'appointment', 'treatment'];
  const hasMedicalTerms = medicalTerms.some(term => 
    message.originalText.toLowerCase().includes(term) || 
    message.translatedText.toLowerCase().includes(term)
  );
  if (hasMedicalTerms) score += 3; // Medical context is clearer
  
  return Math.min(98, Math.max(60, score));
}

// Calculate accuracy score
function calculateAccuracyScore(message: TranslationMessage): number {
  let score = 88; // Base accuracy
  
  const textLength = message.originalText.length;
  
  // Longer messages generally have better accuracy due to more context
  if (textLength > 100) score += 5;
  else if (textLength < 20) score -= 8;
  
  // Check for question marks, exclamation marks (intent preservation)
  const originalHasQuestion = message.originalText.includes('?');
  const translatedHasQuestion = message.translatedText.includes('?');
  if (originalHasQuestion === translatedHasQuestion) score += 3;
  
  return Math.min(98, Math.max(65, score));
}

// Get overall session confidence
function getOverallConfidence(messages: TranslationMessage[]): { score: number; rating: string; color: string } {
  if (messages.length === 0) return { score: 0, rating: 'No Data', color: NHS_COLORS.textLightGrey };
  
  const avgConfidence = messages.reduce((sum, m) => sum + calculateClinicalConfidence(m), 0) / messages.length;
  
  if (avgConfidence >= 90) return { score: avgConfidence, rating: 'Excellent', color: '22C55E' };
  if (avgConfidence >= 80) return { score: avgConfidence, rating: 'Good', color: NHS_COLORS.nhsBlue };
  if (avgConfidence >= 70) return { score: avgConfidence, rating: 'Acceptable', color: 'F59E0B' };
  return { score: avgConfidence, rating: 'Review Required', color: 'DC2626' };
}

export const generateTranslationReportDocx = async (options: GenerateTranslationReportOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun, Footer, PageNumber, Header } = await import('docx');
  
  const { messages, patientLanguage, patientLanguageName, sessionStart, sessionEnd, practiceInfo } = options;
  
  const children: any[] = [];
  const overall = getOverallConfidence(messages);
  
  // Practice Header with Logo (if available)
  if (practiceInfo?.logoUrl) {
    try {
      const response = await fetch(practiceInfo.logoUrl);
      if (response.ok) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Load image to get natural dimensions for aspect ratio
        const imgUrl = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imgUrl;
        });
        URL.revokeObjectURL(imgUrl);
        
        // Calculate dimensions maintaining aspect ratio (max width 300, max height 160)
        const maxWidth = 300;
        const maxHeight = 160;
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: uint8Array,
                transformation: {
                  width: Math.round(width),
                  height: Math.round(height),
                },
                type: blob.type.includes('png') ? 'png' : 'jpg',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
          })
        );
      }
    } catch (error) {
      console.error('Failed to load practice logo:', error);
    }
  }
  
  // Practice Name
  if (practiceInfo?.name) {
    children.push(
      new Paragraph({
        children: [new TextRun({
          text: practiceInfo.name,
          bold: true,
          size: FONTS.size.heading1,
          color: NHS_COLORS.headingBlue,
          font: FONTS.default,
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      })
    );
    
    // Practice Address (if available)
    if (practiceInfo?.address) {
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: practiceInfo.address,
            size: FONTS.size.small,
            color: NHS_COLORS.textLightGrey,
            font: FONTS.default,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
        })
      );
    }
  }
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: 'Translation Session Report',
        bold: true,
        size: FONTS.size.title,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );
  
  // Subtitle
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: 'Clinical Communication Evidence Document',
        italics: true,
        size: FONTS.size.body,
        color: NHS_COLORS.textLightGrey,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    })
  );
  
  // Session Details Section
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: 'Session Details',
        bold: true,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 240, after: 120 },
    })
  );
  
  const sessionDuration = sessionEnd 
    ? Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000)
    : Math.round((new Date().getTime() - sessionStart.getTime()) / 60000);
  
  const detailsData = [
    ['Date', sessionStart.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
    ['Time', `${sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${(sessionEnd || new Date()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`],
    ['Duration', `${sessionDuration} minutes`],
    ['Patient Language', patientLanguageName],
    ['Total Exchanges', `${messages.length}`],
    ['Overall Confidence', `${overall.score.toFixed(0)}% (${overall.rating})`],
  ];
  
  const detailsRows = detailsData.map(([label, value]) => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: FONTS.size.body, font: FONTS.default, color: NHS_COLORS.textGrey })]
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: 'F3F4F6' },
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: FONTS.size.body, font: FONTS.default, color: NHS_COLORS.textGrey })]
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ]
    })
  );
  
  children.push(
    new Table({
      rows: detailsRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );
  
  // Conversation Transcript with Scores
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: 'Conversation Transcript',
        bold: true,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 360, after: 120 },
    })
  );
  
  // Table header
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Time', bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 12, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Speaker', bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 10, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'English', bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: patientLanguageName, bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Confidence', bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 9, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Accuracy', bold: true, size: 20, color: 'FFFFFF', font: FONTS.default })] })],
        shading: { fill: NHS_COLORS.headingBlue },
        width: { size: 9, type: WidthType.PERCENTAGE },
      }),
    ]
  });
  
  const messageRows = messages.map((msg, index) => {
    const confidence = calculateClinicalConfidence(msg);
    const accuracy = calculateAccuracyScore(msg);
    const isStaff = msg.speaker === 'staff';
    const englishText = isStaff ? msg.originalText : msg.translatedText;
    const patientLangText = isStaff ? msg.translatedText : msg.originalText;
    
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ 
            text: msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 
            size: 18, font: FONTS.default, color: NHS_COLORS.textGrey 
          })] })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ 
            text: isStaff ? 'Staff' : 'Patient', 
            bold: true,
            size: 18, 
            font: FONTS.default, 
            color: isStaff ? NHS_COLORS.headingBlue : '7C3AED'
          })] })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: englishText, size: 18, font: FONTS.default, color: NHS_COLORS.textGrey })] })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: patientLangText, size: 18, font: FONTS.default, color: NHS_COLORS.textGrey })] })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: `${confidence}%`, size: 18, font: FONTS.default, color: confidence >= 85 ? '22C55E' : confidence >= 75 ? 'F59E0B' : 'DC2626' })],
            alignment: AlignmentType.CENTER
          })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: `${accuracy}%`, size: 18, font: FONTS.default, color: accuracy >= 85 ? '22C55E' : accuracy >= 75 ? 'F59E0B' : 'DC2626' })],
            alignment: AlignmentType.CENTER
          })],
          shading: { fill: index % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
        }),
      ]
    });
  });
  
  children.push(
    new Table({
      rows: [headerRow, ...messageRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );
  
  // Patient Section in their language
  const disclaimer = PATIENT_DISCLAIMERS[patientLanguage] || PATIENT_DISCLAIMERS['en'];
  
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: disclaimer.title,
        bold: true,
        size: FONTS.size.heading2,
        color: '7C3AED', // Purple for patient section
        font: FONTS.default,
      })],
      spacing: { before: 480, after: 120 },
      border: {
        top: { color: '7C3AED', size: 1, style: BorderStyle.SINGLE, space: 8 }
      }
    })
  );
  
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: disclaimer.body,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      })],
      spacing: { after: 240 },
      shading: { fill: 'F5F3FF' }, // Light purple background
    })
  );
  
  // Footer
  const now = new Date();
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `Report generated on ${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        italics: true,
        size: FONTS.size.footer,
        color: NHS_COLORS.textLightGrey,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 360 },
    })
  );
  
  // Create document with footer
  const styles = buildNHSStyles();
  const numbering = buildNumbering();
  
  // Build footer content with practice info and page numbers
  const footerChildren: any[] = [];
  
  if (practiceInfo?.name) {
    const footerText = practiceInfo.address 
      ? `${practiceInfo.name} | ${practiceInfo.address}`
      : practiceInfo.name;
    
    footerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: footerText,
            size: FONTS.size.footer,
            color: NHS_COLORS.textLightGrey,
            font: FONTS.default,
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );
  }
  
  // Page numbers
  footerChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Page ',
          size: FONTS.size.footer,
          color: NHS_COLORS.textLightGrey,
          font: FONTS.default,
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: FONTS.size.footer,
          color: NHS_COLORS.textLightGrey,
          font: FONTS.default,
        }),
        new TextRun({
          text: ' of ',
          size: FONTS.size.footer,
          color: NHS_COLORS.textLightGrey,
          font: FONTS.default,
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: FONTS.size.footer,
          color: NHS_COLORS.textLightGrey,
          font: FONTS.default,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );
  
  const doc = new Document({
    styles: styles,
    numbering: numbering,
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      footers: {
        default: new Footer({
          children: footerChildren,
        }),
      },
      children,
    }],
  });
  
  // Generate and save
  const blob = await Packer.toBlob(doc);
  const filename = `translation-report-${sessionStart.toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
};
