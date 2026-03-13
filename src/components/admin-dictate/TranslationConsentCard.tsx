import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ── RTL LANGUAGE SET ──
const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'ku']);

// ── CONSENT TRANSLATIONS ──
interface ConsentStrings {
  title: string;
  step1: string;
  step2: string;
  step3: string;
  consentText: string;
  agree: string;
  decline: string;
  scanPhone: string;
  continueScreen: string;
  or: string;
}

const CONSENT_TRANSLATIONS: Record<string, ConsentStrings> = {
  en: {
    title: 'Translation Service',
    step1: 'Staff speaks English',
    step2: 'You hear your language',
    step3: 'You speak back',
    consentText: 'We would like to use our AI translation service to help us communicate with you today. A staff member will control the session. This is a communication aid — for complex medical discussions, a professional interpreter can be arranged.',
    agree: 'I Agree',
    decline: 'Decline',
    scanPhone: 'Scan to follow on your phone',
    continueScreen: 'Continue on this screen',
    or: 'or',
  },
  ar: {
    title: 'خدمة الترجمة',
    step1: 'الموظف يتحدث الإنجليزية',
    step2: 'تسمع بلغتك',
    step3: 'تتحدث بالرد',
    consentText: 'نودّ استخدام خدمة الترجمة بالذكاء الاصطناعي لمساعدتنا في التواصل معكم اليوم. سيتحكم أحد أعضاء فريق العمل في الجلسة. هذه وسيلة مساعدة للتواصل — يمكن ترتيب مترجم محترف للمناقشات الطبية المعقدة.',
    agree: 'أوافق',
    decline: 'رفض',
    scanPhone: 'امسح للمتابعة على هاتفك',
    continueScreen: 'تابع على هذه الشاشة',
    or: 'أو',
  },
  fr: {
    title: 'Service de traduction',
    step1: 'Le personnel parle anglais',
    step2: 'Vous entendez votre langue',
    step3: 'Vous répondez',
    consentText: "Nous souhaitons utiliser notre service de traduction IA pour nous aider à communiquer avec vous aujourd'hui. Un membre du personnel contrôlera la session. Il s'agit d'une aide à la communication — un interprète professionnel peut être organisé pour les discussions médicales complexes.",
    agree: "J'accepte",
    decline: 'Refuser',
    scanPhone: 'Scannez pour suivre sur votre téléphone',
    continueScreen: 'Continuer sur cet écran',
    or: 'ou',
  },
  es: {
    title: 'Servicio de traducción',
    step1: 'El personal habla inglés',
    step2: 'Usted escucha en su idioma',
    step3: 'Usted responde',
    consentText: 'Nos gustaría utilizar nuestro servicio de traducción con IA para ayudarnos a comunicarnos con usted hoy. Un miembro del personal controlará la sesión. Es una ayuda de comunicación — se puede organizar un intérprete profesional para discusiones médicas complejas.',
    agree: 'Acepto',
    decline: 'Rechazar',
    scanPhone: 'Escanee para seguir en su teléfono',
    continueScreen: 'Continuar en esta pantalla',
    or: 'o',
  },
  pl: {
    title: 'Usługa tłumaczeniowa',
    step1: 'Personel mówi po angielsku',
    step2: 'Słyszysz swój język',
    step3: 'Odpowiadasz',
    consentText: 'Chcielibyśmy skorzystać z naszej usługi tłumaczenia AI, aby pomóc nam się z Tobą dziś porozumieć. Sesję będzie kontrolować pracownik. Jest to pomoc komunikacyjna — w przypadku złożonych dyskusji medycznych można zapewnić profesjonalnego tłumacza.',
    agree: 'Zgadzam się',
    decline: 'Odmów',
    scanPhone: 'Zeskanuj, aby śledzić na telefonie',
    continueScreen: 'Kontynuuj na tym ekranie',
    or: 'lub',
  },
  ro: {
    title: 'Serviciu de traducere',
    step1: 'Personalul vorbește engleză',
    step2: 'Auziți în limba dvs.',
    step3: 'Răspundeți',
    consentText: 'Am dori să folosim serviciul nostru de traducere AI pentru a ne ajuta să comunicăm cu dvs. astăzi. Un membru al personalului va controla sesiunea. Aceasta este un ajutor de comunicare — un interpret profesionist poate fi aranjat pentru discuții medicale complexe.',
    agree: 'Sunt de acord',
    decline: 'Refuz',
    scanPhone: 'Scanați pentru a urmări pe telefon',
    continueScreen: 'Continuați pe acest ecran',
    or: 'sau',
  },
  pt: {
    title: 'Serviço de tradução',
    step1: 'O pessoal fala inglês',
    step2: 'Ouve no seu idioma',
    step3: 'Responde',
    consentText: 'Gostaríamos de utilizar o nosso serviço de tradução por IA para nos ajudar a comunicar consigo hoje. Um membro do pessoal controlará a sessão. Trata-se de uma ajuda de comunicação — para discussões médicas complexas, pode ser organizado um intérprete profissional.',
    agree: 'Concordo',
    decline: 'Recusar',
    scanPhone: 'Digitalize para seguir no telemóvel',
    continueScreen: 'Continuar neste ecrã',
    or: 'ou',
  },
  ur: {
    title: 'ترجمے کی سروس',
    step1: 'عملہ انگریزی بولتا ہے',
    step2: 'آپ اپنی زبان میں سنتے ہیں',
    step3: 'آپ جواب دیتے ہیں',
    consentText: 'ہم آج آپ سے بات چیت میں مدد کے لیے اپنی AI ترجمے کی سروس استعمال کرنا چاہیں گے۔ ایک عملے کا رکن سیشن کو کنٹرول کرے گا۔ یہ ایک مواصلاتی مدد ہے — پیچیدہ طبی مباحثوں کے لیے ایک پیشہ ور مترجم کا انتظام کیا جا سکتا ہے۔',
    agree: 'میں متفق ہوں',
    decline: 'انکار',
    scanPhone: 'اپنے فون پر فالو کرنے کے لیے اسکین کریں',
    continueScreen: 'اس اسکرین پر جاری رکھیں',
    or: 'یا',
  },
  hi: {
    title: 'अनुवाद सेवा',
    step1: 'स्टाफ अंग्रेज़ी बोलता है',
    step2: 'आप अपनी भाषा सुनते हैं',
    step3: 'आप जवाब देते हैं',
    consentText: 'हम आज आपसे संवाद करने में मदद के लिए अपनी AI अनुवाद सेवा का उपयोग करना चाहेंगे। एक स्टाफ सदस्य सत्र को नियंत्रित करेगा। यह एक संचार सहायता है — जटिल चिकित्सा चर्चाओं के लिए एक पेशेवर दुभाषिया की व्यवस्था की जा सकती है।',
    agree: 'मैं सहमत हूँ',
    decline: 'अस्वीकार',
    scanPhone: 'अपने फ़ोन पर फ़ॉलो करने के लिए स्कैन करें',
    continueScreen: 'इस स्क्रीन पर जारी रखें',
    or: 'या',
  },
  bn: {
    title: 'অনুবাদ সেবা',
    step1: 'কর্মী ইংরেজি বলেন',
    step2: 'আপনি আপনার ভাষায় শোনেন',
    step3: 'আপনি উত্তর দেন',
    consentText: 'আজ আপনার সাথে যোগাযোগে সাহায্য করতে আমরা আমাদের AI অনুবাদ সেবা ব্যবহার করতে চাই। একজন কর্মী সেশন নিয়ন্ত্রণ করবেন। এটি একটি যোগাযোগ সহায়তা — জটিল চিকিৎসা আলোচনার জন্য পেশাদার দোভাষীর ব্যবস্থা করা যেতে পারে।',
    agree: 'আমি সম্মত',
    decline: 'প্রত্যাখ্যান',
    scanPhone: 'ফোনে অনুসরণ করতে স্ক্যান করুন',
    continueScreen: 'এই স্ক্রিনে চালিয়ে যান',
    or: 'বা',
  },
  pa: {
    title: 'ਅਨੁਵਾਦ ਸੇਵਾ',
    step1: 'ਸਟਾਫ਼ ਅੰਗਰੇਜ਼ੀ ਬੋਲਦਾ ਹੈ',
    step2: 'ਤੁਸੀਂ ਆਪਣੀ ਭਾਸ਼ਾ ਸੁਣਦੇ ਹੋ',
    step3: 'ਤੁਸੀਂ ਜਵਾਬ ਦਿੰਦੇ ਹੋ',
    consentText: 'ਅਸੀਂ ਅੱਜ ਤੁਹਾਡੇ ਨਾਲ ਸੰਵਾਦ ਕਰਨ ਵਿੱਚ ਮਦਦ ਲਈ ਆਪਣੀ AI ਅਨੁਵਾਦ ਸੇਵਾ ਦੀ ਵਰਤੋਂ ਕਰਨਾ ਚਾਹਾਂਗੇ। ਇੱਕ ਸਟਾਫ਼ ਮੈਂਬਰ ਸੈਸ਼ਨ ਨੂੰ ਕੰਟਰੋਲ ਕਰੇਗਾ। ਇਹ ਇੱਕ ਸੰਚਾਰ ਸਹਾਇਤਾ ਹੈ — ਗੁੰਝਲਦਾਰ ਡਾਕਟਰੀ ਚਰਚਾਵਾਂ ਲਈ ਪੇਸ਼ੇਵਰ ਦੁਭਾਸ਼ੀਏ ਦਾ ਪ੍ਰਬੰਧ ਕੀਤਾ ਜਾ ਸਕਦਾ ਹੈ।',
    agree: 'ਮੈਂ ਸਹਿਮਤ ਹਾਂ',
    decline: 'ਇਨਕਾਰ',
    scanPhone: 'ਫ਼ੋਨ \'ਤੇ ਫ਼ਾਲੋ ਕਰਨ ਲਈ ਸਕੈਨ ਕਰੋ',
    continueScreen: 'ਇਸ ਸਕ੍ਰੀਨ \'ਤੇ ਜਾਰੀ ਰੱਖੋ',
    or: 'ਜਾਂ',
  },
  tr: {
    title: 'Çeviri Hizmeti',
    step1: 'Personel İngilizce konuşur',
    step2: 'Kendi dilinizde duyarsınız',
    step3: 'Yanıt verirsiniz',
    consentText: 'Bugün sizinle iletişim kurmamıza yardımcı olmak için AI çeviri hizmetimizi kullanmak istiyoruz. Bir personel oturumu kontrol edecek. Bu bir iletişim yardımcısıdır — karmaşık tıbbi tartışmalar için profesyonel tercüman ayarlanabilir.',
    agree: 'Kabul ediyorum',
    decline: 'Reddet',
    scanPhone: 'Telefonunuzda takip etmek için tarayın',
    continueScreen: 'Bu ekranda devam edin',
    or: 'veya',
  },
  ru: {
    title: 'Служба перевода',
    step1: 'Сотрудник говорит по-английски',
    step2: 'Вы слышите на своём языке',
    step3: 'Вы отвечаете',
    consentText: 'Мы хотели бы использовать нашу службу перевода на основе ИИ, чтобы помочь нам общаться с вами сегодня. Сотрудник будет контролировать сеанс. Это вспомогательное средство — для сложных медицинских обсуждений можно организовать профессионального переводчика.',
    agree: 'Согласен',
    decline: 'Отказать',
    scanPhone: 'Отсканируйте, чтобы следить на телефоне',
    continueScreen: 'Продолжить на этом экране',
    or: 'или',
  },
  so: {
    title: 'Adeegga Turjumaadda',
    step1: 'Shaqaalaha waxay ku hadlaan Ingiriis',
    step2: 'Waxaad maqashaa luqaddaada',
    step3: 'Waxaad ka jawaabta',
    consentText: 'Waxaan jeclaan lahayn inaan adeegsano adeegga turjumaadda AI si aan kula xiriirno maanta. Xubin shaqaale ah ayaa maamuli doona kulamada. Tani waa qalab gargaar ah — turjubaan xirfad leh ayaa la abuuri karaa doodaha caafimaadka ee adag.',
    agree: 'Waan ogolahay',
    decline: 'Diid',
    scanPhone: 'Sawir si aad ugu raacdo telefoonkaaga',
    continueScreen: 'Ku sii wad shaashaddan',
    or: 'ama',
  },
  ti: {
    title: 'ኣገልግሎት ትርጉም',
    step1: 'ሰራሕተኛ እንግሊዝኛ ይዛረብ',
    step2: 'ብቛንቃኻ ትሰምዕ',
    step3: 'ትምለስ',
    consentText: 'ሎሚ ምሳኹም ንምርኻብ ኣገልግሎት ትርጉም AI ክንጥቀም ንደሊ። ሓደ ሰራሕተኛ ነቲ ኣኼባ ክቆጻጸሮ እዩ። እዚ ንርክብ ዝሕግዝ መሳርሒ እዩ — ንዝተሓላለኸ ሕክምናዊ ዘተ ሞያዊ ተርጓሚ ክዳሎ ይከኣል።',
    agree: 'እስማዕ',
    decline: 'ኣይፋል',
    scanPhone: 'ኣብ ተሌፎንካ ንምክትታል ስካን ግበር',
    continueScreen: 'ኣብዚ ስክሪን ቀጽል',
    or: 'ወይ',
  },
  fa: {
    title: 'خدمات ترجمه',
    step1: 'کارمند انگلیسی صحبت می‌کند',
    step2: 'شما به زبان خود می‌شنوید',
    step3: 'شما پاسخ می‌دهید',
    consentText: 'ما می‌خواهیم از خدمات ترجمه هوش مصنوعی برای کمک به ارتباط با شما امروز استفاده کنیم. یکی از کارکنان جلسه را کنترل خواهد کرد. این یک ابزار کمک ارتباطی است — برای بحث‌های پزشکی پیچیده، مترجم حرفه‌ای قابل ترتیب است.',
    agree: 'موافقم',
    decline: 'رد',
    scanPhone: 'برای پیگیری روی گوشی اسکن کنید',
    continueScreen: 'در این صفحه ادامه دهید',
    or: 'یا',
  },
  zh: {
    title: '翻译服务',
    step1: '工作人员说英语',
    step2: '您听到您的语言',
    step3: '您回复',
    consentText: '我们希望使用AI翻译服务来帮助我们今天与您沟通。一名工作人员将控制会话。这是一种沟通辅助工具——对于复杂的医疗讨论，可以安排专业口译员。',
    agree: '我同意',
    decline: '拒绝',
    scanPhone: '扫描以在手机上关注',
    continueScreen: '在此屏幕上继续',
    or: '或',
  },
  de: {
    title: 'Übersetzungsdienst',
    step1: 'Mitarbeiter spricht Englisch',
    step2: 'Sie hören Ihre Sprache',
    step3: 'Sie antworten',
    consentText: 'Wir möchten unseren KI-Übersetzungsdienst nutzen, um heute mit Ihnen zu kommunizieren. Ein Mitarbeiter wird die Sitzung steuern. Dies ist eine Kommunikationshilfe — für komplexe medizinische Gespräche kann ein professioneller Dolmetscher organisiert werden.',
    agree: 'Ich stimme zu',
    decline: 'Ablehnen',
    scanPhone: 'Scannen Sie, um auf Ihrem Handy zu folgen',
    continueScreen: 'Auf diesem Bildschirm fortfahren',
    or: 'oder',
  },
  it: {
    title: 'Servizio di traduzione',
    step1: 'Il personale parla inglese',
    step2: 'Senti nella tua lingua',
    step3: 'Rispondi',
    consentText: "Vorremmo utilizzare il nostro servizio di traduzione AI per aiutarci a comunicare con te oggi. Un membro del personale controllerà la sessione. Si tratta di un ausilio alla comunicazione — per discussioni mediche complesse, è possibile organizzare un interprete professionista.",
    agree: 'Accetto',
    decline: 'Rifiuta',
    scanPhone: 'Scansiona per seguire sul telefono',
    continueScreen: 'Continua su questo schermo',
    or: 'o',
  },
  bg: {
    title: 'Услуга за превод',
    step1: 'Служителят говори английски',
    step2: 'Чувате на вашия език',
    step3: 'Отговаряте',
    consentText: 'Бихме искали да използваме нашата AI услуга за превод, за да ви помогнем да общувате с нас днес. Служител ще контролира сесията. Това е комуникационна помощ — за сложни медицински дискусии може да бъде осигурен професионален преводач.',
    agree: 'Съгласен съм',
    decline: 'Отказвам',
    scanPhone: 'Сканирайте, за да следите на телефона',
    continueScreen: 'Продължете на този екран',
    or: 'или',
  },
  hr: {
    title: 'Usluga prevođenja',
    step1: 'Osoblje govori engleski',
    step2: 'Čujete na svom jeziku',
    step3: 'Odgovarate',
    consentText: 'Željeli bismo koristiti našu AI uslugu prevođenja kako bismo vam pomogli u komunikaciji danas. Član osoblja kontrolirat će sesiju. Ovo je komunikacijska pomoć — za složene medicinske rasprave može se organizirati profesionalni tumač.',
    agree: 'Slažem se',
    decline: 'Odbij',
    scanPhone: 'Skenirajte za praćenje na telefonu',
    continueScreen: 'Nastavite na ovom zaslonu',
    or: 'ili',
  },
  cs: {
    title: 'Překladatelská služba',
    step1: 'Personál mluví anglicky',
    step2: 'Slyšíte svůj jazyk',
    step3: 'Odpovídáte',
    consentText: 'Rádi bychom dnes využili naši službu AI překladu, abychom vám pomohli s komunikací. Člen personálu bude řídit relaci. Jedná se o komunikační pomůcku — pro složité lékařské diskuse lze zajistit profesionálního tlumočníka.',
    agree: 'Souhlasím',
    decline: 'Odmítnout',
    scanPhone: 'Naskenujte pro sledování na telefonu',
    continueScreen: 'Pokračujte na této obrazovce',
    or: 'nebo',
  },
  da: {
    title: 'Oversættelsestjeneste',
    step1: 'Personalet taler engelsk',
    step2: 'Du hører dit sprog',
    step3: 'Du svarer',
    consentText: 'Vi vil gerne bruge vores AI-oversættelsestjeneste til at hjælpe os med at kommunikere med dig i dag. Et personalemedlem vil styre sessionen. Dette er et kommunikationshjælpemiddel — til komplekse medicinske diskussioner kan en professionel tolk arrangeres.',
    agree: 'Jeg accepterer',
    decline: 'Afvis',
    scanPhone: 'Scan for at følge med på din telefon',
    continueScreen: 'Fortsæt på denne skærm',
    or: 'eller',
  },
  nl: {
    title: 'Vertaaldienst',
    step1: 'Personeel spreekt Engels',
    step2: 'U hoort uw taal',
    step3: 'U antwoordt',
    consentText: 'We willen graag onze AI-vertaaldienst gebruiken om vandaag met u te communiceren. Een personeelslid zal de sessie beheren. Dit is een communicatiehulpmiddel — voor complexe medische gesprekken kan een professionele tolk worden geregeld.',
    agree: 'Ik ga akkoord',
    decline: 'Weigeren',
    scanPhone: 'Scan om op uw telefoon te volgen',
    continueScreen: 'Ga verder op dit scherm',
    or: 'of',
  },
  el: {
    title: 'Υπηρεσία μετάφρασης',
    step1: 'Το προσωπικό μιλά αγγλικά',
    step2: 'Ακούτε στη γλώσσα σας',
    step3: 'Απαντάτε',
    consentText: 'Θα θέλαμε να χρησιμοποιήσουμε την υπηρεσία μετάφρασης AI για να σας βοηθήσουμε σήμερα. Ένα μέλος του προσωπικού θα ελέγχει τη συνεδρία. Αυτό είναι ένα βοήθημα επικοινωνίας — για σύνθετες ιατρικές συζητήσεις, μπορεί να κανονιστεί επαγγελματίας διερμηνέας.',
    agree: 'Συμφωνώ',
    decline: 'Απόρριψη',
    scanPhone: 'Σαρώστε για να παρακολουθήσετε στο τηλέφωνό σας',
    continueScreen: 'Συνέχεια σε αυτή την οθόνη',
    or: 'ή',
  },
  hu: {
    title: 'Fordítási szolgáltatás',
    step1: 'A személyzet angolul beszél',
    step2: 'Az Ön nyelvén hallja',
    step3: 'Ön válaszol',
    consentText: 'Szeretnénk használni AI fordítási szolgáltatásunkat, hogy segítsünk a mai kommunikációban. Egy munkatárs fogja irányítani a munkamenetet. Ez egy kommunikációs segédeszköz — összetett orvosi megbeszélésekhez professzionális tolmács biztosítható.',
    agree: 'Elfogadom',
    decline: 'Elutasítom',
    scanPhone: 'Szkennelje be a telefonos követéshez',
    continueScreen: 'Folytassa ezen a képernyőn',
    or: 'vagy',
  },
  uk: {
    title: 'Служба перекладу',
    step1: 'Персонал говорить англійською',
    step2: 'Ви чуєте вашою мовою',
    step3: 'Ви відповідаєте',
    consentText: 'Ми хотіли б скористатися нашою службою перекладу на основі ШІ, щоб допомогти нам спілкуватися з вами сьогодні. Сесію контролюватиме співробітник. Це допоміжний засіб комунікації — для складних медичних обговорень можна організувати професійного перекладача.',
    agree: 'Погоджуюсь',
    decline: 'Відхилити',
    scanPhone: 'Відскануйте, щоб стежити на телефоні',
    continueScreen: 'Продовжити на цьому екрані',
    or: 'або',
  },
  vi: {
    title: 'Dịch vụ phiên dịch',
    step1: 'Nhân viên nói tiếng Anh',
    step2: 'Bạn nghe bằng ngôn ngữ của mình',
    step3: 'Bạn trả lời',
    consentText: 'Chúng tôi muốn sử dụng dịch vụ phiên dịch AI để giúp giao tiếp với bạn hôm nay. Một nhân viên sẽ kiểm soát phiên. Đây là công cụ hỗ trợ giao tiếp — đối với các thảo luận y tế phức tạp, có thể sắp xếp phiên dịch viên chuyên nghiệp.',
    agree: 'Tôi đồng ý',
    decline: 'Từ chối',
    scanPhone: 'Quét để theo dõi trên điện thoại',
    continueScreen: 'Tiếp tục trên màn hình này',
    or: 'hoặc',
  },
  th: {
    title: 'บริการแปลภาษา',
    step1: 'เจ้าหน้าที่พูดภาษาอังกฤษ',
    step2: 'คุณฟังในภาษาของคุณ',
    step3: 'คุณตอบกลับ',
    consentText: 'เราต้องการใช้บริการแปลภาษา AI เพื่อช่วยสื่อสารกับคุณวันนี้ เจ้าหน้าที่จะควบคุมเซสชัน นี่เป็นเครื่องมือช่วยสื่อสาร — สำหรับการสนทนาทางการแพทย์ที่ซับซ้อน สามารถจัดหาล่ามมืออาชีพได้',
    agree: 'ฉันยอมรับ',
    decline: 'ปฏิเสธ',
    scanPhone: 'สแกนเพื่อติดตามบนโทรศัพท์',
    continueScreen: 'ดำเนินต่อบนหน้าจอนี้',
    or: 'หรือ',
  },
  sw: {
    title: 'Huduma ya Tafsiri',
    step1: 'Wafanyakazi wanazungumza Kiingereza',
    step2: 'Unasikia kwa lugha yako',
    step3: 'Unajibu',
    consentText: 'Tungependa kutumia huduma yetu ya tafsiri ya AI kukusaidia kuwasiliana nawe leo. Mfanyakazi atadhibiti kikao. Hii ni msaada wa mawasiliano — kwa majadiliano magumu ya matibabu, mkalimani mtaalamu anaweza kupangwa.',
    agree: 'Nakubali',
    decline: 'Kataa',
    scanPhone: 'Changanua kufuatilia kwenye simu yako',
    continueScreen: 'Endelea kwenye skrini hii',
    or: 'au',
  },
  am: {
    title: 'የትርጉም አገልግሎት',
    step1: 'ሠራተኛ እንግሊዝኛ ይናገራል',
    step2: 'በቋንቋዎ ይሰማሉ',
    step3: 'ይመልሳሉ',
    consentText: 'ዛሬ ከእርስዎ ጋር ለመግባባት የ AI ትርጉም አገልግሎታችንን ለመጠቀም እንፈልጋለን። አንድ ሠራተኛ ክፍለ ጊዜውን ይቆጣጠራል። ይህ የመገናኛ መርጃ ነው — ለውስብስብ ሕክምና ውይይቶች ሙያዊ አስተርጓሚ ሊዘጋጅ ይችላል።',
    agree: 'እስማማለሁ',
    decline: 'እምቢ',
    scanPhone: 'በስልክዎ ለመከታተል ይቃኙ',
    continueScreen: 'በዚህ ስክሪን ይቀጥሉ',
    or: 'ወይም',
  },
  gu: {
    title: 'અનુવાદ સેવા',
    step1: 'સ્ટાફ અંગ્રેજી બોલે છે',
    step2: 'તમે તમારી ભાષામાં સાંભળો છો',
    step3: 'તમે જવાબ આપો છો',
    consentText: 'અમે આજે તમારી સાથે વાતચીત કરવામાં મદદ માટે અમારી AI અનુવાદ સેવાનો ઉપયોગ કરવા ઈચ્છીએ છીએ. એક સ્ટાફ સભ્ય સત્રને નિયંત્રિત કરશે. આ એક સંચાર સહાય છે — જટિલ તબીબી ચર્ચાઓ માટે વ્યાવસાયિક દુભાષિયાની વ્યવસ્થા કરી શકાય છે.',
    agree: 'હું સંમત છું',
    decline: 'ના પાડો',
    scanPhone: 'ફોન પર અનુસરવા સ્કેન કરો',
    continueScreen: 'આ સ્ક્રીન પર ચાલુ રાખો',
    or: 'અથવા',
  },
  ta: {
    title: 'மொழிபெயர்ப்பு சேவை',
    step1: 'ஊழியர் ஆங்கிலம் பேசுகிறார்',
    step2: 'உங்கள் மொழியில் கேட்கிறீர்கள்',
    step3: 'நீங்கள் பதிலளிக்கிறீர்கள்',
    consentText: 'இன்று உங்களுடன் தொடர்பு கொள்ள எங்கள் AI மொழிபெயர்ப்பு சேவையைப் பயன்படுத்த விரும்புகிறோம். ஒரு ஊழியர் அமர்வைக் கட்டுப்படுத்துவார். இது ஒரு தொடர்பு உதவி — சிக்கலான மருத்துவ விவாதங்களுக்கு தொழில்முறை மொழிபெயர்ப்பாளர் ஏற்பாடு செய்யப்படலாம்.',
    agree: 'நான் ஒப்புக்கொள்கிறேன்',
    decline: 'மறுக்கவும்',
    scanPhone: 'தொலைபேசியில் பின்தொடர ஸ்கேன் செய்யுங்கள்',
    continueScreen: 'இந்தத் திரையில் தொடரவும்',
    or: 'அல்லது',
  },
  te: {
    title: 'అనువాద సేవ',
    step1: 'సిబ్బంది ఆంగ్లం మాట్లాడతారు',
    step2: 'మీ భాషలో వింటారు',
    step3: 'మీరు సమాధానమిస్తారు',
    consentText: 'ఈ రోజు మీతో సంభాషించడంలో సహాయపడటానికి మా AI అనువాద సేవను ఉపయోగించాలనుకుంటున్నాము. ఒక సిబ్బంది సభ్యుడు సెషన్‌ను నియంత్రిస్తారు. ఇది ఒక కమ్యూనికేషన్ సహాయం — సంక్లిష్ట వైద్య చర్చల కోసం వృత్తిపరమైన అనువాదకుడిని ఏర్పాటు చేయవచ్చు.',
    agree: 'నేను అంగీకరిస్తున్నాను',
    decline: 'తిరస్కరించు',
    scanPhone: 'ఫోన్‌లో అనుసరించడానికి స్కాన్ చేయండి',
    continueScreen: 'ఈ స్క్రీన్‌లో కొనసాగించండి',
    or: 'లేదా',
  },
  kn: {
    title: 'ಅನುವಾದ ಸೇವೆ',
    step1: 'ಸಿಬ್ಬಂದಿ ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡುತ್ತಾರೆ',
    step2: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳುತ್ತೀರಿ',
    step3: 'ನೀವು ಉತ್ತರಿಸುತ್ತೀರಿ',
    consentText: 'ಇಂದು ನಿಮ್ಮೊಂದಿಗೆ ಸಂವಹನ ನಡೆಸಲು ನಮ್ಮ AI ಅನುವಾದ ಸೇವೆಯನ್ನು ಬಳಸಲು ನಾವು ಬಯಸುತ್ತೇವೆ. ಒಬ್ಬ ಸಿಬ್ಬಂದಿ ಸದಸ್ಯ ಅಧಿವೇಶನವನ್ನು ನಿಯಂತ್ರಿಸುತ್ತಾರೆ. ಇದು ಸಂವಹನ ಸಹಾಯ — ಸಂಕೀರ್ಣ ವೈದ್ಯಕೀಯ ಚರ್ಚೆಗಳಿಗೆ ವೃತ್ತಿಪರ ಅನುವಾದಕನನ್ನು ಏರ್ಪಡಿಸಬಹುದು.',
    agree: 'ನಾನು ಒಪ್ಪುತ್ತೇನೆ',
    decline: 'ನಿರಾಕರಿಸಿ',
    scanPhone: 'ಫೋನ್‌ನಲ್ಲಿ ಅನುಸರಿಸಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    continueScreen: 'ಈ ಪರದೆಯಲ್ಲಿ ಮುಂದುವರಿಸಿ',
    or: 'ಅಥವಾ',
  },
  ml: {
    title: 'വിവർത്തന സേവനം',
    step1: 'ജീവനക്കാരൻ ഇംഗ്ലീഷ് സംസാരിക്കുന്നു',
    step2: 'നിങ്ങളുടെ ഭാഷയിൽ കേൾക്കുന്നു',
    step3: 'നിങ്ങൾ മറുപടി പറയുന്നു',
    consentText: 'ഇന്ന് നിങ്ങളുമായി ആശയവിനിമയം നടത്താൻ സഹായിക്കുന്നതിന് ഞങ്ങളുടെ AI വിവർത്തന സേവനം ഉപയോഗിക്കാൻ ഞങ്ങൾ ആഗ്രഹിക്കുന്നു. ഒരു ജീവനക്കാരൻ സെഷൻ നിയന്ത്രിക്കും. ഇത് ഒരു ആശയവിനിമയ സഹായമാണ് — സങ്കീർണ്ണമായ വൈദ്യ ചർച്ചകൾക്ക് പ്രൊഫഷണൽ വ്യാഖ്യാതാവിനെ ക്രമീകരിക്കാം.',
    agree: 'ഞാൻ സമ്മതിക്കുന്നു',
    decline: 'നിരസിക്കുക',
    scanPhone: 'ഫോണിൽ പിന്തുടരാൻ സ്കാൻ ചെയ്യുക',
    continueScreen: 'ഈ സ്ക്രീനിൽ തുടരുക',
    or: 'അല്ലെങ്കിൽ',
  },
  mr: {
    title: 'भाषांतर सेवा',
    step1: 'कर्मचारी इंग्रजी बोलतो',
    step2: 'तुम्ही तुमच्या भाषेत ऐकता',
    step3: 'तुम्ही उत्तर देता',
    consentText: 'आज तुमच्याशी संवाद साधण्यासाठी आमची AI भाषांतर सेवा वापरायची आहे. एक कर्मचारी सत्र नियंत्रित करेल. हे एक संवाद साधन आहे — गुंतागुंतीच्या वैद्यकीय चर्चांसाठी व्यावसायिक दुभाषी उपलब्ध करून दिला जाऊ शकतो.',
    agree: 'मी सहमत आहे',
    decline: 'नकार',
    scanPhone: 'फोनवर फॉलो करण्यासाठी स्कॅन करा',
    continueScreen: 'या स्क्रीनवर सुरू ठेवा',
    or: 'किंवा',
  },
  ne: {
    title: 'अनुवाद सेवा',
    step1: 'कर्मचारी अंग्रेजी बोल्छन्',
    step2: 'तपाईंले आफ्नो भाषामा सुन्नुहुन्छ',
    step3: 'तपाईं जवाफ दिनुहुन्छ',
    consentText: 'आज तपाईंसँग सम्वाद गर्न मद्दतको लागि हामी हाम्रो AI अनुवाद सेवा प्रयोग गर्न चाहान्छौं। एक कर्मचारीले सत्र नियन्त्रण गर्नेछन्। यो सञ्चार सहायता हो — जटिल चिकित्सा छलफलको लागि पेशेवर दोभाषे व्यवस्था गर्न सकिन्छ।',
    agree: 'म सहमत छु',
    decline: 'अस्वीकार',
    scanPhone: 'फोनमा अनुसरण गर्न स्क्यान गर्नुहोस्',
    continueScreen: 'यो स्क्रिनमा जारी राख्नुहोस्',
    or: 'वा',
  },
  ja: {
    title: '翻訳サービス',
    step1: 'スタッフが英語を話します',
    step2: 'あなたの言語で聞こえます',
    step3: '返答します',
    consentText: '本日、コミュニケーションを助けるためにAI翻訳サービスを使用したいと思います。スタッフがセッションを管理します。これはコミュニケーション補助です — 複雑な医療の話し合いには、プロの通訳を手配できます。',
    agree: '同意します',
    decline: '辞退',
    scanPhone: 'スマホでフォローするにはスキャン',
    continueScreen: 'この画面で続行',
    or: 'または',
  },
  ko: {
    title: '번역 서비스',
    step1: '직원이 영어로 말합니다',
    step2: '귀하의 언어로 들립니다',
    step3: '답변합니다',
    consentText: '오늘 귀하와 소통하기 위해 AI 번역 서비스를 사용하고자 합니다. 직원이 세션을 제어합니다. 이것은 의사소통 보조 수단입니다 — 복잡한 의료 논의를 위해 전문 통역사를 배치할 수 있습니다.',
    agree: '동의합니다',
    decline: '거부',
    scanPhone: '전화로 팔로우하려면 스캔하세요',
    continueScreen: '이 화면에서 계속',
    or: '또는',
  },
  sv: {
    title: 'Översättningstjänst',
    step1: 'Personalen talar engelska',
    step2: 'Du hör ditt språk',
    step3: 'Du svarar',
    consentText: 'Vi vill använda vår AI-översättningstjänst för att hjälpa oss kommunicera med dig idag. En personal kommer att styra sessionen. Detta är ett kommunikationshjälpmedel — för komplexa medicinska diskussioner kan en professionell tolk arrangeras.',
    agree: 'Jag godkänner',
    decline: 'Avböj',
    scanPhone: 'Skanna för att följa på din telefon',
    continueScreen: 'Fortsätt på denna skärm',
    or: 'eller',
  },
  no: {
    title: 'Oversettelsestjeneste',
    step1: 'Personalet snakker engelsk',
    step2: 'Du hører ditt språk',
    step3: 'Du svarer',
    consentText: 'Vi ønsker å bruke vår AI-oversettelsestjeneste for å hjelpe oss med å kommunisere med deg i dag. Et ansatt vil kontrollere økten. Dette er et kommunikasjonshjelpemiddel — for komplekse medisinske diskusjoner kan en profesjonell tolk arrangeres.',
    agree: 'Jeg godtar',
    decline: 'Avslå',
    scanPhone: 'Skann for å følge med på telefonen',
    continueScreen: 'Fortsett på denne skjermen',
    or: 'eller',
  },
  fi: {
    title: 'Käännöspalvelu',
    step1: 'Henkilökunta puhuu englantia',
    step2: 'Kuulet omalla kielelläsi',
    step3: 'Vastaat',
    consentText: 'Haluamme käyttää AI-käännöspalveluamme auttaaksemme viestinnässä kanssasi tänään. Henkilökunnan jäsen hallitsee istuntoa. Tämä on viestintäapu — monimutkaisiin lääketieteellisiin keskusteluihin voidaan järjestää ammattitulkki.',
    agree: 'Hyväksyn',
    decline: 'Kieltäydy',
    scanPhone: 'Skannaa seurataksesi puhelimellasi',
    continueScreen: 'Jatka tällä näytöllä',
    or: 'tai',
  },
  he: {
    title: 'שירות תרגום',
    step1: 'הצוות מדבר אנגלית',
    step2: 'אתם שומעים בשפה שלכם',
    step3: 'אתם עונים',
    consentText: 'ברצוננו להשתמש בשירות התרגום AI שלנו כדי לעזור לנו לתקשר איתכם היום. חבר צוות ישלוט בפגישה. זהו כלי עזר לתקשורת — לדיונים רפואיים מורכבים ניתן לסדר מתורגמן מקצועי.',
    agree: 'אני מסכים',
    decline: 'סירוב',
    scanPhone: 'סרוק כדי לעקוב בטלפון',
    continueScreen: 'המשך במסך זה',
    or: 'או',
  },
  sk: {
    title: 'Prekladateľská služba',
    step1: 'Personál hovorí anglicky',
    step2: 'Počujete vo svojom jazyku',
    step3: 'Odpovedáte',
    consentText: 'Radi by sme dnes použili našu službu AI prekladu, aby sme vám pomohli s komunikáciou. Člen personálu bude riadiť reláciu. Ide o komunikačnú pomôcku — pre zložité lekárske diskusie je možné zabezpečiť profesionálneho tlmočníka.',
    agree: 'Súhlasím',
    decline: 'Odmietnuť',
    scanPhone: 'Naskenujte pre sledovanie na telefóne',
    continueScreen: 'Pokračujte na tejto obrazovke',
    or: 'alebo',
  },
};

function getStrings(lang: string): ConsentStrings {
  return CONSENT_TRANSLATIONS[lang] || CONSENT_TRANSLATIONS['en'];
}

// ── COMPONENT ──

interface TranslationConsentCardProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
  patientLanguage: string;
  patientLanguageName: string;
  patientLanguageFlag?: string;
  practiceName: string;
  qrCodeUrl?: string;
}

export const TranslationConsentCard: React.FC<TranslationConsentCardProps> = ({
  open,
  onConsent,
  onDecline,
  patientLanguage,
  patientLanguageName,
  patientLanguageFlag,
  practiceName,
  qrCodeUrl,
}) => {
  const en = CONSENT_TRANSLATIONS['en'];
  const pt = getStrings(patientLanguage);
  const isRtl = RTL_LANGS.has(patientLanguage);
  const isNotEnglish = patientLanguage !== 'en';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDecline(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0 max-w-[580px] w-[95vw] rounded-[20px] shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300 [&>button]:hidden"
      >
        {/* ── HEADER BAND ── */}
        <div
          className="text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #003087, #005EB8)',
            padding: '1.5rem 2rem 1.25rem',
          }}
        >
          {/* Decorative circle */}
          <div
            className="absolute rounded-full"
            style={{
              top: '-40%', right: '-20%',
              width: 200, height: 200,
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <div className="text-[0.75rem] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {practiceName}
          </div>
          <div className="text-[1.3rem] font-bold text-white mt-1">
            {en.title}
          </div>
          {isNotEnglish && (
            <div
              className="text-[1.25rem] font-bold mt-0.5"
              style={{ color: 'rgba(255,255,255,0.8)', direction: isRtl ? 'rtl' : 'ltr' }}
            >
              {pt.title}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mt-2.5">
            <span className="text-white text-[0.78rem] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
              🇬🇧 English
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }} className="text-[0.95rem]">⇄</span>
            <span className="text-white text-[0.78rem] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
              {patientLanguageFlag} {patientLanguageName}
            </span>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="px-5 py-4 sm:px-7 sm:py-5">
          {/* ── 3 STEPS ── */}
          <div className="flex gap-1.5 sm:gap-2 mb-4">
            {/* Step 1 */}
            <StepCard
              icon="🎤"
              iconBg="#DBEAFE"
              label={en.step1}
              labelLocal={isNotEnglish ? pt.step1 : undefined}
              isRtl={isRtl}
              showConnector
            />
            {/* Step 2 */}
            <StepCard
              icon="🔊"
              iconBg="#D1FAE5"
              label={en.step2}
              labelLocal={isNotEnglish ? pt.step2 : undefined}
              isRtl={isRtl}
              showConnector
            />
            {/* Step 3 */}
            <StepCard
              icon="💬"
              iconBg="#FEF3C7"
              label={en.step3}
              labelLocal={isNotEnglish ? pt.step3 : undefined}
              isRtl={isRtl}
            />
          </div>

          {/* ── CONSENT TEXT + QR — SIDE BY SIDE ── */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {/* LEFT: Consent text */}
            <div className="flex-1 min-w-0">
              <p className="text-[0.82rem] leading-relaxed" style={{ color: '#4C6272' }}>
                {en.consentText}
              </p>
              {isNotEnglish && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f0', direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                  <p className="text-[0.82rem]" style={{ color: '#4C6272', lineHeight: 1.7 }}>
                    {pt.consentText}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: QR Code — desktop: column beside text; mobile: horizontal card below */}
            {qrCodeUrl && (
              <div className="flex-shrink-0 flex sm:flex-col items-center gap-2 sm:gap-1.5 sm:w-auto p-3 sm:p-0 rounded-xl sm:rounded-none sm:bg-transparent" style={{ background: 'var(--grey-100, #F0F4F5)' }}>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('consent-qr-container');
                    if (el) el.classList.toggle('qr-expanded');
                  }}
                  className="group w-20 h-20 sm:w-[120px] sm:h-[120px] flex-shrink-0 bg-white rounded-xl flex items-center justify-center p-1.5 transition-all duration-300 cursor-pointer hover:scale-[1.04] [&.qr-expanded]:!w-[220px] [&.qr-expanded]:!h-[220px] [&.qr-expanded]:sm:!w-[220px] [&.qr-expanded]:sm:!h-[220px]"
                  id="consent-qr-container"
                  style={{ border: '2px solid #F0F4F5', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  aria-label="Click to enlarge QR code"
                >
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-full rounded-md" />
                </button>
                <div className="flex flex-col justify-center gap-0.5 sm:items-center">
                  <span className="text-[0.65rem] font-semibold text-center sm:text-center" style={{ color: '#005EB8', lineHeight: 1.3 }}>
                    📱 {en.scanPhone}
                  </span>
                  <span className="text-[0.55rem] text-center" style={{ color: '#AEB7BD' }}>
                    Tap to enlarge
                  </span>
                  {isNotEnglish && (
                    <span className="text-[0.62rem] text-center sm:text-center" style={{ color: '#AEB7BD', direction: isRtl ? 'rtl' : 'ltr', lineHeight: 1.3 }}>
                      {pt.scanPhone}
                    </span>
                  )}
                  {/* "or" divider — desktop only */}
                  <div className="hidden sm:flex items-center gap-2 my-0.5 w-full">
                    <div className="flex-1 h-px" style={{ background: 'rgba(174,183,189,0.4)' }} />
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wide" style={{ color: '#AEB7BD' }}>{en.or}</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(174,183,189,0.4)' }} />
                  </div>
                  <span className="hidden sm:block text-[0.6rem] text-center" style={{ color: '#AEB7BD', lineHeight: 1.3 }}>
                    {en.continueScreen}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── BUTTONS ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onDecline}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[0.88rem] transition-all cursor-pointer border-0"
              style={{ background: '#F0F4F5', color: '#4C6272' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E5E7EB')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#F0F4F5')}
            >
              <span className="text-[1.05rem]">✕</span>
              <span className="flex flex-col items-center leading-tight">
                <span>{en.decline}</span>
                {isNotEnglish && (
                  <span className="text-[0.68rem] opacity-75 font-medium">{pt.decline}</span>
                )}
              </span>
            </button>
            <button
              onClick={onConsent}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[0.88rem] text-white transition-all cursor-pointer border-0 hover:-translate-y-px"
              style={{ background: '#009639', boxShadow: '0 4px 12px rgba(0, 150, 57, 0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#007A2F'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 150, 57, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#009639'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 150, 57, 0.3)'; }}
            >
              <span className="text-[1.05rem]">✓</span>
              <span className="flex flex-col items-center leading-tight">
                <span>{en.agree}</span>
                {isNotEnglish && (
                  <span className="text-[0.68rem] opacity-75 font-medium">{pt.agree}</span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ── PRIVACY FOOTER ── */}
        <div className="text-center text-[0.68rem] pb-3 px-7 flex items-center justify-center gap-1.5" style={{ color: '#AEB7BD' }}>
          🔒 No personal data is stored by this translation service
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── STEP CARD SUB-COMPONENT ──

function StepCard({
  icon,
  iconBg,
  label,
  labelLocal,
  isRtl,
  showConnector,
}: {
  icon: string;
  iconBg: string;
  label: string;
  labelLocal?: string;
  isRtl: boolean;
  showConnector?: boolean;
}) {
  return (
    <div className="flex-1 text-center py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl relative" style={{ background: '#F0F4F5' }}>
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mx-auto mb-1.5 text-[0.95rem] sm:text-[1.1rem]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="text-[0.6rem] sm:text-[0.68rem] font-semibold leading-tight" style={{ color: '#4C6272' }}>
        {label}
      </div>
      {labelLocal && (
        <div
          className="text-[0.55rem] sm:text-[0.65rem] font-semibold mt-0.5 leading-tight"
          style={{ color: '#AEB7BD', direction: isRtl ? 'rtl' : 'ltr' }}
        >
          {labelLocal}
        </div>
      )}
      {showConnector && (
        <span className="absolute -right-2.5 sm:-right-3 top-1/2 -translate-y-1/2 text-[0.85rem] z-10" style={{ color: '#AEB7BD' }}>
          →
        </span>
      )}
    </div>
  );
}
