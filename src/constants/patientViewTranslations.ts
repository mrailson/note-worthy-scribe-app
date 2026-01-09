// Pre-translated UI strings for patient-focused view
// Common phrases in languages frequently encountered in UK GP practices

export interface PatientViewPhrases {
  speakNow: string;
  pleaseWait: string;
  paused: string;
  resumingIn: string;
  listening: string;
  processing: string;
}

export const PATIENT_VIEW_TRANSLATIONS: Record<string, PatientViewPhrases> = {
  en: {
    speakNow: 'Speak now',
    pleaseWait: 'Please wait',
    paused: 'Paused',
    resumingIn: 'Resuming in',
    listening: 'Listening',
    processing: 'Processing',
  },
  pl: {
    speakNow: 'Mów teraz',
    pleaseWait: 'Proszę czekać',
    paused: 'Wstrzymano',
    resumingIn: 'Wznowienie za',
    listening: 'Słucham',
    processing: 'Przetwarzanie',
  },
  ro: {
    speakNow: 'Vorbiți acum',
    pleaseWait: 'Vă rugăm să așteptați',
    paused: 'Pauză',
    resumingIn: 'Se reia în',
    listening: 'Ascultare',
    processing: 'Procesare',
  },
  ar: {
    speakNow: 'تحدث الآن',
    pleaseWait: 'يرجى الانتظار',
    paused: 'متوقف مؤقتاً',
    resumingIn: 'استئناف في',
    listening: 'جارٍ الاستماع',
    processing: 'جارٍ المعالجة',
  },
  hi: {
    speakNow: 'अभी बोलें',
    pleaseWait: 'कृपया प्रतीक्षा करें',
    paused: 'रुका हुआ',
    resumingIn: 'में फिर से शुरू',
    listening: 'सुन रहा है',
    processing: 'प्रोसेसिंग',
  },
  ur: {
    speakNow: 'اب بولیں',
    pleaseWait: 'براہ کرم انتظار کریں',
    paused: 'موقوف',
    resumingIn: 'میں دوبارہ شروع',
    listening: 'سن رہا ہے',
    processing: 'پروسیسنگ',
  },
  pa: {
    speakNow: 'ਹੁਣੇ ਬੋਲੋ',
    pleaseWait: 'ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ',
    paused: 'ਰੁਕਿਆ ਹੋਇਆ',
    resumingIn: 'ਵਿੱਚ ਦੁਬਾਰਾ ਸ਼ੁਰੂ',
    listening: 'ਸੁਣ ਰਿਹਾ ਹੈ',
    processing: 'ਪ੍ਰੋਸੈਸਿੰਗ',
  },
  bn: {
    speakNow: 'এখন বলুন',
    pleaseWait: 'অনুগ্রহ করে অপেক্ষা করুন',
    paused: 'বিরতি',
    resumingIn: 'পুনরায় শুরু হবে',
    listening: 'শুনছি',
    processing: 'প্রক্রিয়াকরণ',
  },
  es: {
    speakNow: 'Hable ahora',
    pleaseWait: 'Por favor espere',
    paused: 'Pausado',
    resumingIn: 'Reanudando en',
    listening: 'Escuchando',
    processing: 'Procesando',
  },
  pt: {
    speakNow: 'Fale agora',
    pleaseWait: 'Por favor aguarde',
    paused: 'Pausado',
    resumingIn: 'Retomando em',
    listening: 'Ouvindo',
    processing: 'Processando',
  },
  fr: {
    speakNow: 'Parlez maintenant',
    pleaseWait: 'Veuillez patienter',
    paused: 'En pause',
    resumingIn: 'Reprise dans',
    listening: 'Écoute',
    processing: 'Traitement',
  },
  de: {
    speakNow: 'Sprechen Sie jetzt',
    pleaseWait: 'Bitte warten',
    paused: 'Pausiert',
    resumingIn: 'Fortsetzung in',
    listening: 'Hören',
    processing: 'Verarbeitung',
  },
  it: {
    speakNow: 'Parla ora',
    pleaseWait: 'Attendere prego',
    paused: 'In pausa',
    resumingIn: 'Ripresa in',
    listening: 'Ascolto',
    processing: 'Elaborazione',
  },
  tr: {
    speakNow: 'Şimdi konuşun',
    pleaseWait: 'Lütfen bekleyin',
    paused: 'Duraklatıldı',
    resumingIn: 'Devam ediliyor',
    listening: 'Dinleniyor',
    processing: 'İşleniyor',
  },
  fa: {
    speakNow: 'اکنون صحبت کنید',
    pleaseWait: 'لطفاً صبر کنید',
    paused: 'متوقف شده',
    resumingIn: 'ادامه در',
    listening: 'در حال گوش دادن',
    processing: 'در حال پردازش',
  },
  so: {
    speakNow: 'Hadda hadal',
    pleaseWait: 'Fadlan sug',
    paused: 'Waa la joojiyay',
    resumingIn: 'Dib u bilaabid',
    listening: 'Waan dhagaysanayaa',
    processing: 'Waa la habeynayaa',
  },
  zh: {
    speakNow: '请现在说话',
    pleaseWait: '请稍候',
    paused: '已暂停',
    resumingIn: '恢复中',
    listening: '正在听',
    processing: '处理中',
  },
  vi: {
    speakNow: 'Hãy nói ngay',
    pleaseWait: 'Vui lòng chờ',
    paused: 'Đã tạm dừng',
    resumingIn: 'Tiếp tục trong',
    listening: 'Đang nghe',
    processing: 'Đang xử lý',
  },
  ru: {
    speakNow: 'Говорите сейчас',
    pleaseWait: 'Пожалуйста, подождите',
    paused: 'Пауза',
    resumingIn: 'Возобновление через',
    listening: 'Слушаю',
    processing: 'Обработка',
  },
  uk: {
    speakNow: 'Говоріть зараз',
    pleaseWait: 'Будь ласка, зачекайте',
    paused: 'Призупинено',
    resumingIn: 'Відновлення через',
    listening: 'Слухаю',
    processing: 'Обробка',
  },
};

export const getPatientViewPhrases = (languageCode: string): PatientViewPhrases => {
  return PATIENT_VIEW_TRANSLATIONS[languageCode] || PATIENT_VIEW_TRANSLATIONS.en;
};
