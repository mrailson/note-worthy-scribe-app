const RTL_LANGUAGES = ['ar', 'ur', 'fa', 'he', 'ps', 'ku'];

const HANDOUT_TRANSLATIONS: Record<string, {
  translationService: string;
  scanInstruction: string;
  noApp: string;
  free: string;
  privateSecure: string;
  staffSpeaks: string;
  youHear: string;
  youSpeak: string;
}> = {
  en: { translationService: 'Translation Service', scanInstruction: 'Scan with your phone camera', noApp: 'No app needed', free: 'Free', privateSecure: 'Private & secure', staffSpeaks: 'Staff speaks English', youHear: 'You hear your language', youSpeak: 'You speak back' },
  ar: { translationService: 'خدمة الترجمة', scanInstruction: 'امسح بكاميرا هاتفك', noApp: 'لا حاجة لتطبيق', free: 'مجاني', privateSecure: 'خاص وآمن', staffSpeaks: 'الموظف يتحدث الإنجليزية', youHear: 'تسمع بلغتك', youSpeak: 'تتحدث بالرد' },
  fr: { translationService: 'Service de traduction', scanInstruction: 'Scannez avec l\'appareil photo', noApp: 'Aucune application requise', free: 'Gratuit', privateSecure: 'Privé et sécurisé', staffSpeaks: 'Le personnel parle anglais', youHear: 'Vous entendez votre langue', youSpeak: 'Vous répondez' },
  es: { translationService: 'Servicio de traducción', scanInstruction: 'Escanee con la cámara del teléfono', noApp: 'Sin aplicación', free: 'Gratis', privateSecure: 'Privado y seguro', staffSpeaks: 'El personal habla inglés', youHear: 'Escucha en su idioma', youSpeak: 'Usted responde' },
  pl: { translationService: 'Usługa tłumaczeniowa', scanInstruction: 'Zeskanuj aparatem telefonu', noApp: 'Bez aplikacji', free: 'Bezpłatnie', privateSecure: 'Prywatne i bezpieczne', staffSpeaks: 'Personel mówi po angielsku', youHear: 'Słyszysz w swoim języku', youSpeak: 'Odpowiadasz' },
  ro: { translationService: 'Serviciu de traducere', scanInstruction: 'Scanați cu camera telefonului', noApp: 'Fără aplicație', free: 'Gratuit', privateSecure: 'Privat și sigur', staffSpeaks: 'Personalul vorbește engleză', youHear: 'Auziți în limba dvs.', youSpeak: 'Răspundeți' },
  pt: { translationService: 'Serviço de tradução', scanInstruction: 'Digitalize com a câmara do telemóvel', noApp: 'Sem aplicação', free: 'Gratuito', privateSecure: 'Privado e seguro', staffSpeaks: 'O pessoal fala inglês', youHear: 'Ouve no seu idioma', youSpeak: 'Responde' },
  ur: { translationService: 'ترجمہ کی خدمت', scanInstruction: 'اپنے فون کے کیمرے سے اسکین کریں', noApp: 'ایپ کی ضرورت نہیں', free: 'مفت', privateSecure: 'نجی اور محفوظ', staffSpeaks: 'عملہ انگریزی بولتا ہے', youHear: 'آپ اپنی زبان میں سنتے ہیں', youSpeak: 'آپ جواب دیتے ہیں' },
  hi: { translationService: 'अनुवाद सेवा', scanInstruction: 'अपने फोन के कैमरे से स्कैन करें', noApp: 'कोई ऐप नहीं चाहिए', free: 'मुफ़्त', privateSecure: 'निजी और सुरक्षित', staffSpeaks: 'स्टाफ अंग्रेजी बोलता है', youHear: 'आप अपनी भाषा में सुनते हैं', youSpeak: 'आप जवाब देते हैं' },
  bn: { translationService: 'অনুবাদ সেবা', scanInstruction: 'আপনার ফোনের ক্যামেরা দিয়ে স্ক্যান করুন', noApp: 'অ্যাপের দরকার নেই', free: 'বিনামূল্যে', privateSecure: 'ব্যক্তিগত ও নিরাপদ', staffSpeaks: 'কর্মীরা ইংরেজিতে কথা বলেন', youHear: 'আপনি আপনার ভাষায় শুনবেন', youSpeak: 'আপনি উত্তর দেন' },
  pa: { translationService: 'ਅਨੁਵਾਦ ਸੇਵਾ', scanInstruction: 'ਆਪਣੇ ਫ਼ੋਨ ਦੇ ਕੈਮਰੇ ਨਾਲ ਸਕੈਨ ਕਰੋ', noApp: 'ਕੋਈ ਐਪ ਨਹੀਂ ਚਾਹੀਦੀ', free: 'ਮੁਫ਼ਤ', privateSecure: 'ਨਿੱਜੀ ਅਤੇ ਸੁਰੱਖਿਅਤ', staffSpeaks: 'ਸਟਾਫ਼ ਅੰਗਰੇਜ਼ੀ ਬੋਲਦਾ ਹੈ', youHear: 'ਤੁਸੀਂ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸੁਣਦੇ ਹੋ', youSpeak: 'ਤੁਸੀਂ ਜਵਾਬ ਦਿੰਦੇ ਹੋ' },
  tr: { translationService: 'Çeviri Hizmeti', scanInstruction: 'Telefonunuzun kamerasıyla tarayın', noApp: 'Uygulama gerekmez', free: 'Ücretsiz', privateSecure: 'Gizli ve güvenli', staffSpeaks: 'Personel İngilizce konuşur', youHear: 'Kendi dilinizde duyarsınız', youSpeak: 'Cevap verirsiniz' },
  ru: { translationService: 'Служба перевода', scanInstruction: 'Сканируйте камерой телефона', noApp: 'Приложение не нужно', free: 'Бесплатно', privateSecure: 'Конфиденциально и безопасно', staffSpeaks: 'Персонал говорит по-английски', youHear: 'Вы слышите на своём языке', youSpeak: 'Вы отвечаете' },
  so: { translationService: 'Adeegga Turjumaanka', scanInstruction: 'Ku scan kamaradda taleefankaaga', noApp: 'App looma baahna', free: 'Bilaash', privateSecure: 'Gaar ah oo ammaan ah', staffSpeaks: 'Shaqaalaha waxay ku hadlaan Ingiriisi', youHear: 'Waxaad ku maqashaa luqaddaada', youSpeak: 'Waxaad ka jawaabtaa' },
  ti: { translationService: 'ኣገልግሎት ትርጉም', scanInstruction: 'ብካሜራ ተሌፎንካ ስካን ግበር', noApp: 'ኣፕ ኣየድልን', free: 'ብነጻ', privateSecure: 'ውልቃዊን ውሑስን', staffSpeaks: 'ሰራሕተኛታት ብእንግሊዝኛ ይዛረቡ', youHear: 'ብቛንቛኻ ትሰምዕ', youSpeak: 'ትምልስ' },
  fa: { translationService: 'خدمات ترجمه', scanInstruction: 'با دوربین گوشی اسکن کنید', noApp: 'نیازی به اپلیکیشن نیست', free: 'رایگان', privateSecure: 'خصوصی و امن', staffSpeaks: 'کارکنان انگلیسی صحبت می‌کنند', youHear: 'به زبان خود می‌شنوید', youSpeak: 'پاسخ می‌دهید' },
  zh: { translationService: '翻译服务', scanInstruction: '用手机摄像头扫描', noApp: '无需下载应用', free: '免费', privateSecure: '私密且安全', staffSpeaks: '工作人员说英语', youHear: '您听到自己的语言', youSpeak: '您用自己的语言回答' },
  de: { translationService: 'Übersetzungsdienst', scanInstruction: 'Mit der Handykamera scannen', noApp: 'Keine App nötig', free: 'Kostenlos', privateSecure: 'Privat und sicher', staffSpeaks: 'Personal spricht Englisch', youHear: 'Sie hören Ihre Sprache', youSpeak: 'Sie antworten' },
  it: { translationService: 'Servizio di traduzione', scanInstruction: 'Scansiona con la fotocamera del telefono', noApp: 'Nessuna app necessaria', free: 'Gratuito', privateSecure: 'Privato e sicuro', staffSpeaks: 'Il personale parla inglese', youHear: 'Ascolti nella tua lingua', youSpeak: 'Rispondi' },
  am: { translationService: 'የትርጉም አገልግሎት', scanInstruction: 'በስልክዎ ካሜራ ይቃኙ', noApp: 'መተግበሪያ አያስፈልግም', free: 'ነጻ', privateSecure: 'የግል እና ደህንነቱ የተጠበቀ', staffSpeaks: 'ሰራተኞች እንግሊዝኛ ይናገራሉ', youHear: 'በቋንቋዎ ይሰማሉ', youSpeak: 'ይመልሳሉ' },
  sw: { translationService: 'Huduma ya Tafsiri', scanInstruction: 'Changanua kwa kamera ya simu yako', noApp: 'Hakuna programu inayohitajika', free: 'Bure', privateSecure: 'Faragha na salama', staffSpeaks: 'Wafanyakazi wanazungumza Kiingereza', youHear: 'Unasikia lugha yako', youSpeak: 'Unajibu' },
};

export interface HandoutOptions {
  practiceName: string;
  practiceAddress?: string;
  patientLanguage: string;
  patientLanguageName: string;
  patientLanguageFlag?: string;
  qrCodeUrl: string;
  sessionUrl: string;
}

export function printPatientHandout(options: HandoutOptions): void {
  const {
    practiceName,
    practiceAddress,
    patientLanguage,
    patientLanguageName,
    patientLanguageFlag,
    qrCodeUrl,
    sessionUrl,
  } = options;

  const t = HANDOUT_TRANSLATIONS[patientLanguage] || HANDOUT_TRANSLATIONS.en;
  const en = HANDOUT_TRANSLATIONS.en;
  const isRtl = RTL_LANGUAGES.includes(patientLanguage);
  const rtlDir = isRtl ? 'dir="rtl"' : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Translation Service – ${practiceName}</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #212B32; line-height: 1.5; }
  .page { max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; margin-bottom: 28px; border-bottom: 3px solid #005EB8; padding-bottom: 16px; }
  .practice-name { font-size: 28px; font-weight: 700; color: #005EB8; }
  .practice-address { font-size: 13px; color: #768692; margin-top: 4px; }
  .main-content { display: flex; gap: 32px; align-items: flex-start; margin-bottom: 28px; }
  .qr-section { flex-shrink: 0; text-align: center; }
  .qr-img { width: 220px; height: 220px; border: 2px solid #E8EDEE; border-radius: 12px; padding: 8px; }
  .qr-url { font-size: 9px; color: #768692; margin-top: 6px; word-break: break-all; max-width: 220px; }
  .info-section { flex: 1; }
  .title-en { font-size: 26px; font-weight: 700; color: #005EB8; }
  .title-lang { font-size: 22px; font-weight: 600; color: #005EB8; margin-top: 2px; }
  .scan-en { font-size: 16px; color: #212B32; margin-top: 16px; }
  .scan-lang { font-size: 15px; color: #4C6272; margin-top: 2px; }
  .lang-badge { display: inline-block; margin-top: 12px; font-size: 14px; padding: 4px 14px; border: 2px solid #005EB8; border-radius: 20px; color: #005EB8; font-weight: 600; }
  .steps { display: flex; gap: 12px; justify-content: center; margin: 28px 0; }
  .step { flex: 1; max-width: 180px; text-align: center; border: 2px solid #E8EDEE; border-radius: 12px; padding: 16px 8px; }
  .step-icon { font-size: 32px; margin-bottom: 6px; }
  .step-arrow { display: flex; align-items: center; font-size: 22px; color: #AEB7BD; padding-top: 14px; }
  .step-en { font-size: 13px; font-weight: 600; color: #212B32; }
  .step-lang { font-size: 12px; color: #4C6272; margin-top: 2px; }
  .benefits { display: flex; justify-content: center; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
  .benefit { text-align: center; }
  .benefit-en { font-size: 13px; font-weight: 600; color: #212B32; }
  .benefit-lang { font-size: 12px; color: #4C6272; }
  .benefit-icon { font-size: 18px; margin-bottom: 2px; }
  .footer { border-top: 2px solid #E8EDEE; padding-top: 14px; text-align: center; }
  .footer-main { font-size: 12px; color: #4C6272; }
  .footer-brand { font-size: 11px; color: #AEB7BD; margin-top: 4px; }
  .bilingual { ${isRtl ? '' : ''} }
  .rtl-text { direction: rtl; text-align: right; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="practice-name">${practiceName}</div>
    ${practiceAddress ? `<div class="practice-address">${practiceAddress}</div>` : ''}
  </div>

  <div class="main-content">
    <div class="qr-section">
      <img src="${qrCodeUrl}" alt="QR Code" class="qr-img" />
      <div class="qr-url">${sessionUrl}</div>
    </div>
    <div class="info-section">
      <div class="title-en">${en.translationService}</div>
      ${patientLanguage !== 'en' ? `<div class="title-lang" ${rtlDir}>${t.translationService}</div>` : ''}
      <div class="scan-en">📱 ${en.scanInstruction}</div>
      ${patientLanguage !== 'en' ? `<div class="scan-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.scanInstruction}</div>` : ''}
      <div class="lang-badge">${patientLanguageFlag || ''} ${patientLanguageName}</div>
    </div>
  </div>

  <div class="steps">
    <div class="step">
      <div class="step-icon">🎤</div>
      <div class="step-en">${en.staffSpeaks}</div>
      ${patientLanguage !== 'en' ? `<div class="step-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.staffSpeaks}</div>` : ''}
    </div>
    <div class="step-arrow">→</div>
    <div class="step">
      <div class="step-icon">🔊</div>
      <div class="step-en">${en.youHear}</div>
      ${patientLanguage !== 'en' ? `<div class="step-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.youHear}</div>` : ''}
    </div>
    <div class="step-arrow">→</div>
    <div class="step">
      <div class="step-icon">💬</div>
      <div class="step-en">${en.youSpeak}</div>
      ${patientLanguage !== 'en' ? `<div class="step-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.youSpeak}</div>` : ''}
    </div>
  </div>

  <div class="benefits">
    <div class="benefit">
      <div class="benefit-icon">✅</div>
      <div class="benefit-en">${en.noApp}</div>
      ${patientLanguage !== 'en' ? `<div class="benefit-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.noApp}</div>` : ''}
    </div>
    <div class="benefit">
      <div class="benefit-icon">🆓</div>
      <div class="benefit-en">${en.free}</div>
      ${patientLanguage !== 'en' ? `<div class="benefit-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.free}</div>` : ''}
    </div>
    <div class="benefit">
      <div class="benefit-icon">🔒</div>
      <div class="benefit-en">${en.privateSecure}</div>
      ${patientLanguage !== 'en' ? `<div class="benefit-lang ${isRtl ? 'rtl-text' : ''}" ${rtlDir}>${t.privateSecure}</div>` : ''}
    </div>
  </div>

  <div class="footer">
    <div class="footer-main">NHS GP Practice Translation Service</div>
    <div class="footer-brand">Powered by Sherpa AI &nbsp;•&nbsp; 🔒 No personal data is stored</div>
  </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}
