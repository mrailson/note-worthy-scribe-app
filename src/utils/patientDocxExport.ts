import { TranslationEntry } from '@/components/TranslationHistory';
import { TranslationScore } from './translationScoring';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, WidthType } from 'docx';
import { saveAs } from 'file-saver';

// Patient-focused DOCX export functionality for translation history
export interface PatientSessionMetadata {
  sessionDate: Date;
  sessionStart: Date;  
  sessionEnd: Date;
  patientLanguage: string;
  totalTranslations: number;
  sessionDuration: number;
  practiceName?: string;
  practiceAddress?: string;
  practicePhone?: string;
  gpName?: string;
}

// Translation templates for different languages
const PATIENT_TRANSLATIONS = {
  // English fallback
  en: {
    title: "Your Medical Consultation Translation Record",
    subtitle: "Notewell AI Translation Service - Patient Copy",
    practiceInfo: "Practice Information",
    consultationDetails: "Consultation Details",
    date: "Date",
    time: "Time", 
    duration: "Duration",
    language: "Your Language",
    gpClinician: "GP/Clinician",
    totalTranslations: "Total Phrases Translated",
    conversationHistory: "Your Conversation History",
    original: "English (GP said)",
    translated: "Translation (for you)",
    safetyTitle: "Important Information About This Translation",
    safetyInfo: [
      "This translation was provided by an AI system to help communication during your medical appointment.",
      "While our system is highly accurate, translations may not always be perfect.",
      "This document is for your reference only and should not replace professional medical interpretation.",
      "If you have any concerns about the accuracy of the translation, please contact the practice."
    ],
    contactTitle: "What to do if you think something is wrong:",
    contactInfo: [
      "Contact the practice immediately if you have concerns about your treatment",
      "Ask for a qualified medical interpreter for future appointments if needed",
      "Keep this document for your records and show it to other healthcare providers if relevant"
    ],
    footer: "This translation record was generated automatically. Please contact the practice if you have any questions.",
    disclaimer: "IMPORTANT: This is a translation aid only. For critical medical decisions, please request a qualified medical interpreter."
  },
  
  // Arabic
  ar: {
    title: "سجل ترجمة الاستشارة الطبية الخاصة بك",
    subtitle: "خدمة الترجمة لهيئة الخدمات الصحية الوطنية - نسخة المريض",
    practiceInfo: "معلومات العيادة",
    consultationDetails: "تفاصيل الاستشارة",
    date: "التاريخ",
    time: "الوقت",
    duration: "المدة",
    language: "لغتك",
    gpClinician: "الطبيب/الطبيب السريري",
    totalTranslations: "إجمالي العبارات المترجمة",
    conversationHistory: "تاريخ محادثتك",
    original: "الإنجليزية (ما قاله الطبيب)",
    translated: "الترجمة (لك)",
    safetyTitle: "معلومات مهمة حول هذه الترجمة",
    safetyInfo: [
      "تم توفير هذه الترجمة بواسطة نظام ذكي للمساعدة في التواصل أثناء موعدك الطبي.",
      "بينما نظامنا دقيق جداً، قد لا تكون الترجمات مثالية دائماً.",
      "هذا المستند للمرجع فقط ولا يجب أن يحل محل الترجمة الطبية المهنية.",
      "إذا كان لديك أي مخاوف حول دقة الترجمة، يرجى الاتصال بالعيادة."
    ],
    contactTitle: "ما يجب فعله إذا كنت تعتقد أن هناك خطأ:",
    contactInfo: [
      "اتصل بالعيادة فوراً إذا كان لديك مخاوف حول علاجك",
      "اطلب مترجماً طبياً مؤهلاً للمواعيد المستقبلية إذا لزم الأمر",
      "احتفظ بهذا المستند لسجلاتك وأظهره لمقدمي الرعاية الصحية الآخرين إذا كان ذا صلة"
    ],
    footer: "تم إنشاء سجل الترجمة هذا تلقائياً. يرجى الاتصال بالعيادة إذا كان لديك أي أسئلة.",
    disclaimer: "مهم: هذه مساعدة ترجمة فقط. للقرارات الطبية المهمة، يرجى طلب مترجم طبي مؤهل."
  },

  // Polish
  pl: {
    title: "Twój Zapis Tłumaczenia Konsultacji Medycznej",
    subtitle: "Usługa Tłumaczenia NHS - Kopia dla Pacjenta",
    practiceInfo: "Informacje o Praktyce",
    consultationDetails: "Szczegóły Konsultacji",
    date: "Data",
    time: "Czas",
    duration: "Czas trwania",
    language: "Twój Język",
    gpClinician: "Lekarz",
    totalTranslations: "Łączna Liczba Przetłumaczonych Fraz",
    conversationHistory: "Historia Twojej Rozmowy",
    original: "Angielski (powiedział lekarz)",
    translated: "Tłumaczenie (dla Ciebie)",
    safetyTitle: "Ważne Informacje o Tym Tłumaczeniu",
    safetyInfo: [
      "To tłumaczenie zostało dostarczone przez system AI, aby pomóc w komunikacji podczas Twojej wizyty lekarskiej.",
      "Chociaż nasz system jest bardzo dokładny, tłumaczenia mogą nie zawsze być idealne.",
      "Ten dokument służy tylko jako odniesienie i nie powinien zastępować profesjonalnego tłumaczenia medycznego.",
      "Jeśli masz jakiekolwiek obawy dotyczące dokładności tłumaczenia, skontaktuj się z praktyką."
    ],
    contactTitle: "Co robić, jeśli uważasz, że coś jest nie tak:",
    contactInfo: [
      "Skontaktuj się z praktyką natychmiast, jeśli masz obawy dotyczące swojego leczenia",
      "Poproś o wykwalifikowanego tłumacza medycznego na przyszłe wizyty, jeśli to konieczne",
      "Zachowaj ten dokument dla swoich zapisów i pokaż go innym pracownikom służby zdrowia, jeśli to istotne"
    ],
    footer: "Ten zapis tłumaczenia został wygenerowany automatycznie. Skontaktuj się z praktyką, jeśli masz jakiekolwiek pytania.",
    disclaimer: "WAŻNE: To tylko pomoc w tłumaczeniu. W przypadku krytycznych decyzji medycznych, poproś o wykwalifikowanego tłumacza medycznego."
  },

  // Spanish  
  es: {
    title: "Su Registro de Traducción de Consulta Médica",
    subtitle: "Servicio de Traducción del NHS - Copia del Paciente",
    practiceInfo: "Información de la Consulta",
    consultationDetails: "Detalles de la Consulta",
    date: "Fecha",
    time: "Hora",
    duration: "Duración",
    language: "Su Idioma",
    gpClinician: "Médico de Cabecera/Clínico",
    totalTranslations: "Total de Frases Traducidas",
    conversationHistory: "Historial de Su Conversación",
    original: "Inglés (lo que dijo el médico)",
    translated: "Traducción (para usted)",
    safetyTitle: "Información Importante Sobre Esta Traducción",
    safetyInfo: [
      "Esta traducción fue proporcionada por un sistema de IA para ayudar en la comunicación durante su cita médica.",
      "Aunque nuestro sistema es muy preciso, las traducciones pueden no ser siempre perfectas.",
      "Este documento es solo para su referencia y no debe reemplazar la interpretación médica profesional.",
      "Si tiene alguna preocupación sobre la precisión de la traducción, por favor contacte a la consulta."
    ],
    contactTitle: "Qué hacer si cree que algo está mal:",
    contactInfo: [
      "Contacte a la consulta inmediatamente si tiene preocupaciones sobre su tratamiento",
      "Solicite un intérprete médico calificado para futuras citas si es necesario",
      "Guarde este documento para sus registros y muéstrelo a otros proveedores de atención médica si es relevante"
    ],
    footer: "Este registro de traducción fue generado automáticamente. Por favor contacte a la consulta si tiene alguna pregunta.",
    disclaimer: "IMPORTANTE: Esto es solo una ayuda de traducción. Para decisiones médicas críticas, por favor solicite un intérprete médico calificado."
  }
};

// Get the appropriate language pack or fall back to English
function getLanguagePack(languageCode: string) {
  const langCode = languageCode.toLowerCase().substring(0, 2);
  return PATIENT_TRANSLATIONS[langCode as keyof typeof PATIENT_TRANSLATIONS] || PATIENT_TRANSLATIONS.en;
}

// Detect primary patient language from translations
function detectPatientLanguage(translations: TranslationEntry[]): string {
  const languageCounts: { [key: string]: number } = {};
  
  translations.forEach(translation => {
    if (translation.speaker === 'patient') {
      const targetLang = translation.targetLanguage.toLowerCase();
      languageCounts[targetLang] = (languageCounts[targetLang] || 0) + 1;
    }
  });
  
  // Return the most common patient language or 'en' as fallback
  const mostCommonLang = Object.entries(languageCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'en';
    
  return mostCommonLang;
}

/**
 * Downloads a patient-focused translation session as a DOCX file
 */
export async function downloadPatientDOCX(
  translations: TranslationEntry[],
  metadata: PatientSessionMetadata,
  translationScores: TranslationScore[]
): Promise<void> {
  try {
    // Deduplicate translations based on exact timestamp
    const deduplicatedTranslations = translations.filter((translation, index, array) => {
      const timestamp = translation.timestamp.getTime();
      return array.findIndex(t => t.timestamp.getTime() === timestamp) === index;
    });

    // Detect patient language and get appropriate translations
    const patientLanguage = detectPatientLanguage(deduplicatedTranslations);
    const t = getLanguagePack(patientLanguage);
    
    const formatDuration = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };
    
    const children = [
      // Header with Patient and Document Icons (using text symbols)
      new Paragraph({
        children: [
          new TextRun({
            text: "👤 📄 ",
            size: 32
          }),
          new TextRun({
            text: t.title,
            bold: true,
            size: 32,
            color: "005EB8"
          })
        ],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
      }),
      
      new Paragraph({
        children: [
          new TextRun({
            text: t.subtitle,
            size: 24,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      
      new Paragraph({ text: "" }), // Empty line
      
      // Practice Information
      new Paragraph({
        children: [new TextRun({ text: t.practiceInfo, bold: true, size: 28, color: "005EB8" })],
        heading: HeadingLevel.HEADING_2
      }),
      
      ...(metadata.practiceName ? [
        new Paragraph({ children: [new TextRun(`${metadata.practiceName}`)] })
      ] : []),
      ...(metadata.practiceAddress ? [
        new Paragraph({ children: [new TextRun(`${metadata.practiceAddress}`)] })
      ] : []),
      ...(metadata.practicePhone ? [
        new Paragraph({ children: [new TextRun(`${metadata.practicePhone}`)] })
      ] : []),
      
      new Paragraph({ text: "" }), // Empty line
      
      // Consultation Details
      new Paragraph({
        children: [new TextRun({ text: t.consultationDetails, bold: true, size: 28, color: "005EB8" })],
        heading: HeadingLevel.HEADING_2
      }),
      
      new Paragraph({ children: [new TextRun(`${t.date}: ${metadata.sessionDate.toLocaleDateString()}`)] }),
      new Paragraph({ children: [new TextRun(`${t.time}: ${metadata.sessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${metadata.sessionEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)] }),
      new Paragraph({ children: [new TextRun(`${t.duration}: ${formatDuration(metadata.sessionDuration)}`)] }),
      new Paragraph({ children: [new TextRun(`${t.language}: ${metadata.patientLanguage}`)] }),
      ...(metadata.gpName ? [
        new Paragraph({ children: [new TextRun(`${t.gpClinician}: ${metadata.gpName}`)] })
      ] : []),
      new Paragraph({ children: [new TextRun(`${t.totalTranslations}: ${metadata.totalTranslations}`)] }),
      
      new Paragraph({ text: "" }), // Empty line
      
      // Conversation History
      new Paragraph({
        children: [new TextRun({ text: t.conversationHistory, bold: true, size: 28, color: "005EB8" })],
        heading: HeadingLevel.HEADING_2
      }),
    ];

    // Add conversation entries
    deduplicatedTranslations.forEach((translation, index) => {
      // Entry number and timestamp
      children.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: `${index + 1}. ${translation.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 
              bold: true,
              color: "333333"
            })
          ]
        })
      );

      // Original text (what GP said)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${t.original}: `, bold: true, color: "0066CC" }),
            new TextRun({ text: translation.originalText, color: "333333" })
          ]
        })
      );

      // Translated text (for patient)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${t.translated}: `, bold: true, color: "006600" }),
            new TextRun({ text: translation.translatedText, color: "333333" })
          ]
        })
      );

      children.push(new Paragraph({ text: "" })); // Space between entries
    });

    // Safety Information
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: t.safetyTitle, bold: true, size: 24, color: "CC6600" })],
        heading: HeadingLevel.HEADING_2
      })
    );

    // Add safety info points
    t.safetyInfo.forEach(info => {
      children.push(
        new Paragraph({
          children: [
            new TextRun("• "),
            new TextRun(info)
          ],
          indent: { left: 720 }
        })
      );
    });

    // Contact Information
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: t.contactTitle, bold: true, size: 20, color: "CC0000" })]
      })
    );

    t.contactInfo.forEach(info => {
      children.push(
        new Paragraph({
          children: [
            new TextRun("• "),
            new TextRun(info)
          ],
          indent: { left: 720 }
        })
      );
    });

    // Footer and Disclaimer
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({
          text: t.disclaimer,
          bold: true,
          size: 20,
          color: "CC0000"
        })],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({
          text: t.footer,
          size: 18,
          italics: true,
          color: "666666"
        })],
        alignment: AlignmentType.CENTER
      })
    );

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    // Generate and save
    const blob = await Packer.toBlob(doc);
    const dateStr = metadata.sessionDate.toLocaleDateString('en-GB').replace(/\//g, '-');
    const timeStr = metadata.sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
    const languageName = HEALTHCARE_LANGUAGES.find(lang => lang.code === String(metadata.patientLanguage || '').toLowerCase())?.name 
      || String(metadata.patientLanguage || 'English');
    const languageStr = languageName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `Notewell_AI_Translation_Audit_${dateStr}_${timeStr}_${languageStr}.docx`;
    saveAs(blob, filename);
    
  } catch (error) {
    console.error('Error generating patient DOCX:', error);
    throw new Error('Failed to generate patient translation record');
  }
}