/**
 * generateTranslationReportDocx.ts
 * 
 * NHS-grade Patient Communication Report generator for the Live Translate service.
 * Produces a branded, governance-compliant bilingual DOCX with:
 *   - Key metrics dashboard
 *   - Full session details including tech stack
 *   - Side-by-side bilingual conversation transcript
 *   - Clinical governance & compliance section (DCB0129, DCB0160, DTAC, DPIA)
 *   - Bilingual patient disclaimer
 * 
 * MHRA Class I registered — Notewell AI
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageBreak,
  LevelFormat,
  TabStopType,
} from 'docx';
import { TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';

// ── NHS-ALIGNED COLOUR PALETTE ──────────────────────────────
const NHS_BLUE    = '005EB8';
const NHS_DARK    = '003087';
const ACCENT_GREEN = '009639';
const ACCENT_AMBER = 'D4771B';
const PURPLE      = '7C3AED';
const GREY_900    = '212B32';
const GREY_600    = '4C6272';
const GREY_300    = 'AEB7BD';
const GREY_100    = 'F0F4F5';
const WHITE       = 'FFFFFF';

// ── BORDER PRESETS ──────────────────────────────────────────
const noBorder  = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinBorder  = { style: BorderStyle.SINGLE, size: 1, color: GREY_300 };
const thinBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

// ── TABLE WIDTH (A4 with ~19mm margins) ─────────────────────
const TABLE_W = 9706;

// ── LOCALISED "said" LABELS ─────────────────────────────────
const GP_SAID: Record<string, string> = {
  en: 'GP Practice', ar: 'قالت العيادة', zh: '诊所', 'zh-TW': '診所',
  fr: 'Le cabinet médical', de: 'Die Praxis', hi: 'जीपी प्रैक्टिस',
  it: 'Lo studio medico', es: 'La consulta médica', pl: 'Gabinet lekarski',
  pt: 'A clínica', ro: 'Cabinetul medical', ru: 'Клиника', tr: 'Sağlık merkezi',
  fa: 'مطب', ur: 'جی پی پریکٹس', bn: 'জিপি প্র্যাকটিস', pa: 'ਜੀਪੀ ਪ੍ਰੈਕਟਿਸ',
  gu: 'જીપી પ્રેક્ટિસ', ta: 'ஜிபி பிராக்டிஸ்', te: 'జిపి ప్రాక్టీస్',
  uk: 'Клініка', vi: 'Phòng khám', th: 'คลินิก', sw: 'Kliniki', am: 'ክሊኒክ',
  so: 'Xarunta', ja: 'クリニック', ko: '진료소', bg: 'Практиката',
  hr: 'Ordinacija', cs: 'Ordinace', da: 'Lægepraksis', nl: 'De huisartsenpraktijk',
  el: 'Το ιατρείο', hu: 'A rendelő', fi: 'Vastaanotto', sv: 'Vårdcentralen',
  no: 'Legekontoret', he: 'המרפאה', sk: 'Ambulancia',
};
const PT_SAID: Record<string, string> = {
  en: 'Patient', ar: 'قال المريض', zh: '患者', 'zh-TW': '患者',
  fr: 'Le patient', de: 'Der Patient', hi: 'मरीज', it: 'Il paziente',
  es: 'El paciente', pl: 'Pacjent', pt: 'O paciente', ro: 'Pacientul',
  ru: 'Пациент', tr: 'Hasta', fa: 'بیمار', ur: 'مریض', bn: 'রোগী',
  pa: 'ਮਰੀਜ਼', gu: 'દર્દી', ta: 'நோயாளி', te: 'రోగి', uk: 'Пацієнт',
  vi: 'Bệnh nhân', th: 'ผู้ป่วย', sw: 'Mgonjwa', am: 'ታካሚ',
  so: 'Bukaanku', ja: '患者さん', ko: '환자', bg: 'Пациентът',
  hr: 'Pacijent', cs: 'Pacient', da: 'Patienten', nl: 'De patiënt',
  el: 'Ο ασθενής', hu: 'A páciens', fi: 'Potilas', sv: 'Patienten',
  no: 'Pasienten', he: 'המטופל', sk: 'Pacient',
};

// ── BILINGUAL PATIENT DISCLAIMERS ───────────────────────────
const PATIENT_DISCLAIMER: Record<string, { heading: string; body: string; caveat: string }> = {
  en: {
    heading: 'English',
    body: 'This document is a record of the conversation that took place using our AI-powered translation service. Please review it carefully. If anything appears incorrect, confusing, or if you believe something was mistranslated, please contact the practice immediately.',
    caveat: 'This service is provided as a communication aid and does not replace professional medical interpretation. For complex medical discussions, a qualified interpreter should be requested.',
  },
  ar: {
    heading: 'العربية',
    body: 'هذه الوثيقة هي نسخة من المحادثة التي جرت اليوم باستخدام خدمة الترجمة لدينا. يرجى مراجعتها بعناية. إذا كان هناك شيء لا يبدو صحيحًا، أو مربكًا، أو إذا كنت تعتقد أن شيئًا ما قد تمت ترجمته بشكل خاطئ، يرجى الاتصال بالعيادة فورًا.',
    caveat: 'هذه الخدمة هي وسيلة مساعدة للتواصل ولا تحل محل الترجمة الطبية المهنية. للمناقشات الطبية المعقدة، يجب طلب مترجم مؤهل.',
  },
  fr: {
    heading: 'Français',
    body: "Ce document est un enregistrement de la conversation qui a eu lieu à l'aide de notre service de traduction. Veuillez le lire attentivement. Si quelque chose semble incorrect, prêtant à confusion, ou si vous pensez qu'une erreur de traduction s'est produite, veuillez contacter le cabinet immédiatement.",
    caveat: "Ce service est fourni comme aide à la communication et ne remplace pas l'interprétation médicale professionnelle.",
  },
  es: {
    heading: 'Español',
    body: 'Este documento es un registro de la conversación que tuvo lugar utilizando nuestro servicio de traducción. Por favor, revíselo cuidadosamente. Si algo parece incorrecto, confuso, o si cree que algo fue mal traducido, comuníquese con la consulta de inmediato.',
    caveat: 'Este servicio se proporciona como una ayuda de comunicación y no reemplaza la interpretación médica profesional.',
  },
  pl: {
    heading: 'Polski',
    body: 'Niniejszy dokument jest zapisem rozmowy przeprowadzonej za pomocą naszego serwisu tłumaczeniowego. Prosimy o uważne zapoznanie się z jego treścią. Jeśli cokolwiek wydaje się nieprawidłowe, niejasne lub jeśli uważasz, że coś zostało błędnie przetłumaczone, prosimy o natychmiastowy kontakt z gabinetem.',
    caveat: 'Usługa ta jest środkiem wspomagającym komunikację i nie zastępuje profesjonalnego tłumaczenia medycznego.',
  },
  ro: {
    heading: 'Română',
    body: 'Acest document este o înregistrare a conversației care a avut loc folosind serviciul nostru de traducere. Vă rugăm să îl revizuiți cu atenție. Dacă ceva pare incorect, confuz sau dacă credeți că ceva a fost tradus greșit, vă rugăm să contactați cabinetul imediat.',
    caveat: 'Acest serviciu este oferit ca un ajutor de comunicare și nu înlocuiește interpretarea medicală profesională.',
  },
  pt: {
    heading: 'Português',
    body: 'Este documento é um registo da conversa que teve lugar utilizando o nosso serviço de tradução. Por favor, reveja-o cuidadosamente. Se algo parecer incorreto, confuso, ou se acredita que algo foi mal traduzido, contacte a clínica imediatamente.',
    caveat: 'Este serviço é fornecido como um auxílio de comunicação e não substitui a interpretação médica profissional.',
  },
  ur: {
    heading: 'اردو',
    body: 'یہ دستاویز آج ہماری ترجمے کی سروس کا استعمال کرتے ہوئے ہونے والی بات چیت کا ریکارڈ ہے۔ براہ کرم اسے غور سے پڑھیں۔ اگر کچھ غلط، الجھا ہوا، یا غلط ترجمہ لگے تو فوری طور پر پریکٹس سے رابطہ کریں۔',
    caveat: 'یہ سروس مواصلات میں مدد کے طور پر فراہم کی جاتی ہے اور پیشہ ورانہ طبی ترجمانی کی جگہ نہیں لیتی۔',
  },
  hi: {
    heading: 'हिन्दी',
    body: 'यह दस्तावेज़ आज हमारी अनुवाद सेवा का उपयोग करके हुई बातचीत का रिकॉर्ड है। कृपया इसे ध्यान से पढ़ें। यदि कुछ गलत, भ्रमित करने वाला लगे, या यदि आपको लगता है कि कुछ गलत अनुवाद किया गया है, तो कृपया तुरंत प्रैक्टिस से संपर्क करें।',
    caveat: 'यह सेवा संचार सहायता के रूप में प्रदान की जाती है और पेशेवर चिकित्सा दुभाषिया की जगह नहीं लेती।',
  },
  bn: {
    heading: 'বাংলা',
    body: 'এই নথিটি আজ আমাদের অনুবাদ সেবা ব্যবহার করে হওয়া কথোপকথনের একটি রেকর্ড। অনুগ্রহ করে এটি মনোযোগ সহকারে পড়ুন। কিছু ভুল, বিভ্রান্তিকর বা ভুল অনুবাদ মনে হলে অনুগ্রহ করে অবিলম্বে প্র্যাকটিসে যোগাযোগ করুন।',
    caveat: 'এই সেবাটি যোগাযোগ সহায়তা হিসেবে প্রদান করা হয় এবং পেশাদার চিকিৎসা দোভাষীর বিকল্প নয়।',
  },
  pa: {
    heading: 'ਪੰਜਾਬੀ',
    body: 'ਇਹ ਦਸਤਾਵੇਜ਼ ਅੱਜ ਸਾਡੀ ਅਨੁਵਾਦ ਸੇਵਾ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਹੋਈ ਗੱਲਬਾਤ ਦਾ ਰਿਕਾਰਡ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਇਸਨੂੰ ਧਿਆਨ ਨਾਲ ਪੜ੍ਹੋ। ਜੇ ਕੁਝ ਗਲਤ, ਉਲਝਾਉਣ ਵਾਲਾ ਜਾਂ ਗਲਤ ਅਨੁਵਾਦ ਲੱਗੇ ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਤੁਰੰਤ ਪ੍ਰੈਕਟਿਸ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
    caveat: 'ਇਹ ਸੇਵਾ ਸੰਚਾਰ ਸਹਾਇਤਾ ਵਜੋਂ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ ਅਤੇ ਪੇਸ਼ੇਵਰ ਡਾਕਟਰੀ ਦੁਭਾਸ਼ੀਏ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦੀ।',
  },
  tr: {
    heading: 'Türkçe',
    body: 'Bu belge, çeviri hizmetimiz kullanılarak gerçekleşen görüşmenin kaydıdır. Lütfen dikkatlice inceleyin. Herhangi bir şey yanlış, kafa karıştırıcı veya yanlış çevrilmiş görünüyorsa, lütfen derhal sağlık merkezine başvurun.',
    caveat: 'Bu hizmet bir iletişim yardımı olarak sunulmaktadır ve profesyonel tıbbi tercümanlığın yerini almaz.',
  },
  ru: {
    heading: 'Русский',
    body: 'Этот документ является записью разговора, проведённого с использованием нашего сервиса перевода. Пожалуйста, внимательно его прочитайте. Если что-то кажется неправильным, запутанным или вы считаете, что что-то было переведено неверно, немедленно свяжитесь с клиникой.',
    caveat: 'Этот сервис предоставляется как вспомогательное средство коммуникации и не заменяет профессионального медицинского переводчика.',
  },
  so: {
    heading: 'Soomaali',
    body: 'Dukumeentigan waa diiwaanka wada hadalka maanta loo adeegsaday adeegga turjumaadda. Fadlan si taxadar leh u akhri. Haddii wax khaldan, jahawareer, ama turjumaan khaldan la arko, fadlan isla markiiba la xiriir xarunta.',
    caveat: 'Adeeggan waa qalab u gargaara xiriirka, mana beddelayo turjubaan caafimaad oo xirfad leh.',
  },
  ti: {
    heading: 'ትግርኛ',
    body: 'እዚ ሰነድ ሎሚ ብኣገልግሎት ትርጉም ዝተገብረ ዝርርብ ምዝገባ እዩ። ብጥንቃቐ ኣንብብዎ። ገለ ነገር ጌጋ፣ ዘደንጹ ወይ ብጌጋ ዝተተርጎመ ዝመስል እንተሃልዩ፣ ብቕልጡፍ ነታ ክሊኒክ ተወከሱ።',
    caveat: 'እዚ ኣገልግሎት ንርክብ ሓገዝ እዩ ዝወሃብ፤ ንሞያዊ ሕክምናዊ ትርጉም ኣይትክእን።',
  },
  fa: {
    heading: 'فارسی',
    body: 'این سند ثبت مکالمه‌ای است که امروز با استفاده از خدمات ترجمه ما انجام شد. لطفاً آن را با دقت بررسی کنید. اگر چیزی نادرست، گیج‌کننده یا اشتباه ترجمه شده به نظر می‌رسد، فوراً با مطب تماس بگیرید.',
    caveat: 'این خدمت به عنوان کمک ارتباطی ارائه می‌شود و جایگزین ترجمه حرفه‌ای پزشکی نیست.',
  },
};

// ── HELPERS ──────────────────────────────────────────────────

function spacer(pts = 120): Paragraph {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
}

function sectionHeading(text: string, colour = NHS_BLUE): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: colour, space: 4 } },
    children: [new TextRun({ text, font: 'Arial', size: 26, bold: true, color: colour })],
  });
}

function metricCell(label: string, value: string, colour = NHS_BLUE): TableCell {
  return new TableCell({
    borders: noBorders,
    width: { size: 2200, type: WidthType.DXA },
    shading: { fill: GREY_100, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({ spacing: { after: 40 }, children: [
        new TextRun({ text: value, font: 'Arial', size: 36, bold: true, color: colour }),
      ] }),
      new Paragraph({ children: [
        new TextRun({ text: label, font: 'Arial', size: 16, color: GREY_600 }),
      ] }),
    ],
  });
}

function spacerCell(w = 140): TableCell {
  return new TableCell({
    borders: noBorders,
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph('')],
  });
}

function detailRow(label: string, value: string, even: boolean) {
  const bg = even ? GREY_100 : WHITE;
  return new TableRow({
    children: [
      new TableCell({
        borders: noBorders, width: { size: 2800, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: 'Arial', size: 20, bold: true, color: GREY_600 })] })],
      }),
      new TableCell({
        borders: noBorders, width: { size: TABLE_W - 2800, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 80, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Arial', size: 20, color: GREY_900 })] })],
      }),
    ],
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function durationMinutes(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

// Determine if language is RTL
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'ku']);
function isRtl(langCode: string): boolean {
  return RTL_LANGS.has(langCode.split('-')[0]);
}

// ── MAIN EXPORT ─────────────────────────────────────────────

interface ReportOptions {
  messages: TranslationMessage[];
  patientLanguage: string;
  patientLanguageName: string;
  sessionStart: Date;
  sessionEnd: Date;
  practiceInfo?: {
    name?: string;
    address?: string;
    logoUrl?: string;
  };
}

export async function generateTranslationReportDocx(options: ReportOptions): Promise<void> {
  const {
    messages,
    patientLanguage,
    patientLanguageName,
    sessionStart,
    sessionEnd,
    practiceInfo,
  } = options;

  const practiceName = practiceInfo?.name || 'GP Practice';
  const practiceAddress = practiceInfo?.address || '';
  const langInfo = HEALTHCARE_LANGUAGES.find((l) => l.code === patientLanguage);
  const langFlag = langInfo?.flag || '';
  const langNative = patientLanguageName;
  const duration = durationMinutes(sessionStart, sessionEnd);
  const staffCount = messages.filter((m) => m.speaker === 'staff').length;
  const patientCount = messages.filter((m) => m.speaker === 'patient').length;
  const rtl = isRtl(patientLanguage);
  const patientAlign = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  // Has ElevenLabs voice?
  const hasElevenLabs = langInfo?.hasElevenLabsVoice;
  const ttsLabel = hasElevenLabs
    ? `ElevenLabs (${patientLanguageName}) \u2022 Natural voice playback`
    : langInfo?.hasGoogleTTSVoice
      ? `Google Cloud TTS (${patientLanguageName})`
      : 'Not available for this language';

  // ── Build conversation rows ──
  const transcriptRows: TableRow[] = messages.map((msg, i) => {
    const isStaff = msg.speaker === 'staff';
    const bg = i % 2 === 0 ? GREY_100 : WHITE;
    const speakerEn = isStaff ? (GP_SAID['en'] || 'GP Practice') : (PT_SAID['en'] || 'Patient');
    const speakerLocal = isStaff
      ? (GP_SAID[patientLanguage] || GP_SAID['en'])
      : (PT_SAID[patientLanguage] || PT_SAID['en']);
    const speakerColour = isStaff ? NHS_BLUE : ACCENT_GREEN;
    const ts = msg.timestamp ? formatTime(new Date(msg.timestamp)) : '';
    const enText = isStaff ? msg.originalText : (msg.translatedText || msg.originalText);
    const patText = isStaff ? (msg.translatedText || '') : msg.originalText;

    return new TableRow({
      children: [
        // Time
        new TableCell({
          borders: thinBorders, width: { size: 600, type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: ts, font: 'Arial', size: 16, color: GREY_600 }),
          ] })],
        }),
        // English
        new TableCell({
          borders: thinBorders, width: { size: 4553, type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [
              new TextRun({ text: speakerEn, font: 'Arial', size: 16, bold: true, color: speakerColour }),
            ] }),
            new Paragraph({ children: [
              new TextRun({ text: enText, font: 'Arial', size: 19, color: GREY_900 }),
            ] }),
          ],
        }),
        // Patient language
        new TableCell({
          borders: thinBorders, width: { size: 4553, type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ alignment: patientAlign, spacing: { after: 40 }, children: [
              new TextRun({ text: speakerLocal, font: 'Arial', size: 16, bold: true, color: speakerColour }),
            ] }),
            new Paragraph({ alignment: patientAlign, children: [
              new TextRun({ text: patText, font: 'Arial', size: 19, color: GREY_900 }),
            ] }),
          ],
        }),
      ],
    });
  });

  // ── Transcript table header ──
  const transcriptHeader = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders: thinBorders, width: { size: 600, type: WidthType.DXA },
        shading: { fill: NHS_BLUE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'Time', font: 'Arial', size: 16, bold: true, color: WHITE }),
        ] })],
      }),
      new TableCell({
        borders: thinBorders, width: { size: 4553, type: WidthType.DXA },
        shading: { fill: NHS_BLUE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [
          new TextRun({ text: '\uD83C\uDDEC\uD83C\uDDE7  English', font: 'Arial', size: 18, bold: true, color: WHITE }),
        ] })],
      }),
      new TableCell({
        borders: thinBorders, width: { size: 4553, type: WidthType.DXA },
        shading: { fill: NHS_BLUE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: patientAlign, children: [
          new TextRun({
            text: rtl ? `${langNative}  ${langFlag}` : `${langFlag}  ${langNative}`,
            font: 'Arial', size: 18, bold: true, color: WHITE,
          }),
        ] })],
      }),
    ],
  });

  // ── Build disclaimer boxes ──
  function disclaimerBox(
    heading: string, body: string, caveat: string,
    align: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT = AlignmentType.LEFT,
    thickSide: 'left' | 'right' = 'left',
  ): Table {
    const thinPurple = { style: BorderStyle.SINGLE, size: 2, color: PURPLE };
    const thickPurple = { style: BorderStyle.SINGLE, size: 6, color: PURPLE };
    return new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: [TABLE_W],
      rows: [new TableRow({
        children: [new TableCell({
          borders: {
            top: thinPurple, bottom: thinPurple,
            left: thickSide === 'left' ? thickPurple : thinPurple,
            right: thickSide === 'right' ? thickPurple : thinPurple,
          },
          width: { size: TABLE_W, type: WidthType.DXA },
          shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new Paragraph({ alignment: align, spacing: { after: 80 }, children: [
              new TextRun({ text: heading, font: 'Arial', size: 20, bold: true, color: PURPLE }),
            ] }),
            new Paragraph({ alignment: align, spacing: { after: 60 }, children: [
              new TextRun({ text: body, font: 'Arial', size: 19, color: GREY_900 }),
            ] }),
            new Paragraph({ alignment: align, children: [
              new TextRun({ text: caveat, font: 'Arial', size: 19, color: GREY_600, italics: true }),
            ] }),
          ],
        })],
      })],
    });
  }

  const enDisclaimer = PATIENT_DISCLAIMER['en'];
  const ptDisclaimer = PATIENT_DISCLAIMER[patientLanguage] || PATIENT_DISCLAIMER['en'];

  // ── Governance bullet points ──
  const governanceBullets = [
    'DCB0129 (Clinical Risk Management) \u2014 Hazard log maintained with risk assessments for AI-assisted translation',
    'DCB0160 (Clinical Risk Management for Health IT Systems) \u2014 Northamptonshire deployment framework v2.1',
    'DTAC (Digital Technology Assessment Criteria) \u2014 Compliance assessment completed',
    'DPIA completed \u2014 Data processed in-session only; no patient data is stored by the translation service',
    'Content moderation active \u2014 Profanity detection with clinical terminology allowlist prevents inappropriate translations while preserving medical vocabulary',
  ];

  // ── ASSEMBLE DOCUMENT ──
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: GREY_900 } } },
    },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 900, bottom: 900, left: 1100, right: 1100 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NHS_BLUE, space: 6 } },
                spacing: { after: 0 },
                tabStops: [{ type: TabStopType.RIGHT, position: TABLE_W }],
                children: [
                  new TextRun({ text: practiceName, font: 'Arial', size: 18, bold: true, color: NHS_BLUE }),
                  new TextRun({ text: '   |   ', font: 'Arial', size: 18, color: GREY_300 }),
                  new TextRun({ text: 'Notewell AI Translation Service', font: 'Arial', size: 18, color: GREY_600 }),
                  new TextRun({ text: '\t', font: 'Arial' }),
                  new TextRun({ text: 'CONFIDENTIAL', font: 'Arial', size: 16, bold: true, color: ACCENT_AMBER }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: GREY_300, space: 6 } },
                children: [
                  new TextRun({
                    text: 'Notewell AI  \u2022  MHRA Class I Registered Medical Device  \u2022  DCB0129 Compliant',
                    font: 'Arial', size: 14, color: GREY_600,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: `${practiceName}${practiceAddress ? '  |  ' + practiceAddress : ''}  |  This document contains patient-identifiable information`,
                    font: 'Arial', size: 12, color: GREY_300,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── TITLE ──
          spacer(80),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Patient Communication Report', font: 'Arial', size: 44, bold: true, color: NHS_DARK }),
            ],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({ text: `Live Translation Session  \u2022  English `, font: 'Arial', size: 22, color: GREY_600 }),
              new TextRun({ text: '\u2194', font: 'Arial', size: 22, color: NHS_BLUE }),
              new TextRun({ text: ` ${patientLanguageName}`, font: 'Arial', size: 22, color: GREY_600 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `${formatDate(sessionStart)}  \u2022  ${formatTime(sessionStart)} \u2013 ${formatTime(sessionEnd)}`,
                font: 'Arial', size: 20, color: GREY_600,
              }),
            ],
          }),

          // ── METRICS ──
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [2200, 140, 2200, 140, 2200, 140, 2686 - 140],
            rows: [new TableRow({
              children: [
                metricCell('Total Exchanges', String(messages.length)),
                spacerCell(),
                metricCell('Session Duration', `${duration} min`),
                spacerCell(),
                metricCell('Staff Messages', String(staffCount)),
                spacerCell(),
                metricCell('Patient Messages', String(patientCount)),
              ],
            })],
          }),

          // ── SESSION DETAILS ──
          sectionHeading('Session Details'),
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [2800, TABLE_W - 2800],
            rows: [
              detailRow('Practice', practiceName, true),
              detailRow('Date & Time', `${formatDate(sessionStart)}, ${formatTime(sessionStart)} \u2013 ${formatTime(sessionEnd)} (${duration} minutes)`, false),
              detailRow('Patient Language', `${langFlag}  ${patientLanguageName}`, true),
              detailRow('Translation Engine', 'Google Cloud Translation API v3', false),
              detailRow('Speech Recognition', 'Web Speech API (Chrome) with dynamic silence detection', true),
              detailRow('Text-to-Speech', ttsLabel, false),
              detailRow('Content Moderation', 'Active \u2014 profanity filter with clinical terminology allowlist', true),
            ],
          }),

          // ── TRANSCRIPT ──
          sectionHeading('Conversation Transcript'),
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [600, 4553, 4553],
            rows: [transcriptHeader, ...transcriptRows],
          }),

          // ── PAGE BREAK → GOVERNANCE ──
          new Paragraph({ children: [new PageBreak()] }),

          sectionHeading('Clinical Governance & Quality Assurance', NHS_DARK),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({
              text: 'This translation session was facilitated by Notewell AI, an MHRA Class I registered medical device developed specifically for NHS primary care. The platform complies with the following clinical safety and information governance standards:',
              font: 'Arial', size: 20, color: GREY_900,
            })],
          }),
          ...governanceBullets.map((text) =>
            new Paragraph({
              numbering: { reference: 'bullets', level: 0 },
              spacing: { after: 60 },
              children: [new TextRun({ text, font: 'Arial', size: 19, color: GREY_900 })],
            })
          ),

          spacer(100),

          // ── DISCLAIMERS ──
          sectionHeading('Important Information for the Patient', PURPLE),
          disclaimerBox(enDisclaimer.heading, enDisclaimer.body, enDisclaimer.caveat, AlignmentType.LEFT, 'left'),
          spacer(120),
          ...(patientLanguage !== 'en' ? [
            disclaimerBox(ptDisclaimer.heading, ptDisclaimer.body, ptDisclaimer.caveat, patientAlign, rtl ? 'right' : 'left'),
            spacer(200),
          ] : []),

          // ── FOOTER STAMP ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [new TextRun({
              text: `Report generated on ${sessionEnd.toLocaleDateString('en-GB')} at ${formatTime(sessionEnd)} by Notewell AI`,
              font: 'Arial', size: 16, color: GREY_300,
            })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40 },
            children: [new TextRun({
              text: 'MHRA Class I  \u2022  Not-for-profit  \u2022  Built for NHS Primary Care',
              font: 'Arial', size: 14, color: GREY_300,
            })],
          }),
        ],
      },
    ],
  });

  // ── GENERATE & DOWNLOAD ──
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translation-report-${sessionEnd.toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
