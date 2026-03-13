/**
 * generatePatientHandoutDocx.ts
 * 
 * Patient-friendly A4 Word document with visit summary, key points,
 * actions and bilingual disclaimer. Returns a Blob for flexible use.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  PageBreak,
} from 'docx';

// ── NHS-ALIGNED COLOURS ────────────────────────────────────
const NHS_BLUE  = '005EB8';
const GREY_600  = '4C6272';
const GREY_900  = '212B32';
const ACCENT_AMBER = 'D4771B';

// ── RTL DETECTION ──────────────────────────────────────────
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'ku']);
function isRtl(langCode: string): boolean {
  return RTL_LANGS.has(langCode.split('-')[0]);
}

// ── BILINGUAL DISCLAIMERS (reused from report generator) ───
const DISCLAIMERS: Record<string, { heading: string; body: string; caveat: string }> = {
  en: {
    heading: 'Important Information',
    body: 'This document is a summary of your visit using our AI-powered translation service. Please read it carefully. If anything seems wrong or confusing, or if you think something was mistranslated, please contact us straight away.',
    caveat: 'This service helps with communication but does not replace a professional medical interpreter. For complex medical discussions, please ask for a qualified interpreter.',
  },
  ar: { heading: 'معلومات مهمة', body: 'هذه الوثيقة ملخص لزيارتك باستخدام خدمة الترجمة الآلية. يرجى قراءتها بعناية. إذا بدا شيء خاطئًا أو مربكًا، يرجى الاتصال بنا فورًا.', caveat: 'هذه الخدمة تساعد في التواصل ولكنها لا تحل محل مترجم طبي محترف.' },
  fr: { heading: 'Informations importantes', body: "Ce document résume votre visite via notre service de traduction. Veuillez le lire attentivement. Si quelque chose semble incorrect, contactez-nous immédiatement.", caveat: "Ce service aide à la communication mais ne remplace pas un interprète médical professionnel." },
  es: { heading: 'Información importante', body: 'Este documento resume su visita usando nuestro servicio de traducción. Léalo cuidadosamente. Si algo parece incorrecto, contáctenos de inmediato.', caveat: 'Este servicio ayuda con la comunicación pero no reemplaza a un intérprete médico profesional.' },
  pl: { heading: 'Ważne informacje', body: 'Ten dokument jest podsumowaniem Twojej wizyty z wykorzystaniem naszego serwisu tłumaczeniowego. Przeczytaj go uważnie. Jeśli coś wydaje się nieprawidłowe, skontaktuj się z nami natychmiast.', caveat: 'Ta usługa pomaga w komunikacji, ale nie zastępuje profesjonalnego tłumacza medycznego.' },
  ro: { heading: 'Informații importante', body: 'Acest document rezumă vizita dvs. folosind serviciul nostru de traducere. Citiți-l cu atenție. Dacă ceva pare incorect, contactați-ne imediat.', caveat: 'Acest serviciu ajută la comunicare dar nu înlocuiește un interpret medical profesionist.' },
  ur: { heading: 'اہم معلومات', body: 'یہ دستاویز ہمارے ترجمے کے نظام کا استعمال کرتے ہوئے آپ کے دورے کا خلاصہ ہے۔ براہ کرم اسے غور سے پڑھیں۔ اگر کچھ غلط لگے تو فوری طور پر ہم سے رابطہ کریں۔', caveat: 'یہ خدمت مواصلات میں مدد کرتی ہے لیکن پیشہ ور طبی مترجم کی جگہ نہیں لیتی۔' },
  hi: { heading: 'महत्वपूर्ण जानकारी', body: 'यह दस्तावेज़ हमारी अनुवाद सेवा का उपयोग करके आपकी विजिट का सारांश है। कृपया इसे ध्यान से पढ़ें। अगर कुछ गलत लगे तो तुरंत हमसे संपर्क करें।', caveat: 'यह सेवा संचार में मदद करती है लेकिन पेशेवर चिकित्सा दुभाषिया की जगह नहीं लेती।' },
  bn: { heading: 'গুরুত্বপূর্ণ তথ্য', body: 'এই নথিটি আমাদের অনুবাদ সেবা ব্যবহার করে আপনার পরিদর্শনের সারসংক্ষেপ। অনুগ্রহ করে মনোযোগ সহকারে পড়ুন। কিছু ভুল মনে হলে অবিলম্বে যোগাযোগ করুন।', caveat: 'এই সেবা যোগাযোগে সহায়তা করে তবে পেশাদার চিকিৎসা দোভাষীর বিকল্প নয়।' },
  pa: { heading: 'ਮਹੱਤਵਪੂਰਨ ਜਾਣਕਾਰੀ', body: 'ਇਹ ਦਸਤਾਵੇਜ਼ ਸਾਡੀ ਅਨੁਵਾਦ ਸੇਵਾ ਰਾਹੀਂ ਤੁਹਾਡੀ ਫੇਰੀ ਦਾ ਸਾਰ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਧਿਆਨ ਨਾਲ ਪੜ੍ਹੋ। ਕੁਝ ਗਲਤ ਲੱਗੇ ਤਾਂ ਤੁਰੰਤ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।', caveat: 'ਇਹ ਸੇਵਾ ਸੰਚਾਰ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ ਪਰ ਪੇਸ਼ੇਵਰ ਡਾਕਟਰੀ ਦੁਭਾਸ਼ੀਏ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦੀ।' },
  tr: { heading: 'Önemli Bilgi', body: 'Bu belge çeviri hizmetimizi kullanarak yaptığınız ziyaretin özetidir. Lütfen dikkatlice okuyun. Yanlış görünen bir şey varsa hemen bize ulaşın.', caveat: 'Bu hizmet iletişime yardımcı olur ancak profesyonel tıbbi tercümanlığın yerini almaz.' },
  ru: { heading: 'Важная информация', body: 'Этот документ — краткое изложение вашего визита с использованием нашего сервиса перевода. Внимательно прочитайте. Если что-то кажется неверным, немедленно свяжитесь с нами.', caveat: 'Этот сервис помогает в общении, но не заменяет профессионального медицинского переводчика.' },
  so: { heading: 'Macluumaad Muhiim ah', body: 'Dukumeentigan waa soo koobid booqashadaada ee adeegga turjumaadda. Fadlan si taxadar leh u akhri. Haddii wax khaldan la arko, isla markiiba nala soo xiriir.', caveat: 'Adeeggan waa qalab u gargaara xiriirka, mana beddelayo turjubaan caafimaad oo xirfad leh.' },
  fa: { heading: 'اطلاعات مهم', body: 'این سند خلاصه‌ای از ویزیت شما با استفاده از خدمات ترجمه ماست. لطفاً با دقت بخوانید. اگر چیزی اشتباه به نظر می‌رسد، فوراً با ما تماس بگیرید.', caveat: 'این خدمت به ارتباط کمک می‌کند اما جایگزین مترجم حرفه‌ای پزشکی نیست.' },
  zh: { heading: '重要信息', body: '本文件是您使用我们翻译服务就诊的摘要。请仔细阅读。如有任何错误，请立即联系我们。', caveat: '此服务有助于沟通，但不能替代专业医疗口译。' },
  pt: { heading: 'Informação Importante', body: 'Este documento resume a sua visita usando o nosso serviço de tradução. Leia com atenção. Se algo parecer errado, contacte-nos imediatamente.', caveat: 'Este serviço ajuda na comunicação mas não substitui um intérprete médico profissional.' },
  de: { heading: 'Wichtige Information', body: 'Dieses Dokument fasst Ihren Besuch mit unserem Übersetzungsdienst zusammen. Bitte lesen Sie es sorgfältig. Kontaktieren Sie uns sofort, wenn etwas falsch erscheint.', caveat: 'Dieser Dienst unterstützt die Kommunikation, ersetzt aber keinen professionellen medizinischen Dolmetscher.' },
  it: { heading: 'Informazioni Importanti', body: "Questo documento riassume la vostra visita tramite il nostro servizio di traduzione. Leggetelo attentamente. Se qualcosa sembra errato, contattateci immediatamente.", caveat: "Questo servizio aiuta la comunicazione ma non sostituisce un interprete medico professionale." },
  hr: { heading: 'Važne informacije', body: 'Ovaj dokument je sažetak vašeg posjeta korištenjem naše usluge prijevoda. Pažljivo ga pročitajte. Ako nešto djeluje netočno, odmah nas kontaktirajte.', caveat: 'Ova usluga pomaže u komunikaciji, ali ne zamjenjuje profesionalnog medicinskog prevoditelja.' },
  cs: { heading: 'Důležité informace', body: 'Tento dokument je shrnutí vaší návštěvy s využitím naší překladatelské služby. Pečlivě si jej přečtěte. Pokud se něco zdá nesprávné, okamžitě nás kontaktujte.', caveat: 'Tato služba pomáhá s komunikací, ale nenahrazuje profesionálního zdravotnického tlumočníka.' },
  sk: { heading: 'Dôležité informácie', body: 'Tento dokument je zhrnutie vašej návštevy s využitím našej prekladateľskej služby. Pozorne si ho prečítajte. Ak sa niečo zdá nesprávne, okamžite nás kontaktujte.', caveat: 'Táto služba pomáha s komunikáciou, ale nenahrádza profesionálneho zdravotníckeho tlmočníka.' },
  nl: { heading: 'Belangrijke informatie', body: 'Dit document is een samenvatting van uw bezoek via onze vertaaldienst. Lees het aandachtig. Als iets onjuist lijkt, neem dan onmiddellijk contact met ons op.', caveat: 'Deze dienst helpt bij communicatie maar vervangt geen professionele medische tolk.' },
  hu: { heading: 'Fontos információ', body: 'Ez a dokumentum az Ön látogatásának összefoglalója fordítási szolgáltatásunk használatával. Kérjük, olvassa el figyelmesen. Ha valami helytelennek tűnik, azonnal lépjen kapcsolatba velünk.', caveat: 'Ez a szolgáltatás segít a kommunikációban, de nem helyettesíti a professzionális orvosi tolmácsot.' },
};

// ── LOCALISED SECTION HEADINGS ─────────────────────────────
const SECTION_LABELS: Record<string, { visitSummary: string; keyPoints: string; actions: string }> = {
  en: { visitSummary: 'Visit Summary', keyPoints: 'Key Points', actions: 'What You Need to Do' },
  ar: { visitSummary: 'ملخص الزيارة', keyPoints: 'النقاط الرئيسية', actions: 'ما عليك فعله' },
  fr: { visitSummary: 'Résumé de la visite', keyPoints: 'Points clés', actions: 'Ce que vous devez faire' },
  es: { visitSummary: 'Resumen de la visita', keyPoints: 'Puntos clave', actions: 'Lo que necesita hacer' },
  pl: { visitSummary: 'Podsumowanie wizyty', keyPoints: 'Kluczowe punkty', actions: 'Co musisz zrobić' },
  ro: { visitSummary: 'Rezumatul vizitei', keyPoints: 'Puncte cheie', actions: 'Ce trebuie să faceți' },
  ur: { visitSummary: 'دورے کا خلاصہ', keyPoints: 'اہم نکات', actions: 'آپ کو کیا کرنا ہے' },
  hi: { visitSummary: 'विजिट सारांश', keyPoints: 'मुख्य बातें', actions: 'आपको क्या करना है' },
  bn: { visitSummary: 'পরিদর্শন সারসংক্ষেপ', keyPoints: 'মূল বিষয়সমূহ', actions: 'আপনাকে যা করতে হবে' },
  pa: { visitSummary: 'ਫੇਰੀ ਦਾ ਸਾਰ', keyPoints: 'ਮੁੱਖ ਗੱਲਾਂ', actions: 'ਤੁਹਾਨੂੰ ਕੀ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ' },
  tr: { visitSummary: 'Ziyaret Özeti', keyPoints: 'Önemli Noktalar', actions: 'Yapmanız Gerekenler' },
  ru: { visitSummary: 'Краткое изложение визита', keyPoints: 'Ключевые моменты', actions: 'Что вам нужно сделать' },
  so: { visitSummary: 'Soo koobidda booqashada', keyPoints: 'Qodobbada muhiimka', actions: 'Waxa aad u baahan tahay inaad sameyso' },
  fa: { visitSummary: 'خلاصه ویزیت', keyPoints: 'نکات کلیدی', actions: 'کارهایی که باید انجام دهید' },
  zh: { visitSummary: '就诊摘要', keyPoints: '要点', actions: '您需要做的事' },
  pt: { visitSummary: 'Resumo da visita', keyPoints: 'Pontos-chave', actions: 'O que precisa de fazer' },
  de: { visitSummary: 'Besuchszusammenfassung', keyPoints: 'Wichtige Punkte', actions: 'Was Sie tun müssen' },
  it: { visitSummary: 'Riepilogo visita', keyPoints: 'Punti chiave', actions: 'Cosa dovete fare' },
  // Additional languages
  hr: { visitSummary: 'Sažetak posjeta', keyPoints: 'Ključne točke', actions: 'Što trebate učiniti' },
  cs: { visitSummary: 'Shrnutí návštěvy', keyPoints: 'Klíčové body', actions: 'Co musíte udělat' },
  sk: { visitSummary: 'Zhrnutie návštevy', keyPoints: 'Kľúčové body', actions: 'Čo musíte urobiť' },
  nl: { visitSummary: 'Samenvatting bezoek', keyPoints: 'Belangrijke punten', actions: 'Wat u moet doen' },
  el: { visitSummary: 'Περίληψη επίσκεψης', keyPoints: 'Βασικά σημεία', actions: 'Τι πρέπει να κάνετε' },
  hu: { visitSummary: 'Látogatás összefoglalója', keyPoints: 'Főbb pontok', actions: 'Mit kell tennie' },
  ja: { visitSummary: '診察の概要', keyPoints: '重要なポイント', actions: 'やるべきこと' },
  ko: { visitSummary: '방문 요약', keyPoints: '주요 사항', actions: '해야 할 일' },
  vi: { visitSummary: 'Tóm tắt buổi khám', keyPoints: 'Điểm chính', actions: 'Việc bạn cần làm' },
  ne: { visitSummary: 'भ्रमण सारांश', keyPoints: 'मुख्य कुराहरू', actions: 'तपाईंले के गर्नुपर्छ' },
  sw: { visitSummary: 'Muhtasari wa ziara', keyPoints: 'Mambo muhimu', actions: 'Unachohitaji kufanya' },
  ta: { visitSummary: 'வருகை சுருக்கம்', keyPoints: 'முக்கிய குறிப்புகள்', actions: 'நீங்கள் செய்ய வேண்டியது' },
  gu: { visitSummary: 'મુલાકાત સારાંશ', keyPoints: 'મુખ્ય મુદ્દાઓ', actions: 'તમારે શું કરવાનું છે' },
  lt: { visitSummary: 'Vizito santrauka', keyPoints: 'Pagrindiniai punktai', actions: 'Ką turite padaryti' },
  lv: { visitSummary: 'Vizītes kopsavilkums', keyPoints: 'Galvenie punkti', actions: 'Kas jums jādara' },
  uk: { visitSummary: 'Підсумок візиту', keyPoints: 'Ключові моменти', actions: 'Що вам потрібно зробити' },
  am: { visitSummary: 'የጉብኝት ማጠቃለያ', keyPoints: 'ዋና ነጥቦች', actions: 'ምን ማድረግ እንዳለብዎት' },
  ti: { visitSummary: 'ጽሟቕ ምብጻሕ', keyPoints: 'ቀንዲ ነጥብታት', actions: 'እንታይ ክትገብሩ ከም ዘለኩም' },
  ps: { visitSummary: 'د لیدنې لنډیز', keyPoints: 'مهم ټکي', actions: 'تاسو باید څه وکړئ' },
  ku: { visitSummary: 'کورتەی سەردان', keyPoints: 'خاڵە سەرەکییەکان', actions: 'دەبێت چی بکەیت' },
};

export interface PatientSummaryData {
  summary: string;
  keyPoints: string[];
  actions: string[];
  summaryEnglish: string;
  keyPointsEnglish: string[];
  actionsEnglish: string[];
}

export interface PatientHandoutOptions {
  summaryData: PatientSummaryData;
  patientLanguage: string;
  patientLanguageName: string;
  sessionDate: Date;
  practiceName: string;
  practiceAddress?: string;
}

export async function generatePatientHandoutDocx(options: PatientHandoutOptions): Promise<Blob> {
  const {
    summaryData,
    patientLanguage,
    patientLanguageName,
    sessionDate,
    practiceName,
    practiceAddress,
  } = options;

  const langCode = patientLanguage.split('-')[0];
  const rtl = isRtl(langCode);
  const patientAlign = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const labels = SECTION_LABELS[langCode] || SECTION_LABELS.en;
  const labelsEn = SECTION_LABELS.en;
  const disclaimer = DISCLAIMERS[langCode] || DISCLAIMERS.en;
  const disclaimerEn = DISCLAIMERS.en;

  const dateStr = sessionDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const children: Paragraph[] = [];

  // ── HEADER ──
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: practiceName, font: 'Arial', size: 28, bold: true, color: NHS_BLUE })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NHS_BLUE, space: 6 } },
      children: [
        new TextRun({ text: `${labels.visitSummary} / ${labelsEn.visitSummary}`, font: 'Arial', size: 24, bold: true, color: GREY_900 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: dateStr, font: 'Arial', size: 20, color: GREY_600 }),
        new TextRun({ text: `  •  ${patientLanguageName}`, font: 'Arial', size: 20, color: GREY_600 }),
      ],
    }),
  );

  // ── PATIENT LANGUAGE SECTION ──
  // Summary
  children.push(
    sectionHeading(labels.visitSummary, patientAlign),
    new Paragraph({
      spacing: { after: 200 },
      alignment: patientAlign,
      children: [new TextRun({ text: summaryData.summary, font: 'Arial', size: 22, color: GREY_900 })],
    }),
  );

  // Key Points
  if (summaryData.keyPoints.length > 0) {
    children.push(sectionHeading(labels.keyPoints, patientAlign));
    for (const point of summaryData.keyPoints) {
      children.push(bulletPoint(point, patientAlign));
    }
    children.push(spacer());
  }

  // Actions
  if (summaryData.actions.length > 0) {
    children.push(sectionHeading(labels.actions, patientAlign));
    for (const action of summaryData.actions) {
      children.push(bulletPoint(`✅ ${action}`, patientAlign, ACCENT_AMBER));
    }
    children.push(spacer());
  }

  // ── SEPARATOR ──
  children.push(
    new Paragraph({
      spacing: { before: 300, after: 300 },
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'AEB7BD', space: 4 } },
      children: [new TextRun({ text: '— English —', font: 'Arial', size: 18, color: GREY_600, italics: true })],
    }),
  );

  // ── ENGLISH SECTION ──
  children.push(
    sectionHeading(labelsEn.visitSummary, AlignmentType.LEFT),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: summaryData.summaryEnglish, font: 'Arial', size: 22, color: GREY_900 })],
    }),
  );

  if (summaryData.keyPointsEnglish.length > 0) {
    children.push(sectionHeading(labelsEn.keyPoints, AlignmentType.LEFT));
    for (const point of summaryData.keyPointsEnglish) {
      children.push(bulletPoint(point, AlignmentType.LEFT));
    }
    children.push(spacer());
  }

  if (summaryData.actionsEnglish.length > 0) {
    children.push(sectionHeading(labelsEn.actions, AlignmentType.LEFT));
    for (const action of summaryData.actionsEnglish) {
      children.push(bulletPoint(`✅ ${action}`, AlignmentType.LEFT, ACCENT_AMBER));
    }
    children.push(spacer());
  }

  // ── DISCLAIMER ──
  children.push(
    new Paragraph({
      spacing: { before: 400, after: 100 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT_AMBER, space: 6 },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT_AMBER, space: 6 },
      },
      alignment: patientAlign,
      children: [
        new TextRun({ text: `⚠ ${disclaimer.heading}`, font: 'Arial', size: 20, bold: true, color: ACCENT_AMBER }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      alignment: patientAlign,
      children: [new TextRun({ text: disclaimer.body, font: 'Arial', size: 18, color: GREY_600 })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      alignment: patientAlign,
      children: [new TextRun({ text: disclaimer.caveat, font: 'Arial', size: 18, italics: true, color: GREY_600 })],
    }),
  );

  // English disclaimer if different language
  if (langCode !== 'en') {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: `⚠ ${disclaimerEn.heading}`, font: 'Arial', size: 20, bold: true, color: ACCENT_AMBER }),
        ],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: disclaimerEn.body, font: 'Arial', size: 18, color: GREY_600 })],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: disclaimerEn.caveat, font: 'Arial', size: 18, italics: true, color: GREY_600 })],
      }),
    );
  }

  // ── FOOTER: PRACTICE CONTACT ──
  children.push(
    new Paragraph({
      spacing: { before: 300, after: 40 },
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: NHS_BLUE, space: 8 } },
      children: [new TextRun({ text: practiceName, font: 'Arial', size: 18, bold: true, color: NHS_BLUE })],
    }),
  );

  if (practiceAddress) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: practiceAddress, font: 'Arial', size: 16, color: GREY_600 })],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Sherpa Translation Service • Notewell AI • MHRA Class I', font: 'Arial', size: 14, color: 'AEB7BD' })],
    }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2cm
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}

// ── HELPERS ─────────────────────────────────────────────────

function sectionHeading(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    alignment,
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: NHS_BLUE, space: 4 } },
    children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: NHS_BLUE })],
  });
}

function bulletPoint(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, colour = GREY_900): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    alignment,
    indent: { left: 360 },
    children: [new TextRun({ text: `• ${text}`, font: 'Arial', size: 21, color: colour })],
  });
}

function spacer(pts = 80): Paragraph {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
}

/**
 * Generate a plain-text version of the patient handout for SMS.
 * Kept short to fit within SMS limits.
 */
export function generatePatientHandoutSMS(
  summaryData: PatientSummaryData,
  patientLanguageName: string,
  practiceName: string,
): string {
  const lines: string[] = [];
  lines.push(`${practiceName} - Visit Summary`);
  lines.push('');
  lines.push(summaryData.summary);

  if (summaryData.actions.length > 0) {
    lines.push('');
    for (const a of summaryData.actions) {
      lines.push(`✅ ${a}`);
    }
  }

  lines.push('');
  lines.push('⚠ This summary was created using AI translation. If anything seems wrong, please contact the practice immediately.');
  lines.push('');
  lines.push(practiceName);

  return lines.join('\n');
}

/**
 * Generate an HTML string for printing.
 */
export function generatePatientHandoutHTML(
  summaryData: PatientSummaryData,
  patientLanguage: string,
  patientLanguageName: string,
  sessionDate: Date,
  practiceName: string,
  practiceAddress?: string,
): string {
  const langCode = patientLanguage.split('-')[0];
  const rtl = isRtl(langCode);
  const dir = rtl ? 'rtl' : 'ltr';
  const labels = SECTION_LABELS[langCode] || SECTION_LABELS.en;
  const labelsEn = SECTION_LABELS.en;
  const disclaimer = DISCLAIMERS[langCode] || DISCLAIMERS.en;
  const disclaimerEn = DISCLAIMERS.en;
  const dateStr = sessionDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Visit Summary - ${practiceName}</title>
  <style>
    @media print { @page { size: A4; margin: 2cm; } }
    body { font-family: Arial, sans-serif; color: #212B32; max-width: 700px; margin: 0 auto; padding: 20px; line-height: 1.5; }
    .header { text-align: center; border-bottom: 3px solid #005EB8; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { color: #005EB8; margin: 0 0 4px; font-size: 18px; }
    .header h2 { margin: 0 0 8px; font-size: 16px; }
    .header .date { color: #4C6272; font-size: 13px; }
    .section-title { color: #005EB8; font-size: 15px; font-weight: bold; border-bottom: 2px solid #005EB8; padding-bottom: 4px; margin: 20px 0 10px; }
    .summary { font-size: 14px; margin-bottom: 16px; }
    ul { padding-left: 20px; }
    li { font-size: 14px; margin-bottom: 6px; }
    .actions li { color: #D4771B; font-weight: 500; }
    .separator { text-align: center; color: #4C6272; font-style: italic; border-bottom: 1px solid #AEB7BD; padding-bottom: 8px; margin: 24px 0; font-size: 13px; }
    .disclaimer { border: 2px solid #D4771B; border-radius: 8px; padding: 12px 16px; margin: 24px 0; }
    .disclaimer h4 { color: #D4771B; margin: 0 0 6px; font-size: 13px; }
    .disclaimer p { font-size: 12px; color: #4C6272; margin: 0 0 4px; }
    .footer { text-align: center; border-top: 2px solid #005EB8; padding-top: 12px; margin-top: 24px; }
    .footer .practice { color: #005EB8; font-weight: bold; font-size: 13px; }
    .footer .address { color: #4C6272; font-size: 11px; }
    .footer .branding { color: #AEB7BD; font-size: 10px; margin-top: 8px; }
    .rtl { direction: rtl; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${practiceName}</h1>
    <h2>${labels.visitSummary} / ${labelsEn.visitSummary}</h2>
    <div class="date">${dateStr} • ${patientLanguageName}</div>
  </div>

  <div ${rtl ? 'class="rtl"' : ''}>
    <div class="section-title">${labels.visitSummary}</div>
    <div class="summary">${summaryData.summary}</div>

    ${summaryData.keyPoints.length > 0 ? `
    <div class="section-title">${labels.keyPoints}</div>
    <ul>${summaryData.keyPoints.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}

    ${summaryData.actions.length > 0 ? `
    <div class="section-title">${labels.actions}</div>
    <ul class="actions">${summaryData.actions.map(a => `<li>✅ ${a}</li>`).join('')}</ul>` : ''}
  </div>

  <div class="separator">— English —</div>

  <div class="section-title">${labelsEn.visitSummary}</div>
  <div class="summary">${summaryData.summaryEnglish}</div>

  ${summaryData.keyPointsEnglish.length > 0 ? `
  <div class="section-title">${labelsEn.keyPoints}</div>
  <ul>${summaryData.keyPointsEnglish.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}

  ${summaryData.actionsEnglish.length > 0 ? `
  <div class="section-title">${labelsEn.actions}</div>
  <ul class="actions">${summaryData.actionsEnglish.map(a => `<li>✅ ${a}</li>`).join('')}</ul>` : ''}

  <div class="disclaimer" ${rtl ? 'class="rtl"' : ''}>
    <h4>⚠ ${disclaimer.heading}</h4>
    <p>${disclaimer.body}</p>
    <p><em>${disclaimer.caveat}</em></p>
  </div>
  ${langCode !== 'en' ? `
  <div class="disclaimer">
    <h4>⚠ ${disclaimerEn.heading}</h4>
    <p>${disclaimerEn.body}</p>
    <p><em>${disclaimerEn.caveat}</em></p>
  </div>` : ''}

  <div class="footer">
    <div class="practice">${practiceName}</div>
    ${practiceAddress ? `<div class="address">${practiceAddress}</div>` : ''}
    <div class="branding">Sherpa Translation Service • Notewell AI • MHRA Class I</div>
  </div>
</body>
</html>`;
}
